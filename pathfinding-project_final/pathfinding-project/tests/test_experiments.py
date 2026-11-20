"""Member 4 tests: experiment fairness, validation helpers and the
tie-break A* variant used in the investigation (experiments.py)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import astar
import dijkstra
import experiments as ex
from grid import Grid


# --- fair, reproducible environments ---------------------------------------

def test_same_seed_gives_identical_map():
    a = ex.make_grid(25, 0.2, 7, "corner")
    b = ex.make_grid(25, 0.2, 7, "corner")
    assert a.blocked == b.blocked and a.start == b.start and a.goal == b.goal


def test_map_matches_member2_and_member3_benchmarks():
    """Corner maps are built exactly like dijkstra_benchmark.py / astar_benchmark.py."""
    g = Grid(50, 50)
    g.start, g.goal = (0, 0), (49, 49)
    g.randomize(0.3, seed=4)
    assert ex.make_grid(50, 0.3, 4, "corner").blocked == g.blocked


@pytest.mark.parametrize("placement", ["corner", "middle"])
def test_start_and_goal_never_blocked(placement):
    for seed in range(10):
        g = ex.make_grid(10, 0.3, seed, placement)
        assert g.is_walkable(*g.start) and g.is_walkable(*g.goal)


def test_density_is_close_to_requested():
    g = ex.make_grid(100, 0.2, 0, "corner")
    assert abs(g.obstacle_density() - 0.2) < 0.02


def test_unknown_placement_rejected():
    with pytest.raises(ValueError):
        ex.make_grid(10, 0.1, 0, "diagonal")


# --- path validator ----------------------------------------------------------

def test_validator_accepts_real_paths_and_rejects_bad_ones():
    g = Grid.from_text(["S..", "...", "..G"])
    res = dijkstra.solve(g, g.start, g.goal)
    assert ex.path_is_valid(g, res, g.start, g.goal)
    jump = dict(res, path=[(0, 0), (2, 2)], cost=1)          # illegal move
    assert not ex.path_is_valid(g, jump, g.start, g.goal)
    wrong_cost = dict(res, cost=res["cost"] + 1)
    assert not ex.path_is_valid(g, wrong_cost, g.start, g.goal)
    g.blocked.add(res["path"][1])                             # path through a wall
    assert not ex.path_is_valid(g, res, g.start, g.goal)


def test_validator_on_unreachable():
    g = Grid()
    g.load_unreachable()
    res = astar.solve(g, g.start, g.goal)
    assert ex.path_is_valid(g, res, g.start, g.goal)


# --- tie-break A* variant -----------------------------------------------------

@pytest.mark.parametrize("seed", range(15))
@pytest.mark.parametrize("placement", ["corner", "middle"])
def test_tiebreak_variant_is_optimal_and_never_worse(seed, placement):
    g = ex.make_grid(30, [0.1, 0.2, 0.3][seed % 3], seed, placement)
    d = dijkstra.solve(g, g.start, g.goal)
    a = astar.solve(g, g.start, g.goal)
    t = ex.astar_tiebreak_solve(g, g.start, g.goal)
    assert t["found"] == d["found"]
    assert t["cost"] == d["cost"] == a["cost"]
    assert ex.path_is_valid(g, t, g.start, g.goal)
    assert t["nodes_expanded"] <= a["nodes_expanded"] <= d["nodes_expanded"]
    assert set(t) == set(d)   # same output format as the team interface


def test_tiebreak_edge_cases():
    g = Grid(5, 5)
    same = ex.astar_tiebreak_solve(g, (2, 2), (2, 2))
    assert same["found"] and same["path"] == [(2, 2)] and same["cost"] == 0
    g.blocked.add((4, 4))
    blocked = ex.astar_tiebreak_solve(g, (0, 0), (4, 4))
    assert not blocked["found"] and blocked["nodes_expanded"] == 0


# --- the experiment runner itself --------------------------------------------

@pytest.fixture(scope="module")
def small_run():
    return ex.run_experiments(sizes=[10], densities=[0.2], seeds=range(3),
                              placements=["corner"], repeats=2, verbose=False)


def test_runner_records_every_algorithm_equally(small_run):
    maps = 3 + 2                         # 3 random + scenario + unreachable
    assert len(small_run) == maps * len(ex.ALGORITHMS) * 2
    for name in ex.ALGORITHMS:
        assert sum(r["algorithm"] == name for r in small_run) == maps * 2


def test_runner_results_are_correct(small_run):
    f = ex.checks(small_run)
    assert f["invalid_paths"] == 0
    assert f["found_mismatch"] == [] and f["cost_mismatch"] == []
    assert f["non_deterministic"] == 0


def test_summary_separates_solved_and_unreachable(small_run):
    s = ex.summarise(small_run)
    assert {r["status"] for r in s} <= {"solved", "unreachable"}
    unreach = [r for r in s if r["environment"] == "unreachable"]
    assert unreach and all(r["status"] == "unreachable" for r in unreach)


def test_csv_round_trip(tmp_path, small_run):
    p = tmp_path / "r.csv"
    ex.save_csv(small_run, str(p))
    back = ex.load_raw(str(p))
    assert len(back) == len(small_run)
    assert back[0]["nodes_expanded"] == small_run[0]["nodes_expanded"]
    assert ex.checks(back)["invalid_paths"] == 0
