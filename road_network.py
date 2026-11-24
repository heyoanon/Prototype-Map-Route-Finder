import math
from dataclasses import dataclass

import requests


EARTH_RADIUS_METERS = 6_371_000.0
MAX_TRAVEL_SPEED_MPS = 11.11
DEFAULT_SPEED_MPS = MAX_TRAVEL_SPEED_MPS
HINDRANCE_ADDITION_SECONDS = 60.0
HAZARD_PENALTY_SECONDS = 600.0
# Include the western Arevalo/Oton corridor so caller locations are not snapped
# to the graph's boundary before the algorithm starts routing.
ILOILO_BOUNDS = (10.6850, 122.5000, 10.7300, 122.5850)
ROAD_HINDRANCES = {
    "General Luna Street": 4.0,
    "Benigno Aquino Avenue": 3.5,
}
HAZARD_ZONES = [(10.7080, 122.5620, 150.0)]
START_COORDINATES = (10.7150, 122.5510)
GOAL_COORDINATES = (10.6960, 122.5700)
ROAD_TYPES = "trunk|primary|secondary|tertiary|unclassified|residential"


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
    weight: float


def fetch_overpass_roads(
    south: float, west: float, north: float, east: float
) -> dict:
    query = f"""
    [out:json][timeout:25];
    (
      way["highway"~"^({ROAD_TYPES})$"]({south},{west},{north},{east});
    );
    (._;>;);
    out body;
    """
    endpoints = (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    )
    headers = {"User-Agent": "IloiloCARE/1.0"}
    last_error = None

    for url in endpoints:
        try:
            print(f"Trying Overpass server {url}")
            response = requests.post(
                url, data={"data": query}, headers=headers, timeout=6
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError("Overpass response must be a JSON object.")
            print("Road network downloaded successfully!")
            return data
        except (requests.exceptions.RequestException, ValueError) as error:
            last_error = error
            print(f"Server request failed: {error}")

    raise RuntimeError(
        "Unable to download the road network from the available Overpass servers."
    ) from last_error


def build_fallback_osm_data(
    south: float, west: float, north: float, east: float
) -> dict:
    elements = []
    node_id = 1
    grid: list[list[int]] = []
    latitudes = [
        south + (north - south) * index / 5
        for index in range(6)
    ]
    longitudes = [
        west + (east - west) * index / 5
        for index in range(6)
    ]

    for latitude in latitudes:
        row = []
        for longitude in longitudes:
            row.append(node_id)
            elements.append(
                {
                    "type": "node",
                    "id": node_id,
                    "lat": latitude,
                    "lon": longitude,
                }
            )
            node_id += 1
        grid.append(row)

    way_id = 1_000_000
    for row_index, row in enumerate(grid):
        elements.append(
            {
                "type": "way",
                "id": way_id,
                "nodes": row,
                "tags": {"name": f"Fallback Avenue {row_index + 1}"},
            }
        )
        way_id += 1

    for column_index in range(len(longitudes)):
        column = [row[column_index] for row in grid]
        elements.append(
            {
                "type": "way",
                "id": way_id,
                "nodes": column,
                "tags": {"name": f"Fallback Street {column_index + 1}"},
            }
        )
        way_id += 1

    return {"elements": elements}


def haversine_meters(a: Node, b: Node) -> float:
    d_lat = math.radians(b.lat - a.lat)
    d_lon = math.radians(b.lon - a.lon)
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    hav = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    )
    hav = min(1.0, max(0.0, hav))
    return 2 * EARTH_RADIUS_METERS * math.atan2(
        math.sqrt(hav), math.sqrt(1.0 - hav)
    )


def distance_to_segment_meters(center: Node, start: Node, end: Node) -> float:
    center_lat = math.radians(center.lat)

    def local_coordinates(node: Node) -> tuple[float, float]:
        node_lat = math.radians(node.lat)
        delta_lon = math.radians(node.lon - center.lon)
        bearing_x = (
            math.cos(center_lat) * math.sin(node_lat)
            - math.sin(center_lat)
            * math.cos(node_lat)
            * math.cos(delta_lon)
        )
        bearing = math.atan2(
            math.sin(delta_lon) * math.cos(node_lat), bearing_x
        )
        distance = haversine_meters(center, node)
        return distance * math.sin(bearing), distance * math.cos(bearing)

    start_x, start_y = local_coordinates(start)
    end_x, end_y = local_coordinates(end)
    segment_x, segment_y = end_x - start_x, end_y - start_y
    length_squared = segment_x**2 + segment_y**2
    if length_squared == 0:
        return math.hypot(start_x, start_y)

    fraction = -(start_x * segment_x + start_y * segment_y) / length_squared
    fraction = max(0.0, min(1.0, fraction))
    return math.hypot(
        start_x + fraction * segment_x, start_y + fraction * segment_y
    )


