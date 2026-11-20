"""Member 2 tests: Dijkstra's algorithm (dijkstra.py).

Groups of tests
  1. Basic paths on open grids
  2. Paths around obstacles
  3. Unreachable goals and grids with no valid route
  4. Edge cases (start == goal, blocked or out-of-grid endpoints)
  5. Correctness checks: every move valid, cost correct, cost optimal
"""
import os
import random
import sys
from collections import deque

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import dijkstra
from grid import Grid


# ---- helpers ---------------------------------------------------------------
def assert_valid_path(grid, res, start, goal):
    """Every move is one 4-directional step into an open cell, and the
    reported cost equals the number of moves times MOVE_COST."""
    path = res["path"]
    assert path[0] == start and path[-1] == goal
    for a, b in zip(path, path[1:]):
        assert abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1, f"illegal move {a}->{b}"
        assert grid.is_walkable(*b), f"path enters blocked cell {b}"
    assert len(set(path)) == len(path), "path visits a cell twice"
    assert res["cost"] == (len(path) - 1) * grid.MOVE_COST


def bfs_distance(grid, start, goal):
    """Independent reference: breadth-first search gives the true shortest
    distance when every move costs the same."""
    if not (grid.is_walkable(*start) and grid.is_walkable(*goal)):
        return None
    seen, q = {start: 0}, deque([start])
    while q:
        cell = q.popleft()
        if cell == goal:
            return seen[cell] * grid.MOVE_COST
        for nb in grid.neighbors(*cell):
            if nb not in seen:
                seen[nb] = seen[cell] + 1
                q.append(nb)
    return None


def solve(grid, start=None, goal=None):
    return dijkstra.solve(grid, start or grid.start, goal or grid.goal)


# ---- 1. basic paths --------------------------------------------------------
def test_straight_line_path():
    g = Grid.from_text(["S...G"])
    res = solve(g)
    assert res["found"] and res["cost"] == 4
    assert res["path"] == [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)]


def test_open_grid_cost_is_manhattan_distance():
    g = Grid(10, 10)
    res = solve(g, (0, 0), (9, 9))
    assert res["found"] and res["cost"] == 18
    assert_valid_path(g, res, (0, 0), (9, 9))


def test_adjacent_cells():
    g = Grid(3, 3)
    res = solve(g, (1, 1), (1, 2))
    assert res["found"] and res["cost"] == 1 and res["path"] == [(1, 1), (1, 2)]


# ---- 2. obstacles ----------------------------------------------------------
def test_detour_around_wall():
    g = Grid.from_text([
        "S#...",
        ".#.#.",
        "...#G",
    ])
    res = solve(g)
    # down 2, right 2, up 2, right 2, down 2 = 10 moves (hand-counted)
    assert res["found"] and res["cost"] == 10
    assert_valid_path(g, res, g.start, g.goal)


def test_path_never_enters_blocked_cells():
    g = Grid()
    g.load_scenario()
    res = solve(g)
    assert res["found"]
    assert not set(res["path"]) & g.blocked
    assert not set(res["explored"]) & g.blocked


def test_narrow_corridor_forces_long_route():
    g = Grid.from_text([
        "S.........",
        "#########.",
        "G.........",
    ])
    res = solve(g)
    assert res["found"] and res["cost"] == 20
    assert_valid_path(g, res, g.start, g.goal)


# ---- 3. unreachable --------------------------------------------------------
def test_goal_surrounded_by_walls():
    g = Grid.from_text([
        "S....",
        "...#.",
        "..#G#",
        "...#.",
    ])
    res = solve(g)
    assert res["found"] is False
    assert res["path"] == [] and res["cost"] is None


def test_unreachable_scenario_explores_whole_component():
    g = Grid()
    g.load_unreachable()
    res = solve(g)
    assert res["found"] is False and res["path"] == []
    # Dijkstra must have tried every cell it could reach before giving up.
    assert res["nodes_expanded"] > 0
    assert g.goal not in res["explored"]


def test_start_boxed_in():
    g = Grid.from_text([
        ".#...",
        "#S#..",
        ".#..G",
    ])
    res = solve(g)
    assert res["found"] is False and res["nodes_expanded"] == 1


# ---- 4. edge cases ---------------------------------------------------------
def test_start_equals_goal():
    g = Grid(5, 5)
    res = solve(g, (2, 2), (2, 2))
    assert res["found"] and res["cost"] == 0 and res["path"] == [(2, 2)]


def test_blocked_goal_is_unreachable():
    g = Grid(5, 5)
    g.blocked.add((4, 4))           # bypass the grid's protection on purpose
    res = solve(g, (0, 0), (4, 4))
    assert res["found"] is False and res["nodes_expanded"] == 0


def test_goal_outside_grid_is_unreachable():
    g = Grid(5, 5)
    res = solve(g, (0, 0), (9, 9))
    assert res["found"] is False and res["path"] == []


def test_one_by_one_grid():
    g = Grid(1, 1)
    res = solve(g, (0, 0), (0, 0))
    assert res["found"] and res["cost"] == 0


# ---- 5. correctness and output format --------------------------------------
def test_result_format():
    g = Grid(10, 10)
    res = solve(g)
    assert set(res) == {"found", "path", "cost", "nodes_expanded", "time", "explored"}
    assert isinstance(res["time"], float) and res["time"] >= 0
    assert res["nodes_expanded"] == len(res["explored"])
    assert len(set(res["explored"])) == len(res["explored"]), "a cell was expanded twice"


def test_cells_expanded_in_non_decreasing_distance_order():
    """Core Dijkstra property: cells come off the queue in order of distance."""
    g = Grid(15, 15)
    g.randomize(0.2, seed=3)
    res = solve(g)
    dist_from_start = [bfs_distance(g, g.start, c) for c in res["explored"]]
    assert dist_from_start == sorted(dist_from_start)


@pytest.mark.parametrize("seed", range(40))
def test_cost_is_optimal_on_random_maps(seed):
    """Compare with breadth-first search on 40 seeded random maps."""
    rng = random.Random(seed)
    size = rng.choice([10, 25, 50])
    g = Grid(size, size)
    g.randomize(rng.choice([0.1, 0.2, 0.3, 0.4]), seed=seed)
    res = solve(g)
    expected = bfs_distance(g, g.start, g.goal)
    if expected is None:
        assert res["found"] is False
    else:
        assert res["found"] and res["cost"] == expected
        assert_valid_path(g, res, g.start, g.goal)


def test_does_not_modify_grid():
    g = Grid()
    g.load_scenario()
    before = (set(g.blocked), g.start, g.goal)
    solve(g)
    assert (set(g.blocked), g.start, g.goal) == before


def test_large_grid_runs_quickly():
    g = Grid(100, 100)
    g.randomize(0.2, seed=1)
    res = solve(g)
    assert res["time"] < 2.0
