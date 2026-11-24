import json
import math
from pathlib import Path
import sys
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import server
import routing_api
from road_network import Edge, Node
from routing_api import (
    ApiRequestError,
    GraphCache,
    GraphUnavailableError,
    RoutingApi,
)


def synthetic_graph():
    nodes = {
        1: Node(1, 10.700, 122.540),
        2: Node(2, 10.700, 122.541),
        3: Node(3, 10.701, 122.541),
        4: Node(4, 10.702, 122.542),
    }
    edges = [
        Edge(1, 2, "Road A", 10),
        Edge(2, 3, "Road B", 20),
        Edge(1, 3, "Direct Road", 25),
        Edge(3, 4, "Road C", 30),
        Edge(4, 2, "No return test", 100),
    ]
    return nodes, edges


class RoutingApiTests(unittest.TestCase):
    def setUp(self):
        self.graph = synthetic_graph()
        self.load_count = 0

        def loader():
            self.load_count += 1
            return self.graph

        self.api = RoutingApi(GraphCache(loader, ttl_seconds=300))

    def test_each_algorithm_endpoint_result_is_consistent(self):
        for algorithm in ("bellman_ford", "spfa", "a_star"):
            with self.subTest(algorithm=algorithm):
                result = self.api.route(10.700, 122.540, 10.701, 122.541, algorithm)
                self.assertEqual(result["route_node_ids"], [1, 3])
                self.assertEqual(result["travel_time_seconds"], 25)
                self.assertGreaterEqual(result["execution_time_seconds"], 0)
                self.assertGreaterEqual(result["peak_traced_memory_bytes"], 0)
                self.assertIsInstance(result["route_coordinates"], list)

    def test_compare_all_reuses_one_graph_and_equal_costs(self):
        result = self.api.route(
            10.700,
            122.540,
            10.701,
            122.541,
            "all",
        )
        self.assertEqual(result["graph"]["node_count"], 4)
        self.assertEqual(result["graph"]["edge_count"], 5)
        self.assertEqual(self.load_count, 1)
        costs = [item["travel_time_seconds"] for item in result["results"]]
        self.assertTrue(all(math.isclose(cost, costs[0]) for cost in costs))
        self.api.route(10.700, 122.540, 10.701, 122.541, "spfa")
        self.assertEqual(self.load_count, 1)
        self.assertTrue(result["graph"]["cached"] is False)

    def test_unreachable_destination_is_reported_without_a_route(self):
        result = self.api.route(10.700, 122.540, 10.702, 122.542, "spfa")
        self.assertEqual(result["route_node_ids"], [1, 3, 4])
        isolated_nodes, isolated_edges = synthetic_graph()
        isolated_nodes[5] = Node(5, 11.0, 123.0)
        api = RoutingApi(GraphCache(lambda: (isolated_nodes, isolated_edges)))
        result = api.route(10.700, 122.540, 11.0, 123.0, "a_star")
        self.assertIsNone(result["travel_time_seconds"])
        self.assertEqual(result["route_node_ids"], [])

    def test_coordinate_validation_and_snapping(self):
        for values in (
            (91, 122, 10, 122),
            (10, 181, 10, 122),
            (True, 122, 10, 122),
            (10, float("inf"), 10, 122),
        ):
            with self.subTest(values=values):
                with self.assertRaises(ApiRequestError):
                    self.api.route(*values, "a_star")
        with self.assertRaises(ApiRequestError):
            self.api.route(10.700, 122.540, 10.701, 122.541, "unknown")

        result = self.api.route(10.7001, 122.5401, 10.7000, 122.5409, "a_star")
        self.assertEqual(result["route_node_ids"][0], 1)
        self.assertEqual(result["route_node_ids"][-1], 2)

    def test_osm_loader_failure_is_clear(self):
        def fail():
            raise RuntimeError("Overpass unavailable")

        api = RoutingApi(GraphCache(fail))
        with self.assertRaises(GraphUnavailableError):
            api.route(10.700, 122.540, 10.701, 122.541, "bellman_ford")

    @patch.object(
        routing_api,
        "fetch_overpass_roads",
        side_effect=RuntimeError("Overpass unavailable"),
    )
    def test_live_loader_uses_fallback_when_overpass_is_unavailable(self, fetch):
        nodes, edges = routing_api.load_live_graph()
        self.assertGreater(len(nodes), 0)
        self.assertGreater(len(edges), 0)


class RoutingHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        nodes, edges = synthetic_graph()
        cls.api = RoutingApi(GraphCache(lambda: (nodes, edges)))
        cls.original_api = server.ROUTING_API
        server.ROUTING_API = cls.api
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.LocalhostRequestHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.httpd.server_port}/api/route"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)
        server.ROUTING_API = cls.original_api

    def post(self, payload):
        request = Request(
            self.url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            return error.code, json.loads(error.read().decode("utf-8"))

    def test_http_individual_and_compare_all_requests(self):
        for algorithm in ("bellman_ford", "spfa", "a_star"):
            status, body = self.post({
                "origin_lat": 10.700,
                "origin_lon": 122.540,
                "destination_lat": 10.701,
                "destination_lon": 122.541,
                "algorithm": algorithm,
            })
            self.assertEqual(status, 200)
            self.assertEqual(body["route_node_ids"], [1, 3])

        status, body = self.post({
            "origin_lat": 10.700,
            "origin_lon": 122.540,
            "destination_lat": 10.701,
            "destination_lon": 122.541,
            "algorithm": "all",
        })
        self.assertEqual(status, 200)
        self.assertEqual(len(body["results"]), 3)

    def test_http_missing_parameters_and_invalid_coordinates(self):
        status, body = self.post({"algorithm": "a_star"})
        self.assertEqual(status, 400)
        self.assertIn("missing", body)

        status, body = self.post({
            "origin_lat": 91,
            "origin_lon": 122,
            "destination_lat": 10,
            "destination_lon": 122,
            "algorithm": "a_star",
        })
        self.assertEqual(status, 400)
        self.assertIn("error", body)


if __name__ == "__main__":
    unittest.main()
