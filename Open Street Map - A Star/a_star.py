import heapq
from pathlib import Path
import sys
import time
import tracemalloc

_project_root = Path(__file__).resolve().parents[1]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from road_network import (
    Edge,
    HAZARD_ZONES,
    ILOILO_BOUNDS,
    MAX_TRAVEL_SPEED_MPS,
    Node,
    ROAD_HINDRANCES,
    START_COORDINATES,
    GOAL_COORDINATES,
    build_graph,
    fetch_overpass_roads,
    find_nearest_node,
    haversine_meters,
    is_finite_number,
)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return haversine_meters(Node(-1, lat1, lon1), Node(-1, lat2, lon2))


def time_heuristic(nodes: dict[int, Node], node_id: int, goal_id: int) -> float:
    """Estimate seconds; astar validates graph bounds before relying on it."""
    return (
        haversine_meters(nodes[node_id], nodes[goal_id])
        / MAX_TRAVEL_SPEED_MPS
    )


def astar(
    nodes: dict[int, Node],
    edges: list[Edge],
    start_node: int,
    goal_node: int,
    *,
    metrics: dict[str, int | None] | None = None,
) -> tuple[list[int] | None, float]:
    if start_node not in nodes or goal_node not in nodes:
        if metrics is not None:
            metrics.update(
                nodes_processed=0,
                unique_explored_nodes=0,
                edge_checks=0,
                successful_relaxations=0,
                iterations=None,
            )
        return None, float("inf")

    adjacency = {node_id: [] for node_id in nodes}
    use_geographic_heuristic = all(
        is_finite_number(node.lat)
        and -90 <= node.lat <= 90
        and is_finite_number(node.lon)
        and -180 <= node.lon <= 180
        for node in nodes.values()
    )
    for edge in edges:
        if edge.u not in nodes or edge.v not in nodes:
            raise ValueError(f"Edge refers to an unknown node: {edge}")
        if not is_finite_number(edge.weight) or edge.weight < 0:
            raise ValueError("A* requires finite, nonnegative edge weights.")
        if use_geographic_heuristic:
            # Every edge must respect this lower bound for the heuristic to be consistent.
            minimum_travel_time = (
                haversine_meters(nodes[edge.u], nodes[edge.v])
                / MAX_TRAVEL_SPEED_MPS
            )
            if edge.weight < minimum_travel_time:
                use_geographic_heuristic = False
        adjacency[edge.u].append((edge.v, edge.weight))

    def heuristic(node_id: int) -> float:
        if use_geographic_heuristic:
            return time_heuristic(nodes, node_id, goal_node)
        return 0.0

    g_score = {node_id: float("inf") for node_id in nodes}
    g_score[start_node] = 0.0
    f_score = {node_id: float("inf") for node_id in nodes}
    f_score[start_node] = heuristic(start_node)
    came_from: dict[int, int] = {}
    open_heap = [(f_score[start_node], 0.0, start_node)]
    closed_nodes = set()
    explored_nodes = set()
    nodes_processed = 0
    edge_checks = 0
    successful_relaxations = 0

    while open_heap:
        current_f, queued_g, current = heapq.heappop(open_heap)
        if (
            queued_g != g_score[current]
            or current_f != f_score[current]
            or current in closed_nodes
        ):
            continue

        closed_nodes.add(current)
        nodes_processed += 1
        explored_nodes.add(current)
        if current == goal_node:
            path = []
            seen = set()
            cursor = goal_node
            while cursor != start_node:
                if cursor in seen or cursor not in came_from:
                    raise RuntimeError("A* path reconstruction failed.")
                seen.add(cursor)
                path.append(cursor)
                cursor = came_from[cursor]
            path.append(start_node)
            path.reverse()
            break

        for neighbor, weight in adjacency[current]:
            edge_checks += 1
            tentative_g = g_score[current] + weight
            if tentative_g >= g_score[neighbor]:
                continue
            came_from[neighbor] = current
            g_score[neighbor] = tentative_g
            f_score[neighbor] = tentative_g + heuristic(neighbor)
            closed_nodes.discard(neighbor)
            successful_relaxations += 1
            heapq.heappush(
                open_heap, (f_score[neighbor], tentative_g, neighbor)
            )
    else:
        path = None

    if metrics is not None:
        metrics.update(
            nodes_processed=nodes_processed,
            unique_explored_nodes=len(explored_nodes),
            edge_checks=edge_checks,
            successful_relaxations=successful_relaxations,
            iterations=None,
        )
    if path is None:
        return None, float("inf")
    return path, g_score[goal_node]


def main() -> None:
    osm_data = fetch_overpass_roads(*ILOILO_BOUNDS)
    nodes, edges = build_graph(osm_data, ROAD_HINDRANCES, HAZARD_ZONES)
    start = find_nearest_node(nodes, *START_COORDINATES)
    goal = find_nearest_node(nodes, *GOAL_COORDINATES)

    metrics: dict[str, int | None] = {}
    tracemalloc.start()
    started = time.perf_counter()
    route, travel_time = astar(nodes, edges, start, goal, metrics=metrics)
    execution_time = time.perf_counter() - started
    _, peak_memory = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    if route is None:
        print("No route found.")
        return
    print(f"Route found: {len(route)} nodes")
    print(f"Estimated travel time: {travel_time:.1f} seconds")
    print(f"Execution time: {execution_time:.6f} seconds")
    print(f"Peak memory usage: {peak_memory / 1024:.2f} KB")
    print(f"Nodes processed: {metrics['nodes_processed']}")
    print(f"Unique explored nodes: {metrics['unique_explored_nodes']}")
    print(f"Edge checks: {metrics['edge_checks']}")
    print(f"Successful relaxations: {metrics['successful_relaxations']}")
    print(
        "First 5 waypoints:",
        [[nodes[node_id].lat, nodes[node_id].lon] for node_id in route[:5]],
    )


if __name__ == "__main__":
    main()
