import math
import unittest
from unittest.mock import Mock, patch

import requests

import road_network
from road_network import DEFAULT_SPEED_MPS, Edge, Node, haversine_meters


from routing import benchmark


def travel_time(nodes: dict[int, Node], u: int, v: int, penalty: float = 0.0) -> float:
    return haversine_meters(nodes[u], nodes[v]) / DEFAULT_SPEED_MPS + penalty


def osm_with_way(tags: dict | None = None, way_nodes=None) -> dict:
    return {
        "elements": [
            {"type": "node", "id": 1, "lat": 0.0, "lon": -0.001},
            {"type": "node", "id": 2, "lat": 0.0, "lon": 0.001},
            {
                "type": "way",
                "nodes": [1, 2] if way_nodes is None else way_nodes,
                "tags": {"name": "Test Road"} if tags is None else tags,
            },
        ]
    }


class GraphBuilderTests(unittest.TestCase):
    def test_oneway_direction_and_missing_node_references(self):
        elements = [
            {"type": "node", "id": node_id, "lat": 0.0, "lon": node_id / 1000}
            for node_id in range(1, 5)
        ]
        elements.extend(
            [
                {"type": "way", "nodes": [1, 2], "tags": {"oneway": "yes"}},
                {"type": "way", "nodes": [2, 3], "tags": {"oneway": "-1"}},
                {"type": "way", "nodes": [3, 4], "tags": {"oneway": "no"}},
                {"type": "way", "nodes": [4, 999], "tags": {"oneway": "yes"}},
            ]
        )
        nodes, edges = road_network.build_graph(
            {"elements": elements}, {}, []
        )
        self.assertEqual(
            [(edge.u, edge.v) for edge in edges],
            [(1, 2), (3, 2), (3, 4), (4, 3)],
        )
        self.assertEqual(set(nodes), {1, 2, 3, 4})
        self.assertTrue(
            all(math.isfinite(edge.weight) and edge.weight >= 0 for edge in edges)
        )

    def test_travel_time_hindrance_and_crossing_hazard(self):
        data = osm_with_way()
        nodes, baseline_edges = road_network.build_graph(data, {}, [])
        _, hindered_edges = road_network.build_graph(
            data, {"Test Road": 4.0}, []
        )
        _, hazard_edges = road_network.build_graph(
            data, {}, [(0.0, 0.0, 10.0)]
        )
        baseline = travel_time(nodes, 1, 2)
        self.assertAlmostEqual(baseline_edges[0].weight, baseline)
        self.assertAlmostEqual(hindered_edges[0].weight, baseline * 4 + 60)
        self.assertAlmostEqual(hazard_edges[0].weight, baseline + 600)

    def test_invalid_container_and_hazard_inputs(self):
        for hindered_roads in (None, [], "roads"):
            with self.subTest(hindered_roads=hindered_roads):
                with self.assertRaisesRegex(ValueError, "hindered_roads"):
                    road_network.build_graph({"elements": []}, hindered_roads, [])
        for zones in (None, (), "zone"):
            with self.subTest(zones=zones):
                with self.assertRaisesRegex(ValueError, "hazard_zones"):
                    road_network.build_graph({"elements": []}, {}, zones)
        for zone in (
            (0.0, 181.0, 1.0),
            (91.0, 0.0, 1.0),
            (0.0, 0.0, 0.0),
            (0.0, 0.0, float("inf")),
            (0.0, 0.0),
        ):
            with self.subTest(zone=zone), self.assertRaises(ValueError):
                road_network.build_graph({"elements": []}, {}, [zone])

    def test_invalid_hindrance_multipliers(self):
        for multiplier in (0.99, float("nan"), float("inf"), True, "2"):
            with self.subTest(multiplier=multiplier), self.assertRaises(ValueError):
                road_network.build_graph(
                    {"elements": []}, {"Test Road": multiplier}, []
                )
        for road_name in ("", 1):
            with self.subTest(road_name=road_name), self.assertRaises(ValueError):
                road_network.build_graph(
                    {"elements": []}, {road_name: 2.0}, []
                )

    def test_invalid_osm_nodes_and_elements(self):
        invalid_elements = (
            [None],
            [{"type": "unknown"}],
            [{"type": "node", "id": 1, "lat": 91, "lon": 0}],
            [{"type": "node", "id": 1, "lat": 0, "lon": 181}],
            [{"type": "node", "id": 1, "lat": float("nan"), "lon": 0}],
            [{"type": "node", "id": 1, "lat": 0, "lon": float("inf")}],
        )
        for elements in invalid_elements:
            with self.subTest(elements=elements), self.assertRaises(ValueError):
                road_network.build_graph({"elements": elements}, {}, [])
        with self.assertRaisesRegex(ValueError, "elements"):
            road_network.build_graph({"elements": {}}, {}, [])

    def test_malformed_ways_are_value_errors(self):
        malformed = (
            osm_with_way(way_nodes="1,2"),
            osm_with_way(tags=[]),
            osm_with_way(tags={"oneway": 1}),
            osm_with_way(tags={"name": ["not", "a", "name"]}),
            osm_with_way(way_nodes=[1, True]),
        )
        for data in malformed:
            with self.subTest(data=data), self.assertRaises(ValueError):
                road_network.build_graph(data, {}, [])
        for way in (None,):
            with self.assertRaisesRegex(ValueError, "OSM element"):
                road_network.build_graph({"elements": [way]}, {}, [])

    @patch.object(road_network.requests, "post")
    def test_overpass_falls_back_to_second_endpoint(self, post):
        response = Mock()
        response.json.return_value = {"elements": []}
        post.side_effect = [requests.Timeout("primary unavailable"), response]
        self.assertEqual(
            road_network.fetch_overpass_roads(1, 2, 3, 4), {"elements": []}
        )
        self.assertEqual(post.call_count, 2)

    @patch.object(road_network.requests, "post")
    def test_overpass_reports_when_both_endpoints_fail(self, post):
        post.side_effect = requests.Timeout("unavailable")
        with self.assertRaisesRegex(RuntimeError, "either Overpass server"):
            road_network.fetch_overpass_roads(1, 2, 3, 4)
        self.assertEqual(post.call_count, 2)


class BenchmarkTests(unittest.TestCase):
    def test_algorithms_share_graph_and_return_equal_costs(self):
        nodes = {
            1: Node(1, 10.700, 122.540),
            2: Node(2, 10.700, 122.550),
            3: Node(3, 10.710, 122.540),
            4: Node(4, 10.710, 122.550),
        }
        edges = [
            Edge(1, 2, "A", travel_time(nodes, 1, 2, 100)),
            Edge(2, 4, "B", travel_time(nodes, 2, 4)),
            Edge(1, 3, "C", travel_time(nodes, 1, 3)),
            Edge(3, 4, "D", travel_time(nodes, 3, 4)),
            Edge(1, 4, "E", travel_time(nodes, 1, 4, 200)),
        ]
        results = benchmark.run_benchmark(nodes, edges, 1, 4)
        self.assertEqual(
            [result.name for result in results], ["Bellman-Ford", "SPFA", "A*"]
        )
        self.assertTrue(
            all(
                math.isclose(
                    result.route_cost_seconds,
                    results[0].route_cost_seconds,
                    rel_tol=1e-9,
                    abs_tol=1e-6,
                )
                for result in results
            )
        )
        self.assertTrue(all(result.peak_memory_bytes >= 0 for result in results))


if __name__ == "__main__":
    unittest.main()
