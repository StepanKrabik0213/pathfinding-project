# Agreed grid rules and algorithm interface (owner: Member 1)

Members 2 and 3: please confirm your module follows this exactly.

## Grid rules
- Cells are `(row, col)` tuples; `(0, 0)` is the top-left cell.
- Movement is 4-directional (up, down, left, right). No diagonals.
- Every move costs 1 (`grid.MOVE_COST`). Blocked cells can never be entered.
- Heuristic for A*: Manhattan distance (admissible and consistent under these rules).

## Grid API (grid.py)
| Member | Meaning |
|---|---|
| `grid.rows`, `grid.cols` | Dimensions |
| `grid.start`, `grid.goal` | `(row, col)` |
| `grid.is_walkable(r, c)` | False if out of bounds or blocked |
| `grid.neighbors(r, c)` | List of walkable 4-neighbours |
| `grid.MOVE_COST` | Cost of one move (1) |

## Algorithm function
Each module exposes `solve(grid, start, goal)` and returns a dict:

| Key | Type | Notes |
|---|---|---|
| `found` | bool | False if the goal is unreachable |
| `path` | list of `(r, c)` | start to goal inclusive; `[]` if not found |
| `cost` | int or None | None if not found |
| `nodes_expanded` | int | Cells popped and expanded |
| `time` | float | Seconds (use `time.perf_counter()`) |
| `explored` | list of `(r, c)` | Expanded cells in order, used for display |

Edge cases: start == goal gives `found=True`, `path=[start]`, `cost=0`.
`dijkstra.py`: final version by Member 2, confirmed compatible with this interface
(all tests in tests/test_grid.py and tests/test_dijkstra.py pass).
`astar.py`: final version by Member 3, confirmed compatible with this interface
(tests/test_astar.py).
`experiments.py` (Member 4) calls both modules only through `solve(grid, start, goal)`
and checks every returned result against this format (tests/test_experiments.py).
