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
python "Open Street Map (Bellmans - Ford)\bellman_ford.py"
python "Open Street Map (SPFA)\spfa.py"
python "Open Street Map - A Star\a_star.py"
```

Each `network.py` module is a compatibility facade for the shared graph API;
running one delegates to the corresponding algorithm entry point. Tests are
separate from algorithm implementations and are included in the unified test
command above.

The unified benchmark downloads and constructs the graph once, snaps the same
endpoints once, and runs all three algorithms on those same node and edge
objects:

```powershell
python "Open Street Map (Bellmans - Ford)\benchmark.py"
```

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

The implementations live in `Open Street Map (Bellmans - Ford)\bellman_ford.py`,
`Open Street Map (SPFA)\spfa.py`, and `Open Street Map - A Star\a_star.py`.
Their adjacent `network.py` files re-export graph construction utilities from
`road_network.py`; they do not contain duplicate algorithm implementations.

## Benchmark metrics

Download, graph construction, and endpoint snapping are outside the execution
timers and memory measurements. The same graph and endpoints are passed to
each algorithm; algorithm-local edge validation and adjacency construction
are measured as part of the call. Peak memory is measured with `tracemalloc`
for each call separately. The benchmark validates every returned route against
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
