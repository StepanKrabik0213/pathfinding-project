# Humanitarian Route Planner: Dijkstra vs A* (CSCI218 Topic 8)

Finds the shortest route on a 2D grid from a start (Dubai) to a goal (a crisis
destination) when some cells are unavailable (closed airports, ports or roads).
Compares Dijkstra's algorithm and A* search on execution time, nodes expanded
and path cost. The map is an illustrative model, not real operational data.

## Requirements
- Python 3.10 or newer
- pygame (grid window), pytest (tests), matplotlib (experiment graphs and report figures)

## Install
```bash
git clone <repository-url>
cd pathfinding-project
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run the simulation
```bash
python main.py
```
| Control | Action |
|---|---|
| Click / drag on grid (Wall tool) | Block or unblock cells |
| Start / Goal tool, then click | Move the start or goal |
| Run Dijkstra / Run A* / Run both (keys 1, 2, 3) | Search and show result |
| Switch view | Toggle between the two algorithms' results |
| Clear path (C) | Remove results, keep the map |
| Reset grid | Open all cells |
| Scenario map (S), Unreachable demo | Built-in maps |
| New random map (N), Density -/+, Size | Random layouts (10/20/30/40%, 10x10, 25x25, 50x50) |

Colours: green = start, red = goal, dark = closed route, blue/green tint = explored
cells (Dijkstra/A*), orange = final path. Each result card shows whether a path was
found, its cost, nodes expanded and time.

## Run the tests
```bash
python -m pytest tests
```

## Project layout
| File | Owner |
|---|---|
| `main.py`, `grid.py`, `README.md`, `requirements.txt`, `INTERFACE.md` | Member 1 |
| `dijkstra.py`, `tests/test_dijkstra.py`, `dijkstra_benchmark.py` | Member 2 |
| `astar.py`, `tests/test_astar.py`, `astar_benchmark.py` | Member 3 |
| `experiments.py`, `tests/test_experiments.py`, `results/` | Member 4 |
| `report/Final_Report.docx` / `.pdf` (combined report), `report/build_final.js` | All members (assembled by Member 4) |

Module instructions from Members 2 to 4:

**Member 2, Dijkstra (`dijkstra.py`).** Final version, follows `INTERFACE.md`.
- Use it directly: `import dijkstra; res = dijkstra.solve(grid, grid.start, grid.goal)`
- Unit tests: `python -m pytest tests/test_dijkstra.py -v` (57 tests)
- Record metrics: `python dijkstra_benchmark.py` writes `results/dijkstra_metrics.csv`
  (10x10 to 100x100, 10/20/30% obstacles, 10 seeded maps each, median of 5 timings)
- Report figures: `python report/m2_figures.py` (saved in `report/screenshots_m2/`)

**Member 3, A\* (`astar.py`).** Final version, follows `INTERFACE.md`; Manhattan heuristic.
- Use it directly: `import astar; res = astar.solve(grid, grid.start, grid.goal)`
- Unit tests: `python -m pytest tests/test_astar.py -v` (39 tests)
- Record metrics: `python astar_benchmark.py` writes `results/astar_metrics.csv`

**Member 4, experiments (`experiments.py`).** Fair Dijkstra vs A* comparison.
- Full run (about 1 to 2 minutes): `python experiments.py`
  - 10x10, 25x25, 50x50, 100x100 grids; 10/20/30% obstacles; 10 seeded maps each;
    two start/goal placements (corner-to-corner and middle-left to middle-right);
    plus the built-in scenario and unreachable maps. 242 maps in total.
  - Both algorithms get the same `Grid` object, start and goal; each is run 10 times per
    map (after one warm-up) with the order rotated and garbage collection paused.
  - Every path is checked for legality and both algorithms must report the same cost.
  - Also runs "A* (tie-break)", an investigation variant of `astar.py` that breaks
    equal-f ties towards the goal (see the docstring and report Section 15).
- Outputs: `results/results.csv` (raw, one row per run), `results/summary.csv`
  (mean and standard deviation per configuration), `results/graphs/*.png`.
- Headline numbers quoted in the report: `results/key_stats.json`.
- Quick smoke test: `python experiments.py --quick` (writes to `results/quick/`, never
  overwrites the full results). Redraw graphs only:
  `python experiments.py --graphs-only`.
- Tests: `python -m pytest tests/test_experiments.py -v` (43 tests)

Timings depend on the machine; node counts, costs and found/not-found are deterministic.

## Report
The complete report is `report/Final_Report.docx` (and `.pdf`). Its result tables and
headline numbers are read from `results/summary.csv` and `results/key_stats.json`, so
after re-running the experiments the report can be rebuilt to match:
```bash
cd report
npm install docx         # once
node build_report.js     # writes Final_Report.docx; open in Word and update the table of contents
```
Each member's original draft sections are kept in `report/` as contribution evidence.

## Screenshots
Headless screenshots for the report: `python main.py --screenshot out.png --map scenario --algo astar`
(`--map scenario|unreachable|random`, `--algo dijkstra|astar|both|none`).
