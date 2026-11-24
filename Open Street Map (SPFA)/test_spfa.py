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
    Node,
    build_graph,
    haversine_meters,
)
from spfa import spfa


class SPFATests(unittest.TestCase):
    def setUp(self):
        self.nodes = {
            node_id: Node(node_id, 10.7, 122.54 + node_id / 1000)
            for node_id in range(1, 6)
        }

    def test_selects_lowest_cost_path(self):
        edges = [
            Edge(1, 2, "A", 10),
            Edge(1, 3, "B", 2),
            Edge(3, 2, "C", 1),
            Edge(2, 4, "D", 5),
            Edge(3, 4, "E", 20),
        ]
        route, cost, *_ = spfa(self.nodes, edges, 1, 4)
        self.assertEqual(route, [1, 3, 2, 4])
        self.assertEqual(cost, 8)

    def test_unreachable_identical_and_one_way_routes(self):
        edges = [Edge(1, 2, "one-way", 4)]
        self.assertEqual(spfa(self.nodes, edges, 1, 2)[:2], ([1, 2], 4))
        route, cost, *_ = spfa(self.nodes, edges, 2, 1)
        self.assertIsNone(route)
        self.assertTrue(math.isinf(cost))
        self.assertEqual(spfa(self.nodes, edges, 1, 1)[:2], ([1], 0))
        self.assertEqual(spfa(self.nodes, edges, 1, 5)[:2], (None, float("inf")))

    def test_iloilo_graph_weight_and_reverse_oneway(self):
        data = {
            "elements": [
                {"type": "node", "id": 1, "lat": 10.7, "lon": 122.54},
                {"type": "node", "id": 2, "lat": 10.7, "lon": 122.541},
                {
                    "type": "way",
                    "nodes": [1, 2],
                    "tags": {
                        "name": "General Luna Street",
                        "oneway": "-1",
                    },
                },
            ]
        }
        nodes, edges = build_graph(
            data, {"General Luna Street": 4.0}, [(10.7, 122.54, 150.0)]
        )
        self.assertEqual([(edge.u, edge.v) for edge in edges], [(2, 1)])
        expected = (
            haversine_meters(nodes[1], nodes[2]) / DEFAULT_SPEED_MPS * 4
            + 60
            + 600
        )
        route, cost, *_ = spfa(nodes, edges, 2, 1)
        self.assertEqual(route, [2, 1])
        self.assertTrue(math.isclose(cost, expected))
        self.assertIsNone(spfa(nodes, edges, 1, 2)[0])

    def test_missing_edges_and_unsupported_weights_are_rejected(self):
        with self.assertRaises(ValueError):
            spfa(self.nodes, [Edge(1, 7, "Missing", 1)], 1, 2)
        for weight in (-1.0, float("nan"), float("inf"), True):
            with self.subTest(weight=weight), self.assertRaises(ValueError):
                spfa(self.nodes, [Edge(1, 2, "Invalid", weight)], 1, 2)


if __name__ == "__main__":
    unittest.main()