def is_finite_number(value: object) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def build_graph(
    osm_data: dict,
    hindered_roads: dict[str, float],
    hazard_zones: list[tuple[float, float, float]],
) -> tuple[dict[int, Node], list[Edge]]:
    if not isinstance(osm_data, dict):
        raise ValueError("OSM data must be a dictionary.")
    if not isinstance(hindered_roads, dict):
        raise ValueError("hindered_roads must be a dictionary.")
    if not isinstance(hazard_zones, list):
        raise ValueError("hazard_zones must be a list.")

    elements = osm_data.get("elements", [])
    if not isinstance(elements, list):
        raise ValueError("OSM elements must be a list.")

    for road_name, multiplier in hindered_roads.items():
        if not isinstance(road_name, str) or not road_name.strip():
            raise ValueError(f"Invalid hindrance road name: {road_name!r}")
        if not is_finite_number(multiplier) or multiplier < 1.0:
            raise ValueError(
                f"Invalid hindrance multiplier for {road_name}: {multiplier}"
            )

    hazard_centers = []
    for zone in hazard_zones:
        try:
            latitude, longitude, radius = zone
        except (TypeError, ValueError):
            raise ValueError(f"Invalid hazard zone: {zone!r}") from None
        if (
            not all(is_finite_number(value) for value in (latitude, longitude, radius))
            or not -90 <= latitude <= 90
            or not -180 <= longitude <= 180
            or radius <= 0
        ):
            raise ValueError(f"Invalid hazard zone: {zone!r}")
        hazard_centers.append((Node(-1, latitude, longitude), radius))

    nodes: dict[int, Node] = {}
    for element in elements:
        if not isinstance(element, dict):
            raise ValueError(f"Invalid OSM element: {element!r}")
        element_type = element.get("type")
        if element_type not in ("node", "way", "relation"):
            raise ValueError(f"Invalid OSM element: {element!r}")
        if element_type != "node":
            continue

        node_id = element.get("id")
        latitude = element.get("lat")
        longitude = element.get("lon")
        if (
            isinstance(node_id, bool)
            or not isinstance(node_id, int)
            or not is_finite_number(latitude)
            or not -90 <= latitude <= 90
            or not is_finite_number(longitude)
            or not -180 <= longitude <= 180
        ):
            raise ValueError(f"Invalid OSM node: {element!r}")
        nodes[node_id] = Node(node_id, latitude, longitude)

    valid_oneway_values = {"yes", "no", "1", "0", "true", "false", "-1"}
    edges = []
    for element in elements:
        if element.get("type") != "way":
            continue

        way_nodes = element.get("nodes")
        if not isinstance(way_nodes, list) or any(
            isinstance(node_id, bool) or not isinstance(node_id, int)
            for node_id in way_nodes
        ):
            raise ValueError(f"Invalid OSM way nodes: {element!r}")

        tags = element.get("tags")
        if not isinstance(tags, dict):
            raise ValueError(f"Invalid OSM way tags: {element!r}")
        road_name = tags.get("name", "Unnamed Road")
        if not isinstance(road_name, str):
            raise ValueError(f"Invalid OSM way road name: {element!r}")

        oneway_value = tags.get("oneway", "no")
        if not isinstance(oneway_value, str):
            raise ValueError(f"Invalid OSM way oneway value: {oneway_value!r}")
        oneway = oneway_value.strip().lower()
        if oneway not in valid_oneway_values:
            raise ValueError(f"Invalid OSM way oneway value: {oneway_value!r}")

        reverse_oneway = oneway == "-1"
        is_oneway = oneway in ("yes", "1", "true", "-1")
        for index in range(len(way_nodes) - 1):
            u_id, v_id = way_nodes[index : index + 2]
            if reverse_oneway:
                u_id, v_id = v_id, u_id

            u, v = nodes.get(u_id), nodes.get(v_id)
            if u is None or v is None:
                continue

            cost = haversine_meters(u, v) / DEFAULT_SPEED_MPS
            multiplier = hindered_roads.get(road_name)
            if multiplier is not None:
                cost = cost * multiplier + HINDRANCE_ADDITION_SECONDS
            for center, radius in hazard_centers:
                if distance_to_segment_meters(center, u, v) <= radius:
                    cost += HAZARD_PENALTY_SECONDS
            if not math.isfinite(cost) or cost < 0:
                raise ValueError(
                    f"Invalid road travel cost for {road_name}: {cost}"
                )

            edges.append(Edge(u_id, v_id, road_name, cost))
            if not is_oneway:
                edges.append(Edge(v_id, u_id, road_name, cost))

    return nodes, edges


def find_nearest_node(nodes: dict[int, Node], latitude: float, longitude: float) -> int:
    if not nodes:
        raise ValueError("Cannot find a nearest node in an empty graph.")
    query = Node(-1, latitude, longitude)
    return min(nodes.values(), key=lambda node: haversine_meters(query, node)).id


__all__ = [
    "DEFAULT_SPEED_MPS",
    "Edge",
    "HAZARD_PENALTY_SECONDS",
    "HAZARD_ZONES",
    "HINDRANCE_ADDITION_SECONDS",
    "ILOILO_BOUNDS",
    "MAX_TRAVEL_SPEED_MPS",
    "Node",
    "ROAD_HINDRANCES",
    "START_COORDINATES",
    "GOAL_COORDINATES",
    "build_graph",
    "distance_to_segment_meters",
    "fetch_overpass_roads",
    "find_nearest_node",
    "haversine_meters",
    "is_finite_number",
]
