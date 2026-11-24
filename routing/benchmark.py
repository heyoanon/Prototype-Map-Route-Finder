from dataclasses import dataclass
import math
import time
import tracemalloc

from road_network import (
    HAZARD_ZONES,
    ILOILO_BOUNDS,
    ROAD_HINDRANCES,
    START_COORDINATES,
    GOAL_COORDINATES,
    Edge,
    Node,
    build_graph,
    fetch_overpass_roads,
    find_nearest_node,
)
from routing.a_star import astar
from routing.bellman_ford import bellman_ford
from routing.spfa import spfa

@dataclass
class AlgorithmBenchmark:
    name: str
    route: list[int] | None
    route_cost_seconds: float
    execution_seconds: float
    peak_memory_bytes: int
    nodes_processed: int | None
    unique_explored_nodes: int
    edge_checks: int
    successful_relaxations: int
    iterations: int | None


def _validate_route(
    nodes: dict[int, Node],
    edges: list[Edge],
    source: int,
    target: int,
    route: list[int] | None,
    cost: float,
) -> None:
    if route is None or route == []:
        if not math.isinf(cost):
            raise AssertionError("An absent route must have infinite cost.")
        return
    if (
        not route
        or route[0] != source
        or route[-1] != target
        or any(node_id not in nodes for node_id in route)
    ):
        raise AssertionError("Algorithm returned an invalid route endpoint.")

    pair_costs: dict[tuple[int, int], float] = {}
    for edge in edges:
        key = (edge.u, edge.v)
        pair_costs[key] = min(pair_costs.get(key, float("inf")), edge.weight)
    route_cost = 0.0
    for u, v in zip(route, route[1:]):
        if (u, v) not in pair_costs:
            raise AssertionError(f"Route contains a missing directed edge: {u} -> {v}")
        route_cost += pair_costs[u, v]
    if not math.isclose(route_cost, cost, rel_tol=1e-9, abs_tol=1e-6):
        raise AssertionError(
            f"Reported route cost {cost} differs from edge cost {route_cost}."
        )


def _measure(
    name: str,
    runner,
    nodes: dict[int, Node],
    edges: list[Edge],
    source: int,
    target: int,
) -> AlgorithmBenchmark:
    if tracemalloc.is_tracing():
        raise RuntimeError("Benchmark requires tracemalloc to be stopped.")

    metrics: dict[str, int | None] = {}
    started = time.perf_counter()
    route, cost = runner(nodes, edges, source, target, metrics=metrics)
    elapsed = time.perf_counter() - started

    tracemalloc.start()
    try:
        runner(nodes, edges, source, target, metrics={})
        _, peak_memory = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    _validate_route(nodes, edges, source, target, route, cost)
    return AlgorithmBenchmark(
        name=name,
        route=route,
        route_cost_seconds=cost,
        execution_seconds=elapsed,
        peak_memory_bytes=peak_memory,
        nodes_processed=metrics.get("nodes_processed"),
        unique_explored_nodes=metrics.get("unique_explored_nodes", 0) or 0,
        edge_checks=metrics.get("edge_checks", 0) or 0,
        successful_relaxations=metrics.get("successful_relaxations", 0) or 0,
        iterations=metrics.get("iterations"),
    )


def run_benchmark(
    nodes: dict[int, Node], edges: list[Edge], source: int, target: int
) -> list[AlgorithmBenchmark]:
    def run_bellman_ford(nodes, edges, source, target, *, metrics):
        route, cost, *_ = bellman_ford(nodes, edges, source, target, metrics=metrics)
        return route or None, cost

    def run_spfa(nodes, edges, source, target, *, metrics):
        route, cost, _, _ = spfa(nodes, edges, source, target, metrics=metrics)
        return route, cost

    results = [
        _measure(
            "Bellman-Ford",
            run_bellman_ford,
            nodes,
            edges,
            source,
            target,
        ),
        _measure("SPFA", run_spfa, nodes, edges, source, target),
        _measure("A*", astar, nodes, edges, source, target),
    ]
    expected_cost = results[0].route_cost_seconds
    for result in results[1:]:
        if not math.isclose(
            result.route_cost_seconds,
            expected_cost,
            rel_tol=1e-9,
            abs_tol=1e-6,
        ):
            raise AssertionError(
                f"{result.name} cost {result.route_cost_seconds} does not match "
                f"Bellman-Ford cost {expected_cost}."
            )
    return results


def print_benchmark(results: list[AlgorithmBenchmark]) -> None:
    for result in results:
        print(f"\n{result.name}")
        print("-" * len(result.name))
        print(f"Execution time: {result.execution_seconds:.6f} seconds")
        print(f"Peak memory: {result.peak_memory_bytes / 1024:.2f} KB")
        print(f"Route cost: {result.route_cost_seconds:.3f} seconds")
        print(f"Route nodes: {len(result.route) if result.route else 0}")
        print(f"Nodes processed: {result.nodes_processed!s}")
        print(f"Unique explored nodes: {result.unique_explored_nodes}")
        print(f"Edge checks: {result.edge_checks}")
        print(f"Successful relaxations: {result.successful_relaxations}")
        print(f"Iterations: {result.iterations!s}")


def main() -> None:
    osm_data = fetch_overpass_roads(*ILOILO_BOUNDS)
    nodes, edges = build_graph(osm_data, ROAD_HINDRANCES, HAZARD_ZONES)
    source = find_nearest_node(nodes, *START_COORDINATES)
    target = find_nearest_node(nodes, *GOAL_COORDINATES)
    print(f"Graph built once: {len(nodes)} nodes, {len(edges)} directed edges")
    print_benchmark(run_benchmark(nodes, edges, source, target))


if __name__ == "__main__":
    main()
