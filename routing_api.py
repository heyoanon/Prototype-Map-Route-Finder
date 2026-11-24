import math
import threading
import time
import tracemalloc
from dataclasses import dataclass
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
from routing.a_star import astar
from routing.bellman_ford import bellman_ford
from routing.spfa import spfa


ALGORITHM_NAMES = ("bellman_ford", "spfa", "a_star")
ALGORITHM_LABELS = {
    "bellman_ford": "Bellman-Ford",
    "spfa": "SPFA",
    "a_star": "A*",
}
_METRICS_LOCK = threading.Lock()


@dataclass
class AlgorithmOutput:
    route: list[int] | None
    cost: float
    unique_explored_nodes: int
    nodes_processed: int
    edge_checks: int
    successful_relaxations: int
    iterations: int | None = None


class ApiRequestError(ValueError):
    def __init__(self, message: str, *, missing: list[str] | None = None) -> None:
        super().__init__(message)
        self.missing = missing


class GraphUnavailableError(RuntimeError):
    pass


def route_payload(api: "RoutingApi", payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ApiRequestError("Request body must be a JSON object.")
    required = (
        "origin_lat",
        "origin_lon",
        "destination_lat",
        "destination_lon",
        "algorithm",
    )
    missing = [name for name in required if name not in payload]
    if missing:
        raise ApiRequestError("Missing parameters.", missing=missing)
    return api.route(*(payload[name] for name in required))


def load_live_graph() -> tuple[dict[int, Node], list[Edge]]:
    osm_data = fetch_overpass_roads(*ILOILO_BOUNDS)
    return build_graph(osm_data, ROAD_HINDRANCES, HAZARD_ZONES)


def _run_bellman_ford(nodes, edges, source, target, metrics):
    route, cost, unique, checks, relaxations, iterations = bellman_ford(
        nodes, edges, source, target, metrics=metrics
    )
    return AlgorithmOutput(
        route, cost, unique, metrics["nodes_processed"], checks, relaxations, iterations
    )


def _run_spfa(nodes, edges, source, target, metrics):
    route, cost, processed, unique = spfa(nodes, edges, source, target, metrics=metrics)
    return AlgorithmOutput(
        route,
        cost,
        unique,
        processed,
        metrics["edge_checks"],
        metrics["successful_relaxations"],
    )


def _run_a_star(nodes, edges, source, target, metrics):
    route, cost = astar(nodes, edges, source, target, metrics=metrics)
    return AlgorithmOutput(
        route,
        cost,
        metrics["unique_explored_nodes"],
        metrics["nodes_processed"],
        metrics["edge_checks"],
        metrics["successful_relaxations"],
    )


ALGORITHM_RUNNERS = {
    "bellman_ford": _run_bellman_ford,
    "spfa": _run_spfa,
    "a_star": _run_a_star,
}


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
        self._lock = threading.Lock()

    def get(self) -> tuple[dict[int, Node], list[Edge], bool]:
        with self._lock:
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
            self.loaded_at = time.monotonic()
            return nodes, edges, False

    def clear(self) -> None:
        with self._lock:
            self.graph = None
            self.loaded_at = 0.0


class RoutingApi:
    def __init__(self, graph_cache: GraphCache | None = None) -> None:
        self.graph_cache = graph_cache or GraphCache()

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
        graph_info = {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "cached": graph_cached,
        }
        for result in results:
            result["graph"] = graph_info

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
                "graph": graph_info,
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
        runner = ALGORITHM_RUNNERS[name]
        metrics = {}

        with _METRICS_LOCK:
            started = time.perf_counter()
            result = runner(nodes, edges, source, target, metrics)
            execution_time = time.perf_counter() - started

            tracemalloc.start()
            try:
                runner(nodes, edges, source, target, {})
            finally:
                _, peak_memory = tracemalloc.get_traced_memory()
                tracemalloc.stop()

        route = result.route or []

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
            if math.isfinite(result.cost) and result.cost >= 0:
                travel_time = result.cost

        return {
            "algorithm": ALGORITHM_LABELS[name],
            "route_node_ids": route,
            "route_coordinates": coordinates,
            "travel_time_seconds": travel_time,
            "route_distance_meters": distance_meters,
            "execution_time_seconds": execution_time,
            "peak_traced_memory_bytes": peak_memory,
            "unique_explored_nodes": result.unique_explored_nodes,
            "nodes_processed": result.nodes_processed,
            "edge_checks": result.edge_checks,
            "successful_relaxations": result.successful_relaxations,
            "iterations": result.iterations,
        }
