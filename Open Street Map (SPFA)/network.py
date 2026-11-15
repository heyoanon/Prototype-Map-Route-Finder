from collections import deque
import osmnx as ox


def spfa_osm(graph, start_node, goal_node=None):
    """Finds the shortest path from start_node using SPFA (Shortest Path Faster Algorithm).

    If goal_node is specified, reconstructs and returns (path, total_distance).
    Otherwise, returns the dictionary of shortest distances to all reachable
    nodes.
    """
    # Initialize distances and predecessor tracking
    dist = {node: float('inf') for node in graph.nodes}
    came_from = {}
    in_queue = {node: False for node in graph.nodes}

    dist[start_node] = 0
    queue = deque([start_node])
    in_queue[start_node] = True

    while queue:
        u = queue.popleft()
        in_queue[u] = False

        # Iterate over all outgoing neighbors of u
        for v in graph.neighbors(u):
            # OSMnx graphs are MultiDiGraphs; pick the shortest parallel edge
            edge_data = graph.get_edge_data(u, v)
            weight = min(data.get('length', 1.0) for data in edge_data.values())

            # Edge relaxation step
            if dist[u] + weight < dist[v]:
                dist[v] = dist[u] + weight
                came_from[v] = u

                if not in_queue[v]:
                    # Small Label First (SLF) optimization:
                    # Push to front if closer than current front node to speed up convergence
                    if queue and dist[v] < dist[queue[0]]:
                        queue.appendleft(v)
                    else:
                        queue.append(v)
                    in_queue[v] = True

    if goal_node is None:
        return dist

    if dist[goal_node] == float('inf'):
        return None, float('inf')

    # Reconstruct shortest path
    path = []
    curr = goal_node
    while curr in came_from:
        path.append(curr)
        curr = came_from[curr]
    path.append(start_node)

    return path[::-1], dist[goal_node]


# --- Example Usage ---
if __name__ == '__main__':
    # 1. Fetch drivable road network via OSMnx (queries Overpass API under the hood)
    place_name = 'Piedmont, California, USA'
    G = ox.graph_from_place(place_name, network_type='drive')

    # 2. Origin and destination (Latitude, Longitude)
    orig_coords = (37.8244, -122.2316)
    dest_coords = (37.8184, -122.2442)

    # 3. Snap coordinates to nearest graph nodes (note: X=lon, Y=lat)
    orig_node = ox.distance.nearest_nodes(G, X=orig_coords[1], Y=orig_coords[0])
    dest_node = ox.distance.nearest_nodes(G, X=dest_coords[1], Y=dest_coords[0])

    # 4. Run SPFA
    route, total_distance = spfa_osm(G, orig_node, dest_node)

    if route:
        print(
            f'Path found! Nodes: {len(route)}, Total Distance: {total_distance:.2f} meters'
        )
        ox.plot_graph_route(G, route, node_size=0, route_linewidth=4)
    else:
        print('No route found.')