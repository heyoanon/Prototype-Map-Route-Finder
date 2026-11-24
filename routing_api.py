import importlib.util
import math
from pathlib import Path
import sys
import time
import tracemalloc
from typing import Callable

from road_network import (
    HAZARD_ZONES,
    ILOILO_BOUNDS,
    ROAD_HINDRANCES,
    Edge,
    Node,
    build_graph,
    fetch_overpass_roads,
    find_nearest_node,
    haversine_meters,
)


ROOT = Path(__file__).resolve().parent
ALGORITHM_NAMES = ("bellman_ford", "spfa", "a_star")


class ApiRequestError(ValueError):
    pass


class GraphUnavailableError(RuntimeError):
    pass


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def load_live_graph() -> tuple[dict[int, Node], list[Edge]]:
    osm_data = fetch_overpass_roads(*ILOILO_BOUNDS)
    return build_graph(osm_data, ROAD_HINDRANCES, HAZARD_ZONES)


class GraphCache:
    def __init__(
        self,
        loader: Callable[[], tuple[dict[int, Node], list[Edge]]] = load_live_graph,
        ttl_seconds: float = 300.0,
    ) -> None:
        self.loader = loader
        self.ttl_seconds = ttl_seconds
        self.graph = None
        self.loaded_at = 0.0

    def get(self) -> tuple[dict[int, Node], list[Edge], bool]:
        now = time.monotonic()
        if self.graph is not None and now - self.loaded_at < self.ttl_seconds:
            return self.graph[0], self.graph[1], True
        try:
            nodes, edges = self.loader()
        except Exception as error:
            raise GraphUnavailableError(
                "Unable to download or construct the live Iloilo road graph."
            ) from error
        if not isinstance(nodes, dict) or not isinstance(edges, list):
            raise GraphUnavailableError("The road graph loader returned invalid data.")
        self.graph = (nodes, edges)
        self.loaded_at = now
        return nodes, edges, False

    def clear(self) -> None:
        self.graph = None
        self.loaded_at = 0.0


