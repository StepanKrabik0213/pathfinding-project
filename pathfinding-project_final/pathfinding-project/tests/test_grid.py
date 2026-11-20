"""Member 1 tests: grid environment and algorithm-interface contract."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import astar
import dijkstra
from grid import Grid

MODULES = [dijkstra, astar]
KEYS = {"found", "path", "cost", "nodes_expanded", "time", "explored"}


def check_valid_path(grid, res):
    path = res["path"]
    assert path[0] == grid.start and path[-1] == grid.goal
    for a, b in zip(path, path[1:]):
        assert abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1, "moves must be 4-directional"
        assert grid.is_walkable(*b), "path crosses a blocked cell"
    assert res["cost"] == (len(path) - 1) * grid.MOVE_COST


# ---- grid behaviour ------------------------------------------------------
def test_bounds_and_blocked_cells():
    g = Grid(5, 5)
    g.toggle_obstacle(2, 2)
    assert not g.is_walkable(2, 2)
    assert not g.is_walkable(-1, 0) and not g.is_walkable(0, 5)


def test_neighbors_skip_obstacles_and_edges():
    g = Grid(3, 3)
    g.toggle_obstacle(0, 1)
    assert sorted(g.neighbors(0, 0)) == [(1, 0)]
    assert len(g.neighbors(1, 1)) == 3


def test_start_and_goal_are_protected():
    g = Grid(5, 5)
    assert not g.toggle_obstacle(*g.start)
    assert not g.toggle_obstacle(*g.goal)
    assert not g.set_goal(*g.start)


def test_moving_start_onto_wall_opens_it():
    g = Grid(5, 5)
    g.toggle_obstacle(1, 1)
    assert g.set_start(1, 1) and g.is_walkable(1, 1)


def test_random_layout_is_repeatable_and_keeps_endpoints_open():
    a, b = Grid(25, 25), Grid(25, 25)
    a.randomize(0.3, seed=7)
    b.randomize(0.3, seed=7)
    assert a.blocked == b.blocked
    assert a.start not in a.blocked and a.goal not in a.blocked
    assert 0.2 < a.obstacle_density() < 0.4


def test_reset_clears_obstacles():
    g = Grid(10, 10)
    g.randomize(0.3, seed=1)
    g.clear_obstacles()
    assert not g.blocked


def test_text_round_trip():
    g = Grid(20, 30)
    g.load_scenario()
    assert Grid.from_text(g.to_text()).blocked == g.blocked


# ---- integration contract (both algorithm modules) ------------------------
@pytest.mark.parametrize("mod", MODULES)
def test_result_has_agreed_keys(mod):
    g = Grid(10, 10)
    assert KEYS <= set(mod.solve(g, g.start, g.goal))


@pytest.mark.parametrize("mod", MODULES)
def test_open_grid_path_is_valid(mod):
    g = Grid(10, 10)
    res = mod.solve(g, g.start, g.goal)
    assert res["found"]
    check_valid_path(g, res)


@pytest.mark.parametrize("mod", MODULES)
def test_scenario_path_avoids_closed_routes(mod):
    g = Grid()
    g.load_scenario()
    res = mod.solve(g, g.start, g.goal)
    assert res["found"]
    check_valid_path(g, res)


@pytest.mark.parametrize("mod", MODULES)
def test_unreachable_goal_reported(mod):
    g = Grid()
    g.load_unreachable()
    res = mod.solve(g, g.start, g.goal)
    assert res["found"] is False and res["path"] == []


@pytest.mark.parametrize("mod", MODULES)
def test_start_equals_goal(mod):
    g = Grid(5, 5)
    res = mod.solve(g, (2, 2), (2, 2))
    assert res["found"] and res["cost"] == 0 and res["path"] == [(2, 2)]


def test_both_algorithms_agree_on_cost_for_random_maps():
    for seed in range(30):
        g = Grid(25, 25)
        g.randomize(0.25, seed=seed)
        d = dijkstra.solve(g, g.start, g.goal)
        a = astar.solve(g, g.start, g.goal)
        assert d["found"] == a["found"]
        if d["found"]:
            assert d["cost"] == a["cost"]
