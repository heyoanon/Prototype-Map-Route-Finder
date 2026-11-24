from collections import deque
import time
import tracemalloc

from road_network import (
    Edge,
    HAZARD_ZONES,
    ILOILO_BOUNDS,
    Node,
    ROAD_HINDRANCES,
    START_COORDINATES,
    GOAL_COORDINATES,
    build_graph,
    fetch_overpass_roads,
    find_nearest_node,
    is_finite_number,
)


def spfa(
    nodes: dict[int, Node],
    edges: list[Edge],
    source: int,
    target: int,
    *,
    metrics: dict[str, int | None] | None = None,
) -> tuple[list[int] | None, float, int, int]:
    if source not in nodes or target not in nodes:
        if metrics is not None:
            metrics.update(
                nodes_processed=0,
                unique_explored_nodes=0,
                edge_checks=0,
                successful_relaxations=0,
                iterations=None,
            )
        return None, float("inf"), 0, 0

    adjacency = {node_id: [] for node_id in nodes}
    for edge in edges:
        if edge.u not in nodes or edge.v not in nodes:
            raise ValueError(f"Edge refers to an unknown node: {edge}")
        if not is_finite_number(edge.weight):
            raise ValueError("Edge weight must be a finite number.")
        if edge.weight < 0:
            raise ValueError(
                "SPFA requires nonnegative weights; negative cycles are unsupported."
            )
        adjacency[edge.u].append((edge.v, edge.weight))

    distances = {node_id: float("inf") for node_id in nodes}
    distances[source] = 0.0
    previous = {source: None}
    queue = deque([source])
    in_queue = {source}
    nodes_processed = 0
    unique_explored_nodes = set()
    edge_checks = 0
    successful_relaxations = 0
    while queue:
        current = queue.popleft()
        in_queue.discard(current)
        nodes_processed += 1
        unique_explored_nodes.add(current)
        for neighbor, weight in adjacency[current]:
            edge_checks += 1
            new_distance = distances[current] + weight
            if new_distance < distances[neighbor]:
                distances[neighbor] = new_distance
                previous[neighbor] = current
                successful_relaxations += 1
                if neighbor not in in_queue:
                    queue.append(neighbor)
                    in_queue.add(neighbor)

    explored_count = len(unique_explored_nodes)
    if metrics is not None:
        metrics.update(
            nodes_processed=nodes_processed,
            unique_explored_nodes=explored_count,
            edge_checks=edge_checks,
            successful_relaxations=successful_relaxations,
            iterations=None,
        )

    if distances[target] == float("inf"):
        return None, float("inf"), nodes_processed, explored_count

    path = []
    seen = set()
    current = target
    while current is not None:
        if current in seen:
            raise RuntimeError("Cycle detected during SPFA path reconstruction.")
        seen.add(current)
        path.append(current)
        if current not in previous:
            raise RuntimeError("SPFA path reconstruction failed.")
        current = previous[current]
    path.reverse()
    return path, distances[target], nodes_processed, explored_count


def main() -> None:
    osm_data = fetch_overpass_roads(*ILOILO_BOUNDS)
    nodes, edges = build_graph(osm_data, ROAD_HINDRANCES, HAZARD_ZONES)
    start_node = find_nearest_node(nodes, *START_COORDINATES)
    goal_node = find_nearest_node(nodes, *GOAL_COORDINATES)

    tracemalloc.start()
    start_time = time.perf_counter()
    metrics = {}
    route, travel_time, explored_count, unique_explored_count = spfa(
        nodes, edges, start_node, goal_node, metrics=metrics
    )
    end_time = time.perf_counter()
    _, peak_memory = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    execution_time = end_time - start_time

    if route is None:
        print("No route found.")
        return

    print(f"Route found: {len(route)} nodes")
    print(f"Estimated travel time: {travel_time:.1f} seconds")
    print(f"Execution time: {execution_time:.6f} seconds")
    print(f"Peak memory usage: {peak_memory / 1024:.2f} KB")
    print(f"Nodes processed: {explored_count}")
    print(f"Unique explored nodes: {unique_explored_count}")
    print(f"Edge checks: {metrics['edge_checks']}")
    print(f"Successful relaxations: {metrics['successful_relaxations']}")
    print(
        "First 5 waypoints:",
        [[nodes[node_id].lat, nodes[node_id].lon] for node_id in route[:5]],
    )

if __name__ == "__main__":
    main()
