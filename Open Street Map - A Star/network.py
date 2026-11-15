import heapq
import math
import osmnx as ox


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great-circle distance in meters between two points

    on Earth. Used as the admissible heuristic h(n) for A*.
    """
    R = 6371000  # Radius of Earth in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def astar_osm(graph, start_node, goal_node):
    """Finds the shortest path between start_node and goal_node in an OSMnx graph

    using the A* algorithm based on edge length (meters).
    """
    # Priority queue stores tuples of (f_score, current_node)
    open_set = []
    heapq.heappush(open_set, (0, start_node))

    came_from = {}

    # g_score: cost from start_node to current_node
    g_score = {node: float('inf') for node in graph.nodes}
    g_score[start_node] = 0

    goal_y = graph.nodes[goal_node]['y']  # Latitude
    goal_x = graph.nodes[goal_node]['x']  # Longitude

    # f_score: g_score + heuristic
    f_score = {node: float('inf') for node in graph.nodes}
    start_y = graph.nodes[start_node]['y']
    start_x = graph.nodes[start_node]['x']
    f_score[start_node] = haversine_distance(start_y, start_x, goal_y, goal_x)

    open_set_hash = {start_node}

    while open_set:
        # Pop node with the lowest f_score
        current_f, current = heapq.heappop(open_set)
        open_set_hash.discard(current)

        if current == goal_node:
            # Reconstruct path
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start_node)
            return path[::-1], g_score[goal_node]

        # Explore neighbors
        for neighbor in graph.neighbors(current):
            # OSMnx graphs are MultiDiGraphs; get the shortest edge between current and neighbor
            edge_data = graph.get_edge_data(current, neighbor)
            min_edge_length = min(
                data.get('length', 1) for data in edge_data.values()
            )

            tentative_g_score = g_score[current] + min_edge_length

            if tentative_g_score < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score

                n_y = graph.nodes[neighbor]['y']
                n_x = graph.nodes[neighbor]['x']
                h = haversine_distance(n_y, n_x, goal_y, goal_x)
                f_score[neighbor] = tentative_g_score + h

                if neighbor not in open_set_hash:
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))
                    open_set_hash.add(neighbor)

    return None, float('inf')  # No path found


# --- Example Usage ---
if __name__ == '__main__':
    # 1. Download the drivable street network for a specific area
    place_name = 'Piedmont, California, USA'
    print(f'Downloading street network for {place_name}...')
    G = ox.graph_from_place(place_name, network_type='drive')

    # 2. Define origin and destination coordinates (Latitude, Longitude)
    orig_coords = (37.8244, -122.2316)
    dest_coords = (37.8184, -122.2442)

    # 3. Snap coordinates to the nearest OSM graph nodes
    orig_node = ox.distance.nearest_nodes(G, X=orig_coords[1], Y=orig_coords[0])
    dest_node = ox.distance.nearest_nodes(G, X=dest_coords[1], Y=dest_coords[0])

    # 4. Run custom A* algorithm
    route, total_distance = astar_osm(G, orig_node, dest_node)

    if route:
        print(
            f'Path found! Total nodes: {len(route)}, Distance: {total_distance:.2f} meters'
        )
        # 5. Plot the route on the map
        fig, ax = ox.plot_graph_route(G, route, node_size=0, route_linewidth=4)
    else:
        print('No route could be found between the selected points.')