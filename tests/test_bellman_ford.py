import unittest

from road_network import Edge, Node
from routing.bellman_ford import bellman_ford


class BellmanFordTests(unittest.TestCase):
    def setUp(self):
        self.nodes = {
            node_id: Node(node_id, 10.7, 122.54 + node_id / 1000)
            for node_id in range(1, 7)
        }

    def test_selects_lowest_cost_directed_path(self):
        edges = [
            Edge(1, 2, "A", 3),
            Edge(2, 4, "B", 2),
            Edge(1, 3, "C", 1),
            Edge(3, 4, "D", 10),
        ]
        route, cost, *_ = bellman_ford(self.nodes, edges, 1, 4)
        self.assertEqual(route, [1, 2, 4])
        self.assertEqual(cost, 5)
        self.assertEqual(bellman_ford(self.nodes, edges, 4, 2)[0], [])

    def test_unreachable_and_identical_endpoints(self):
        edges = [Edge(1, 2, "A", 4)]
        route, cost, *_ = bellman_ford(self.nodes, edges, 1, 5)
        self.assertEqual(route, [])
        self.assertEqual(cost, float("inf"))
        route, cost, *_ = bellman_ford(self.nodes, edges, 1, 1)
        self.assertEqual(route, [1])
        self.assertEqual(cost, 0)

    def test_negative_edges_and_reachable_negative_cycle(self):
        edges = [
            Edge(1, 2, "A", 5),
            Edge(2, 3, "B", -2),
            Edge(3, 4, "C", 1),
            Edge(5, 6, "unreachable", -2),
            Edge(6, 5, "unreachable", 1),
        ]
        route, cost, *_ = bellman_ford(self.nodes, edges[:3], 1, 4)
        self.assertEqual(route, [1, 2, 3, 4])
        self.assertEqual(cost, 4)
        bellman_ford(self.nodes, edges, 1, 4)

        with self.assertRaisesRegex(ValueError, "Negative-weight cycle"):
            bellman_ford(
                self.nodes,
                [Edge(1, 2, "A", 1), Edge(2, 1, "B", -2)],
                1,
                4,
            )

    def test_invalid_edges_and_unknown_endpoints(self):
        with self.assertRaisesRegex(ValueError, "missing node"):
            bellman_ford(self.nodes, [Edge(1, 7, "Missing", 1)], 1, 2)
        for weight in (True, float("nan"), float("inf"), "1"):
            with self.subTest(weight=weight), self.assertRaises(ValueError):
                bellman_ford(self.nodes, [Edge(1, 2, "Invalid", weight)], 1, 2)
        self.assertEqual(
            bellman_ford(self.nodes, [], 99, 2)[:2], ([], float("inf"))
        )


if __name__ == "__main__":
    unittest.main()
