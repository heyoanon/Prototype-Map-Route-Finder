from pathlib import Path
import sys

_project_root = Path(__file__).resolve().parents[1]
_algorithm_dir = Path(__file__).resolve().parent
for _path in (_project_root, _algorithm_dir):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from road_network import (
    DEFAULT_SPEED_MPS,
    Edge,
    HAZARD_PENALTY_SECONDS,
    HAZARD_ZONES,
    HINDRANCE_ADDITION_SECONDS,
    ILOILO_BOUNDS,
    MAX_TRAVEL_SPEED_MPS,
    Node,
    ROAD_HINDRANCES,
    START_COORDINATES,
    GOAL_COORDINATES,
    build_graph,
    distance_to_segment_meters,
    fetch_overpass_roads,
    find_nearest_node,
    haversine_meters,
    is_finite_number,
)

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


def main() -> None:
    from spfa import main as run_spfa

    run_spfa()


if __name__ == "__main__":
    main()
