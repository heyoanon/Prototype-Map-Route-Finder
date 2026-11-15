import math
import requests
from dataclasses import dataclass

@dataclass
class Node:
    id: int
    lat: float
    lon: float

@dataclass
class Edge:
    u: int
    v: int
    road_name: str
    weight: float  # Travel cost in seconds


# 1. Fetch raw road network from Overpass API
def fetch_overpass_roads(south: float, west: float, north: float, east: float) -> dict:
    query = f"""
    [out:json][timeout:25];
    (
      way["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential)$"]({south},{west},{north},{east});
    );
    (._;>;);
    out body;
    """
    url = "https://overpass-api.de/api/interpreter"
    headers = {"User-Agent": "BellmanFordRouter/1.0"}
    response = requests.post(url, data={"data": query}, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


# 2. Haversine formula to calculate physical distance in meters
def haversine_meters(a: Node, b: Node) -> float:
    R = 6371000.0
    d_lat = math.radians(b.lat - a.lat)
    d_lon = math.radians(b.lon - a.lon)
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)

    h = (math.sin(d_lat / 2) ** 2 +
         math.cos(lat1) * math.cos(lat2) * (math.sin(d_lon / 2) ** 2))
    return 2 * R * math.atan2(math.sqrt(h), math.sqrt(1 - h))


# 3. Build directed graph & apply hindrance penalties (or negative-weight incentives)
def build_graph(osm_data: dict, hindered_roads: dict[str, float], hazard_zones: list[tuple[float, float, float]]):
    nodes: dict[int, Node] = {}
    edges: list[Edge] = []

    # First pass: collect all nodes (intersections/geometry points)
    for el in osm_data.get("elements", []):
        if el["type"] == "node":
            nodes[el["id"]] = Node(el["id"], el["lat"], el["lon"])

    # Second pass: convert ways into directed edges
    for el in osm_data.get("elements", []):
        if el["type"] != "way":
            continue

        way_nodes = el.get("nodes", [])
        tags = el.get("tags", {})
        road_name = tags.get("name", "Unnamed Road")
        is_oneway = tags.get("oneway", "no").lower() == "yes"
        speed_mps = 11.11  # ~40 km/h default urban speed

        for i in range(len(way_nodes) - 1):
            u_id, v_id = way_nodes[i], way_nodes[i + 1]
            u, v = nodes.get(u_id), nodes.get(v_id)
            if not u or not v:
                continue

            base_time = haversine_meters(u, v) / speed_mps
            cost = base_time

            # Hindrance Type A: Named road congestion / construction multiplier
            if road_name in hindered_roads:
                cost = cost * hindered_roads[road_name] + 60.0

            # Hindrance Type B: Spatial hazard zone (e.g., flooded area within radius in meters)
            for h_lat, h_lon, h_radius in hazard_zones:
                hazard_center = Node(-1, h_lat, h_lon)
                if haversine_meters(u, hazard_center) <= h_radius or haversine_meters(v, hazard_center) <= h_radius:
                    cost += 600.0  # Heavy +10 min penalty to route around flood/blockage

            edges.append(Edge(u_id, v_id, road_name, cost))
            if not is_oneway:
                edges.append(Edge(v_id, u_id, road_name, cost))

    return nodes, edges


# 4. Bellman-Ford Shortest Path Algorithm
def bellman_ford(nodes: dict[int, Node], edges: list[Edge], source: int, target: int):
    dist = {node_id: float("inf") for node_id in nodes}
    parent: dict[int, int] = {}
    dist[source] = 0.0

    num_vertices = len(nodes)

    # Relax all edges |V| - 1 times (with early termination when converged)
    for iteration in range(num_vertices - 1):
        updated = False
        for edge in edges:
            if dist[edge.u] != float("inf") and dist[edge.u] + edge.weight < dist[edge.v]:
                dist[edge.v] = dist[edge.u] + edge.weight
                parent[edge.v] = edge.u
                updated = True
        if not updated:
            print(f"Converged early at iteration {iteration + 1}/{num_vertices - 1}")
            break

    # Negative-weight cycle check
    for edge in edges:
        if dist[edge.u] != float("inf") and dist[edge.u] + edge.weight < dist[edge.v]:
            raise ValueError("Negative-weight cycle detected in the road network!")

    if dist[target] == float("inf"):
        return [], float("inf")

    # Reconstruct path from target back to source
    path = []
    curr = target
    while curr is not None:
        path.append(curr)
        curr = parent.get(curr)
    path.reverse()

    return path, dist[target]


# Helper: Snap any (lat, lon) coordinate to the closest OSM road node
def find_nearest_node(nodes: dict[int, Node], lat: float, lon: float) -> int:
    query = Node(-1, lat, lon)
    return min(nodes.values(), key=lambda n: haversine_meters(query, n)).id


if __name__ == "__main__":
    # Bounding box for central Iloilo City (south, west, north, east)
    osm_json = fetch_overpass_roads(10.6900, 122.5400, 10.7250, 122.5800)

    # Define hindrances:
    # 1. Road-name multipliers (e.g., 4.0x slower due to roadwork/traffic)
    road_hindrances = {
        "General Luna Street": 4.0,
        "Benigno Aquino Avenue": 3.5,
    }
    # 2. Coordinate-based hazard zones: (lat, lon, radius_in_meters)
    flood_zones = [
        (10.7080, 122.5620, 150.0)
    ]

    nodes, edges = build_graph(osm_json, road_hindrances, flood_zones)
    print(f"Graph built: {len(nodes)} nodes, {len(edges)} directed edges")

    start_id = find_nearest_node(nodes, 10.7150, 122.5510)
    end_id = find_nearest_node(nodes, 10.6960, 122.5700)

    route_ids, total_seconds = bellman_ford(nodes, edges, start_id, end_id)

    if route_ids:
        print(f"Shortest path found ({len(route_ids)} nodes) | Estimated Cost: {total_seconds:.1f}s")
        # Convert node IDs into [lat, lon] pairs ready for Leaflet or GeoJSON export
        route_coords = [[nodes[nid].lat, nodes[nid].lon] for nid in route_ids]
        print("First 5 waypoints:", route_coords[:5])
    else:
        print("No valid path found between origin and destination.")