class RoutingApi:
    def __init__(self, graph_cache: GraphCache | None = None) -> None:
        self.graph_cache = graph_cache or GraphCache()
        self._algorithm_modules = {}

    def _algorithm_module(self, name: str):
        if name in self._algorithm_modules:
            return self._algorithm_modules[name]
        locations = {
            "bellman_ford": (
                ROOT / "Open Street Map (Bellmans - Ford)" / "bellman_ford.py",
                "bellman_ford",
            ),
            "spfa": (
                ROOT / "Open Street Map (SPFA)" / "spfa.py",
                "spfa",
            ),
            "a_star": (
                ROOT / "Open Street Map - A Star" / "a_star.py",
                "astar",
            ),
        }
        path, function_name = locations[name]
        module = _load_module(f"_routing_api_{name}", path)
        self._algorithm_modules[name] = (module, function_name)
        return module, function_name

    def _validate_coordinates(
        self, origin_lat, origin_lon, destination_lat, destination_lon
    ) -> tuple[float, float, float, float]:
        values = (
            origin_lat,
            origin_lon,
            destination_lat,
            destination_lon,
        )
        names = (
            "origin_lat",
            "origin_lon",
            "destination_lat",
            "destination_lon",
        )
        for name, value in zip(names, values):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ApiRequestError(f"{name} must be a finite number.")
            if not math.isfinite(value):
                raise ApiRequestError(f"{name} must be a finite number.")
        origin_lat, origin_lon, destination_lat, destination_lon = values
        if not -90 <= origin_lat <= 90 or not -90 <= destination_lat <= 90:
            raise ApiRequestError("Latitude values must be between -90 and 90.")
        if not -180 <= origin_lon <= 180 or not -180 <= destination_lon <= 180:
            raise ApiRequestError("Longitude values must be between -180 and 180.")
        return values

    def route(
        self,
        origin_lat,
        origin_lon,
        destination_lat,
        destination_lon,
        algorithm: str,
    ) -> dict:
        origin_lat, origin_lon, destination_lat, destination_lon = (
            self._validate_coordinates(
                origin_lat,
                origin_lon,
                destination_lat,
                destination_lon,
            )
        )
        if not isinstance(algorithm, str):
            raise ApiRequestError("algorithm must be a string.")
        algorithm = algorithm.strip().lower().replace("-", "_").replace(" ", "_")
        if algorithm == "bellmanford":
            algorithm = "bellman_ford"
        if algorithm == "astart":
            algorithm = "a_star"
        if algorithm == "astar":
            algorithm = "a_star"
        if algorithm == "a*":
            algorithm = "a_star"
        if algorithm not in (*ALGORITHM_NAMES, "all"):
            raise ApiRequestError(
                "algorithm must be bellman_ford, spfa, a_star, or all."
            )

        nodes, edges, graph_cached = self.graph_cache.get()
        if not nodes:
            raise GraphUnavailableError("The live Iloilo road graph is empty.")

        source = find_nearest_node(nodes, origin_lat, origin_lon)
        target = find_nearest_node(nodes, destination_lat, destination_lon)
        selected = ALGORITHM_NAMES if algorithm == "all" else (algorithm,)
        results = [
            self._run_algorithm(
                name,
                nodes,
                edges,
                source,
                target,
            )
            for name in selected
        ]

        if len(results) == 1:
            response = results[0]
        else:
            costs = [
                result["travel_time_seconds"]
                for result in results
                if result["travel_time_seconds"] is not None
            ]
            route_presence = [
                result["route_node_ids"] for result in results
            ]
            if any(route_presence) and any(not route for route in route_presence):
                raise RuntimeError("Algorithms disagreed on route reachability.")
            if costs and any(not math.isclose(cost, costs[0], rel_tol=1e-9, abs_tol=1e-6) for cost in costs[1:]):
                raise RuntimeError("Algorithms disagreed on the shortest route cost.")
            response = {
                "algorithm": "all",
                "graph": {
                    "node_count": len(nodes),
                    "edge_count": len(edges),
                    "cached": graph_cached,
                },
                "results": results,
            }
        return response

    def _run_algorithm(
        self,
        name: str,
        nodes: dict[int, Node],
        edges: list[Edge],
        source: int,
        target: int,
    ) -> dict:
        module, function_name = self._algorithm_module(name)
        function = getattr(module, function_name)
        metrics = {}

        tracemalloc.start()
        started = time.perf_counter()
        try:
            if name == "bellman_ford":
                route, cost, unique, checks, relaxations, iterations = function(
                    nodes, edges, source, target, metrics=metrics
                )
            elif name == "spfa":
                route, cost, processed, unique = function(
                    nodes, edges, source, target, metrics=metrics
                )
                iterations = None
                checks = metrics["edge_checks"]
                relaxations = metrics["successful_relaxations"]
            else:
                route, cost = function(
                    nodes, edges, source, target, metrics=metrics
                )
                unique = metrics["unique_explored_nodes"]
                processed = metrics["nodes_processed"]
                iterations = None
                checks = metrics["edge_checks"]
                relaxations = metrics["successful_relaxations"]
        finally:
            execution_time = time.perf_counter() - started
            _, peak_memory = tracemalloc.get_traced_memory()
            tracemalloc.stop()

        if name == "bellman_ford":
            processed = metrics["nodes_processed"]
        if route is None:
            route = []

        distance_meters = None
        coordinates = []
        travel_time = None
        if route:
            coordinates = [
                {"latitude": nodes[node_id].lat, "longitude": nodes[node_id].lon}
                for node_id in route
            ]
            distance_meters = sum(
                haversine_meters(nodes[u], nodes[v])
                for u, v in zip(route, route[1:])
            )
            if math.isfinite(cost) and cost >= 0:
                travel_time = cost

        display_name = {
            "bellman_ford": "Bellman-Ford",
            "spfa": "SPFA",
            "a_star": "A*",
        }[name]
        return {
            "algorithm": display_name,
            "route_node_ids": route,
            "route_coordinates": coordinates,
            "travel_time_seconds": travel_time,
            "route_distance_meters": distance_meters,
            "execution_time_seconds": execution_time,
            "peak_traced_memory_bytes": peak_memory,
            "unique_explored_nodes": unique,
            "nodes_processed": processed,
            "edge_checks": checks,
            "successful_relaxations": relaxations,
            "iterations": iterations,
        }
