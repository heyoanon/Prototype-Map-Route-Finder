from pathlib import Path
import math
import sys
import unittest

_project_root = Path(__file__).resolve().parents[1]
_algorithm_dir = Path(__file__).resolve().parent
for _path in (_project_root, _algorithm_dir):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from road_network import (
    DEFAULT_SPEED_MPS,
    Edge,
    HAZARD_ZONES,
    Node,
    ROAD_HINDRANCES,
    build_graph,
    haversine_meters,
)
from a_star import astar, time_heuristic


def travel_time(nodes: dict[int, Node], u: int, v: int, penalty: float = 0.0) -> float:
    return haversine_meters(nodes[u], nodes[v]) / DEFAULT_SPEED_MPS + penalty


class AStarTests(unittest.TestCase):
    def setUp(self):
        self.nodes = {
            1: Node(1, 10.700, 122.540),
            2: Node(2, 10.700, 122.550),
            3: Node(3, 10.710, 122.540),
            4: Node(4, 10.710, 122.550),
            5: Node(5, 10.720, 122.560),
        }

    def test_shortest_path_cost_route_and_admissible_heuristic(self):
        edges = [
            Edge(1, 2, "slow", travel_time(self.nodes, 1, 2, 400)),
            Edge(2, 4, "slow", travel_time(self.nodes, 2, 4)),
            Edge(1, 3, "fast", travel_time(self.nodes, 1, 3)),
            Edge(3, 4, "fast", travel_time(self.nodes, 3, 4)),
            Edge(1, 4, "direct", travel_time(self.nodes, 1, 4, 300)),
        ]
        route, cost = astar(self.nodes, edges, 1, 4)
        self.assertEqual(route, [1, 3, 4])
        self.assertAlmostEqual(cost, edges[2].weight + edges[3].weight, places=8)
        self.assertLessEqual(time_heuristic(self.nodes, 1, 4), cost)

    def test_inadmissible_geographic_estimate_falls_back_to_zero(self):
        nodes = {
            1: Node(1, 0.0, 0.0),
            2: Node(2, 0.0, 0.1),
            3: Node(3, 0.0, 0.01),
        }
        edges = [
            Edge(1, 3, "cheap direct", 50),
            Edge(1, 2, "short leg", 1),
            Edge(2, 3, "short leg", 1),
        ]
        self.assertGreater(time_heuristic(nodes, 1, 3), 50)
        route, cost = astar(nodes, edges, 1, 3)
        self.assertEqual(route, [1, 2, 3])
        self.assertEqual(cost, 2)

    def test_canonical_graph_builder_costs_remain_optimal(self):
        osm_data = {
            "elements": [
                {"type": "node", "id": 1, "lat": 10.700, "lon": 122.540},
                {"type": "node", "id": 2, "lat": 10.700, "lon": 122.541},
                {"type": "node", "id": 3, "lat": 10.701, "lon": 122.540},
                {"type": "node", "id": 4, "lat": 10.701, "lon": 122.541},
                {
                    "type": "way",
                    "nodes": [1, 2],
                    "tags": {
                        "highway": "residential",
                        "name": "General Luna Street",
                        "oneway": "yes",
                    },
                },
                {
                    "type": "way",
                    "nodes": [2, 4],
                    "tags": {
                        "highway": "residential",
                        "name": "General Luna Street",
                        "oneway": "yes",
                    },
                },
                {
                    "type": "way",
                    "nodes": [1, 3],
                    "tags": {
                        "highway": "residential",
                        "name": "Local Road",
                        "oneway": "yes",
                    },
                },
                {
                    "type": "way",
                    "nodes": [3, 4],
                    "tags": {
                        "highway": "residential",
                        "name": "Local Road",
                        "oneway": "yes",
                    },
                },
            ]
        }
        nodes, edges = build_graph(osm_data, ROAD_HINDRANCES, HAZARD_ZONES)
        weights = {(edge.u, edge.v): edge.weight for edge in edges}
        expected_cost = weights[1, 3] + weights[3, 4]
        route, cost = astar(nodes, edges, 1, 4)
        self.assertEqual(route, [1, 3, 4])
        self.assertAlmostEqual(cost, expected_cost)
        self.assertLess(cost, weights[1, 2] + weights[2, 4])

    def test_stale_entries_and_unreachable_destination(self):
        edges = [
            Edge(1, 2, "expensive", travel_time(self.nodes, 1, 2, 2000)),
            Edge(1, 3, "first", travel_time(self.nodes, 1, 3)),
            Edge(3, 2, "better", travel_time(self.nodes, 3, 2)),
        ]
        metrics = {}
        route, cost = astar(self.nodes, edges, 1, 5, metrics=metrics)
        self.assertIsNone(route)
        self.assertTrue(math.isinf(cost))
        self.assertEqual(metrics["nodes_processed"], 3)

    def test_identical_and_directed_endpoints(self):
        edge = Edge(1, 4, "one-way", travel_time(self.nodes, 1, 4))
        self.assertEqual(astar(self.nodes, [edge], 1, 1), ([1], 0.0))
        self.assertEqual(astar(self.nodes, [edge], 4, 1), (None, float("inf")))
        self.assertEqual(time_heuristic(self.nodes, 4, 4), 0.0)
        self.assertLessEqual(
            time_heuristic(self.nodes, edge.u, 4),
            edge.weight + time_heuristic(self.nodes, edge.v, 4) + 1e-8,
        )

    def test_invalid_edges_and_unknown_endpoints(self):
        with self.assertRaises(ValueError):
            astar(self.nodes, [Edge(1, 6, "Missing", 1.0)], 1, 4)
        for weight in (-1.0, float("nan"), float("inf"), True):
            with self.subTest(weight=weight), self.assertRaises(ValueError):
                astar(self.nodes, [Edge(1, 4, "Invalid", weight)], 1, 4)
        self.assertEqual(astar(self.nodes, [], 99, 4), (None, float("inf")))


if __name__ == "__main__":
    unittest.main()
