# Python Routing Backend

Run commands from the repository root with Python 3.10 or newer.

## Setup and commands

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

Each algorithm command fetches the configured Iloilo graph from Overpass:

```powershell
python -m routing.bellman_ford
python -m routing.spfa
python -m routing.a_star
```

The algorithms and benchmark live together in the root `routing/` package.
Tests are in the root `tests/` directory and run with the unified test command
above.

The unified benchmark downloads and constructs the graph once, snaps the same
endpoints once, and runs all three algorithms on those same node and edge
objects:

```powershell
python -m routing.benchmark
```

The threaded local server serves the static app and routing API on loopback:

```powershell
python server.py
```

Send `POST /api/route` with `Content-Type: application/json`:

```json
{
  "origin_lat": 10.715,
  "origin_lon": 122.551,
  "destination_lat": 10.696,
  "destination_lon": 122.570,
  "algorithm": "bellman_ford"
}
```

Use `"spfa"`, `"a_star"`, or `"all"` for the algorithm field. `bellman-ford`,
`bellman_ford`, `Bellman-Ford`, `a*`, `a_star`, and `astar` are also accepted.
Successful responses include route node IDs and coordinates, travel time,
route distance, execution time, peak traced memory, and algorithm counters.
The API caches one successfully downloaded live graph in memory for 300 seconds
and reuses that graph for all algorithms in an `"all"` request. `GET /api/route`
is not supported; send a JSON `POST`. Local request bodies are capped at 16 KiB.

Vercel deploys [`api/route.py`](api/route.py) as the Python Function for the
same endpoint. Its warm function instance holds the in-memory graph cache. It
has a 60-second configured function duration and each Overpass endpoint request
times out after 20 seconds; graph downloads and Bellman-Ford runs can still be
limited by the hosting plan's execution ceiling.

The map's **Routing engine** selector sends coordinates to this endpoint for
Bellman-Ford, SPFA, A*, or an all-algorithm comparison. OSRM remains the default
for road-shaped routes and turn-by-turn directions. The Python algorithms return
graph routes and work counters; they do not provide street names or turn
instructions. Each algorithm card displays its execution time, peak traced
memory, explored nodes, and edge checks.

Tests use synthetic data and do not call Overpass. Algorithm and benchmark
commands require an internet connection to Overpass; the downloader tries a
second public endpoint if the first fails.

## Shared graph and cost model

[`road_network.py`](road_network.py) owns the OSM data model and graph builder
used by all three algorithms. The study-area bounds, selected
road classes, default speed, hindrances, flood zone, and route endpoints retain
the established Iloilo values:

- Bounds: `(10.6900, 122.5400, 10.7250, 122.5800)`.
- Road classes: trunk, primary, secondary, tertiary, unclassified, residential.
- Default speed: `11.11 m/s` (approximately 40 km/h); edge weights are seconds.
- General Luna Street: multiplier `4.0` and 60 additional seconds.
- Benigno Aquino Avenue: multiplier `3.5` and 60 additional seconds.
- Flood zone: `(10.7080, 122.5620, 150 m)` with a 600-second segment penalty.

OSM one-way tags are retained as directed edges; `oneway=-1` reverses way-node
order. Ways with valid structure but missing node references are skipped.
Invalid coordinates, way records, restrictions, penalties, and non-finite or
negative generated travel costs are rejected.

The hazard calculation projects the short local road segment into a
hazard-centered tangent plane and measures the closest point on that segment.
This local approximation is suitable for the Iloilo study area and preserves
endpoint-inside and tangent intersections without double-counting a zone.

## Algorithms

- **Bellman–Ford** scans the directed edge list, supports finite negative edge
  weights, and raises `ValueError` for a negative cycle reachable from the
  source. Unreachable negative cycles do not affect a route.
- **SPFA** uses a FIFO queue and an `in_queue` set to enqueue improved nodes
  only when necessary. It rejects every negative edge, so negative-cycle
  behavior is explicitly unsupported.
- **A*** uses `heapq`, `g`/`f` scores, predecessors, and skips stale heap
  entries. Its heuristic is great-circle distance divided by `11.11 m/s`.
  A* uses that heuristic only when all node coordinates are valid and every
  edge weight is at least the edge's great-circle travel-time lower bound.
  Otherwise it falls back to a zero heuristic, preserving optimality for
  arbitrary nonnegative weighted graphs.

All three accept the same directed node/edge graph and return travel time in
seconds. SPFA and A* reject negative weights; the common road builder produces
nonnegative weights.

The implementations live in `routing/bellman_ford.py`, `routing/spfa.py`, and
`routing/a_star.py`. The shared graph data model and graph builder live in
`road_network.py`.

## Benchmark metrics

Download, graph construction, and endpoint snapping are outside measurements.
The benchmark runs one timed pass without `tracemalloc`, then a separate memory
pass with `tracemalloc`. Both passes use the same graph and endpoints.
Algorithm-local edge validation and adjacency construction are included in the
respective measurement. The benchmark validates every returned route against
directed edges and confirms that all reported route costs agree.

Counters are algorithm-specific and should not be read as equivalent work:

- `nodes_processed`: Bellman–Ford counts reachable edge-source visits during
  relaxation passes; SPFA counts queue pops; A* counts non-stale heap pops.
- `unique_explored_nodes`: Bellman–Ford counts finite-distance nodes; SPFA
  counts unique dequeued nodes; A* counts unique nodes expanded from valid
  heap entries.
- `edge_checks`: Bellman–Ford includes complete edge scans plus the
  negative-cycle check; SPFA and A* count outgoing edges relaxed from processed
  nodes.
- `successful_relaxations`: strict distance improvements in each algorithm.
- `iterations`: Bellman–Ford relaxation passes; not applicable to SPFA or A*.
- Route cost and route-node count are directly comparable.
