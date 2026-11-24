import math
from pathlib import Path
import sys
import time
import tracemalloc

_project_root = Path(__file__).resolve().parents[1]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from road_network import (
    HAZARD_ZONES,
    ILOILO_BOUNDS,
    Node,
    ROAD_HINDRANCES,
    START_COORDINATES,
    GOAL_COORDINATES,
    Edge,
    build_graph,
    fetch_overpass_roads,
    find_nearest_node,
    is_finite_number,
)


def bellman_ford(
    nodes: dict[int, Node],
    edges: list[Edge],
    source: int,
    target: int,
    *,
    metrics: dict[str, int | None] | None = None,
) -> tuple[list[int], float, int, int, int, int]:
    if source not in nodes or target not in nodes:
        if metrics is not None:
            metrics.update(
                nodes_processed=0,
                unique_explored_nodes=0,
                edge_checks=0,
                successful_relaxations=0,
                iterations=0,
            )
        return [], float("inf"), 0, 0, 0, 0

    for edge in edges:
        if edge.u not in nodes or edge.v not in nodes:
            raise ValueError(
                f"Edge references missing node: {edge.u} -> {edge.v}"
            )
        if not is_finite_number(edge.weight):
            raise ValueError(
                f"Edge has an invalid weight: {edge.u} -> {edge.v}"
            )

    distances = {node_id: float("inf") for node_id in nodes}
    came_from: dict[int, int] = {}
    distances[source] = 0.0
    nodes_processed = 0
    edge_checks = 0
    successful_relaxations = 0
    iterations_completed = 0

    for _ in range(len(nodes) - 1):
        updated = False
        iterations_completed += 1
        for edge in edges:
            edge_checks += 1
            if distances[edge.u] == float("inf"):
                continue
            nodes_processed += 1
            candidate = distances[edge.u] + edge.weight
            if candidate < distances[edge.v]:
                distances[edge.v] = candidate
                came_from[edge.v] = edge.u
                successful_relaxations += 1
                updated = True
        if not updated:
            print(
                f"Converged early at iteration "
                f"{iterations_completed} / {len(nodes) - 1}"
            )
            break

    for edge in edges:
        edge_checks += 1
        if (
            distances[edge.u] != float("inf")
            and distances[edge.u] + edge.weight < distances[edge.v]
        ):
            raise ValueError("Negative-weight cycle detected in road network!")

    unique_explored_nodes = sum(
        math.isfinite(distance) for distance in distances.values()
    )
    if metrics is not None:
        metrics.update(
            nodes_processed=nodes_processed,
            unique_explored_nodes=unique_explored_nodes,
            edge_checks=edge_checks,
            successful_relaxations=successful_relaxations,
            iterations=iterations_completed,
        )

    if distances[target] == float("inf"):
        return (
            [],
            float("inf"),
            unique_explored_nodes,
            edge_checks,
            successful_relaxations,
            iterations_completed,
        )

    route = []
    current = target
    visited = set()
    while current != source:
        if current in visited:
            raise RuntimeError("Cycle detected during path reconstruction.")
        visited.add(current)
        route.append(current)
        if current not in came_from:
            raise RuntimeError("Path reconstruction failed.")
        current = came_from[current]
    route.append(source)
    route.reverse()
    return (
        route,
        distances[target],
        unique_explored_nodes,
        edge_checks,
        successful_relaxations,
        iterations_completed,
    )


def main() -> None:
    osm_data = fetch_overpass_roads(*ILOILO_BOUNDS)
    nodes, edges = build_graph(osm_data, ROAD_HINDRANCES, HAZARD_ZONES)
    source = find_nearest_node(nodes, *START_COORDINATES)
    target = find_nearest_node(nodes, *GOAL_COORDINATES)

    metrics: dict[str, int | None] = {}
    tracemalloc.start()
    started = time.perf_counter()
    route, cost, explored, checks, relaxations, iterations = bellman_ford(
        nodes, edges, source, target, metrics=metrics
    )
    elapsed = time.perf_counter() - started
    _, peak_memory = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    print("\nBellman-Ford Performance Metrics")
    print("----------------------------------")
    print(f"Execution time: {elapsed:.6f} seconds")
    print(f"Peak memory usage: {peak_memory / 1024:.2f} KB")
    print(
        "Nodes processed (reachable edge-source visits): "
        f"{metrics['nodes_processed']}"
    )
    print(f"Unique explored nodes: {explored}")
    print(f"Edge checks: {checks}")
    print(f"Successful relaxations: {relaxations}")
    print(f"Iterations completed: {iterations}")
    if route:
        print(
            f"Shortest path found ({len(route)} nodes) | "
            f"Estimated Cost: {cost:.1f}s"
        )
        print(
            "First 5 waypoints:",
            [[nodes[node_id].lat, nodes[node_id].lon] for node_id in route[:5]],
        )
    else:
        print("No valid path found between origin and destination.")


if __name__ == "__main__":
    main()
