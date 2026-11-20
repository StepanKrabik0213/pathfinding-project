"""experiments.py - fair Dijkstra vs A* comparison (Member 4).

What it does
------------
1. Builds every test environment from a seed, so each map can be rebuilt exactly:
     grid sizes      10x10, 25x25, 50x50, 100x100
     densities       10%, 20%, 30% obstacles
     maps            10 seeded layouts per size/density (seeds 0-9)
     placements      "corner": start (0,0)  -> goal (n-1,n-1)  (same as the
                                Member 2 and Member 3 benchmarks)
                     "middle": start (n/2,1) -> goal (n/2,n-2)  (the GUI default)
   plus the two hand-made maps from grid.py (scenario and unreachable).
2. Gives Dijkstra and A* exactly the same Grid object, start, goal and movement
   rules, and runs each algorithm REPEATS times (default 10) on every map.
   The order of the algorithms is rotated on every repetition and the garbage
   collector is paused while timing, so neither algorithm is favoured.
3. Checks every returned path (starts at S, ends at G, only legal moves through
   walkable cells, cost = moves x MOVE_COST) and checks that both algorithms
   report the same optimal cost.
4. Saves the raw runs to results/results.csv, summary statistics (mean and
   standard deviation) to results/summary.csv, and graphs to results/graphs/.

Investigation (Member 4)
------------------------
The Member 2 / Member 3 benchmarks showed A* saving only ~12% of the expansions
on open 100x100 grids and running slower than Dijkstra. The cause is tie-breaking:
with Manhattan distance on a 4-connected grid, every cell inside the start-goal
rectangle has the same f = g + h, and astar.py breaks equal-f ties by the
SMALLER g (heap entries are (f, g, cell)), so it fills the rectangle almost
breadth-first. `astar_tiebreak_solve` below is astar.py with ONE change: equal-f
ties go to the smaller h (= larger g, i.e. the cell nearer the goal). It is
reported as a third, clearly labelled variant "A* (tie-break)". It is still
optimal, because the f order (which guarantees optimality) is unchanged.

Usage
-----
    python experiments.py            # full run (about 1-2 minutes)
    python experiments.py --quick    # 2 sizes, 3 maps, 3 repeats (smoke test)
    python experiments.py --graphs-only   # redraw graphs from results/results.csv
"""
import argparse
import csv
import gc
import heapq
import math
import os
import statistics
import time
from collections import defaultdict

import astar
import dijkstra
from grid import Grid

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(HERE, "results")
RAW_CSV = os.path.join(RESULTS_DIR, "results.csv")
SUMMARY_CSV = os.path.join(RESULTS_DIR, "summary.csv")
GRAPH_DIR = os.path.join(RESULTS_DIR, "graphs")
STATS_JSON = os.path.join(RESULTS_DIR, "key_stats.json")
QUICK_DIR = os.path.join(RESULTS_DIR, "quick")

SIZES = [10, 25, 50, 100]
DENSITIES = [0.1, 0.2, 0.3]
SEEDS = range(10)
PLACEMENTS = ["corner", "middle"]
REPEATS = 10

def astar_tiebreak_solve(grid, start, goal):
    """A* identical to astar.solve except equal-f ties prefer the smaller h."""
    t0 = time.perf_counter()
    path, explored, found, cost = [], [], False, None
    if grid.is_walkable(*start) and grid.is_walkable(*goal):
        cols = grid.cols
        g_score = [math.inf] * (grid.rows * cols)
        came_from = [-1] * (grid.rows * cols)
        g_score[start[0] * cols + start[1]] = 0
        h0 = astar.manhattan(start, goal) * grid.MOVE_COST
        open_set = [(h0, h0, 0, start)]                
        while open_set:
            _, _, current_g, current = heapq.heappop(open_set)
            ci = current[0] * cols + current[1]
            if current_g > g_score[ci]:
                continue
            explored.append(current)
            if current == goal:
                found, cost = True, current_g
                while ci != -1:
                    path.append(divmod(ci, cols))
                    ci = came_from[ci]
                path.reverse()
                break
            for nb in grid.neighbors(*current):
                ng = current_g + grid.MOVE_COST
                ni = nb[0] * cols + nb[1]
                if ng < g_score[ni]:
                    g_score[ni] = ng
                    came_from[ni] = current[0] * cols + current[1]
                    h = astar.manhattan(nb, goal) * grid.MOVE_COST
                    heapq.heappush(open_set, (ng + h, h, ng, nb))
    return {"found": found, "path": path, "cost": cost,
            "nodes_expanded": len(explored),
            "time": time.perf_counter() - t0, "explored": explored}


ALGORITHMS = {
    "Dijkstra": dijkstra.solve,
    "A*": astar.solve,
    "A* (tie-break)": astar_tiebreak_solve,
}
MAIN_PAIR = ("Dijkstra", "A*")   


# Environments
def make_grid(size, density, seed, placement):
    """Rebuild one seeded test map. Same arguments -> identical map."""
    g = Grid(size, size)
    if placement == "corner":
        g.start, g.goal = (0, 0), (size - 1, size - 1)
    elif placement == "middle":
        g.start, g.goal = (size // 2, 1), (size // 2, size - 2)
    else:
        raise ValueError(placement)
    g.randomize(density, seed=seed)       # start and goal are never blocked
    return g


def environments(sizes=SIZES, densities=DENSITIES, seeds=SEEDS,
                 placements=PLACEMENTS):
    """Yield (labels, grid) for every test map."""
    for placement in placements:
        for size in sizes:
            for density in densities:
                for seed in seeds:
                    yield ({"environment": "random", "placement": placement,
                            "grid": f"{size}x{size}", "size": size,
                            "density": density, "seed": seed},
                           make_grid(size, density, seed, placement))
    for name, loader in (("scenario", "load_scenario"),
                         ("unreachable", "load_unreachable")):
        g = Grid()
        getattr(g, loader)()
        yield ({"environment": name, "placement": "fixed",
                "grid": f"{g.rows}x{g.cols}", "size": g.rows,
                "density": round(g.obstacle_density(), 3), "seed": ""}, g)


# Validation
def path_is_valid(grid, res, start, goal):
    """True if a 'found' result is a legal start->goal path with correct cost,
    or a 'not found' result is empty with cost None."""
    if not res["found"]:
        return res["path"] == [] and res["cost"] is None
    p = res["path"]
    if not p or p[0] != tuple(start) or p[-1] != tuple(goal):
        return False
    if not all(grid.is_walkable(*c) for c in p):
        return False
    if any(abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1 for a, b in zip(p, p[1:])):
        return False
    return res["cost"] == (len(p) - 1) * grid.MOVE_COST


# Running

def run_experiments(sizes=SIZES, densities=DENSITIES, seeds=SEEDS,
                    placements=PLACEMENTS, repeats=REPEATS, verbose=True):
    rows = []
    names = list(ALGORITHMS)
    envs = list(environments(sizes, densities, seeds, placements))
    for i, (labels, grid) in enumerate(envs, 1):
        start, goal = grid.start, grid.goal
        snapshot = (grid.start, grid.goal, frozenset(grid.blocked))
        open_cells = grid.rows * grid.cols - len(grid.blocked)
        for name in names:                       # warm-up, not recorded
            ALGORITHMS[name](grid, start, goal)
        for rep in range(repeats):
            order = names[rep % len(names):] + names[:rep % len(names)]
            for name in order:
                gc_was_on = gc.isenabled()
                gc.disable()
                try:
                    res = ALGORITHMS[name](grid, start, goal)
                finally:
                    if gc_was_on:
                        gc.enable()
                rows.append({
                    **labels, "algorithm": name, "run": rep + 1,
                    "start": f"{start[0]};{start[1]}", "goal": f"{goal[0]};{goal[1]}",
                    "open_cells": open_cells,
                    "found": res["found"],
                    "cost": res["cost"] if res["found"] else "",
                    "path_length": len(res["path"]),
                    "nodes_expanded": res["nodes_expanded"],
                    "time_ms": round(res["time"] * 1000, 5),
                    "path_valid": path_is_valid(grid, res, start, goal),
                })
        assert (grid.start, grid.goal, frozenset(grid.blocked)) == snapshot
        if verbose and (i % 20 == 0 or i == len(envs)):
            print(f"  {i}/{len(envs)} maps done")
    return rows


def save_csv(rows, path, fieldnames=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames or list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def load_raw(path=RAW_CSV):
    """Read results.csv back with proper types (used by --graphs-only)."""
    out = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            r["size"] = int(r["size"])
            r["density"] = float(r["density"])
            r["run"] = int(r["run"])
            r["open_cells"] = int(r["open_cells"])
            r["found"] = r["found"] == "True"
            r["path_valid"] = r["path_valid"] == "True"
            r["cost"] = int(r["cost"]) if r["cost"] else ""
            r["path_length"] = int(r["path_length"])
            r["nodes_expanded"] = int(r["nodes_expanded"])
            r["time_ms"] = float(r["time_ms"])
            out.append(r)
    return out

# Analysis
def _sd(xs):
    return statistics.stdev(xs) if len(xs) > 1 else 0.0


def map_key(r):
    return (r["environment"], r["placement"], r["grid"], r["density"], str(r["seed"]))


def config_key(r):
    return (r["environment"], r["placement"], r["grid"], r["density"])


def per_map(rows):
    """Collapse the repeated runs: one record per (map, algorithm).
    Nodes/cost/found are deterministic; time is the mean of the repeats,
    with its within-map standard deviation (timing noise)."""
    groups = defaultdict(list)
    for r in rows:
        groups[(map_key(r), r["algorithm"])].append(r)
    out = {}
    for (mk, alg), rs in groups.items():
        t = [r["time_ms"] for r in rs]
        first = rs[0]
        out[(mk, alg)] = {
            "row": first, "found": first["found"], "cost": first["cost"],
            "nodes": first["nodes_expanded"], "open_cells": first["open_cells"],
            "time_mean": statistics.mean(t), "time_sd": _sd(t),
            "time_median": statistics.median(t), "n_runs": len(t),
            "deterministic": len({(r["nodes_expanded"], r["cost"]) for r in rs}) == 1,
            "all_valid": all(r["path_valid"] for r in rs),
        }
    return out


def summarise(rows):
    """One summary row per configuration and algorithm.
    Solved and unsolved maps are summarised separately because an unreachable
    goal forces both algorithms to exhaust the reachable region."""
    pm = per_map(rows)
    groups = defaultdict(list)
    for (mk, alg), m in pm.items():
        groups[(config_key(m["row"]), alg)].append(m)
    out = []
    for (ck, alg), ms in sorted(groups.items(), key=lambda kv: (
            kv[0][0][0], kv[0][0][1], kv[0][0][2] and int(kv[0][0][2].split("x")[0]),
            kv[0][0][3], list(ALGORITHMS).index(kv[0][1]))):
        env, placement, grid, density = ck
        for status in ("solved", "unreachable"):
            sel = [m for m in ms if m["found"] == (status == "solved")]
            if not sel:
                continue
            nodes = [m["nodes"] for m in sel]
            times = [m["time_mean"] for m in sel]
            all_runs = [t for m in sel for t in _times(rows, m)]
            out.append({
                "environment": env, "placement": placement, "grid": grid,
                "density": density, "algorithm": alg, "status": status,
                "maps": len(sel), "runs": len(all_runs),
                "mean_cost": round(statistics.mean(m["cost"] for m in sel), 2)
                if status == "solved" else "",
                "nodes_mean": round(statistics.mean(nodes), 1),
                "nodes_sd": round(_sd(nodes), 1),
                "pct_open_cells_expanded": round(100 * statistics.mean(
                    m["nodes"] / m["open_cells"] for m in sel), 1),
                "time_ms_mean": round(statistics.mean(times), 4),
                "time_ms_sd_between_maps": round(_sd(times), 4),
                "time_ms_sd_all_runs": round(_sd(all_runs), 4),
                "time_ms_sd_within_map_avg": round(statistics.mean(
                    m["time_sd"] for m in sel), 4),
            })
    return out


_time_index = None


def _times(rows, m):
    """All repeated time_ms values for one per-map record."""
    global _time_index
    if _time_index is None or _time_index[0] is not rows:
        idx = defaultdict(list)
        for r in rows:
            idx[(map_key(r), r["algorithm"])].append(r["time_ms"])
        _time_index = (rows, idx)
    return _time_index[1][(map_key(m["row"]), m["row"]["algorithm"])]


def checks(rows):
    """Correctness and 'unexpected result' checks. Returns a dict of findings."""
    pm = per_map(rows)
    maps = sorted({mk for mk, _ in pm})
    f = {"maps": len(maps), "runs": len(rows),
         "invalid_paths": sum(not r["path_valid"] for r in rows),
         "non_deterministic": sum(not m["deterministic"] for m in pm.values()),
         "found_mismatch": [], "cost_mismatch": [],
         "astar_more_nodes": [], "astar_slower": [],
         "tiebreak_more_nodes_than_astar": [], "solved_maps": 0,
         "unsolved_maps": 0}
    for mk in maps:
        d, a, t = (pm[(mk, n)] for n in ALGORITHMS)
        if not (d["found"] == a["found"] == t["found"]):
            f["found_mismatch"].append(mk)
        elif d["found"] and not (d["cost"] == a["cost"] == t["cost"]):
            f["cost_mismatch"].append(mk)
        f["solved_maps" if d["found"] else "unsolved_maps"] += 1
        if a["nodes"] > d["nodes"]:
            f["astar_more_nodes"].append((mk, d["nodes"], a["nodes"]))
        if a["time_mean"] > d["time_mean"]:
            f["astar_slower"].append((mk, d["found"], d["time_mean"], a["time_mean"],
                                      d["nodes"], a["nodes"]))
        if t["nodes"] > a["nodes"]:
            f["tiebreak_more_nodes_than_astar"].append(mk)
    return f


def key_stats(rows):
    """Headline numbers quoted in the report, computed from the raw runs."""
    pm = per_map(rows)
    f = checks(rows)
    out = {"maps": f["maps"], "runs": f["runs"], "solved_maps": f["solved_maps"],
           "unsolved_maps": f["unsolved_maps"]}
    for pl in ("corner", "middle"):
        ks = [mk for mk, a in pm if a == "Dijkstra" and mk[1] == pl and pm[(mk, a)]["found"]]
        out[f"{pl}_solved"] = len(ks)
        for tag, alg in (("astar", "A*"), ("tb", "A* (tie-break)")):
            ratio = [pm[(k, alg)]["nodes"] / pm[(k, "Dijkstra")]["nodes"] for k in ks]
            speed = [pm[(k, "Dijkstra")]["time_mean"] / pm[(k, alg)]["time_mean"] for k in ks]
            out[f"{pl}_{tag}_node_pct_mean"] = round(100 * statistics.mean(ratio), 1)
            out[f"{pl}_{tag}_node_pct_min"] = round(100 * min(ratio), 1)
            out[f"{pl}_{tag}_node_pct_max"] = round(100 * max(ratio), 1)
            out[f"{pl}_{tag}_speedup_mean"] = round(statistics.mean(speed), 2)
            out[f"{pl}_{tag}_speedup_median"] = round(statistics.median(speed), 2)
            out[f"{pl}_{tag}_faster"] = sum(s > 1 for s in speed)
    slow = [s for s in f["astar_slower"] if s[1]]
    out["astar_slower_solved"] = len(slow)
    out["astar_slower_solved_corner"] = sum(s[0][1] == "corner" for s in slow)
    out["astar_slower_solved_low_density"] = sum(s[0][3] <= 0.2 for s in slow)
    out["astar_slower_unreachable"] = len(f["astar_slower"]) - len(slow)
    big = {alg: [m["time_mean"] * 1000 / m["nodes"] for (mk, a), m in pm.items()
                 if a == alg and m["nodes"] > 500] for alg in ALGORITHMS}
    out["us_per_node_dijkstra"] = round(statistics.mean(big["Dijkstra"]), 2)
    out["us_per_node_astar"] = round(statistics.mean(big["A*"]), 2)
    un = [mk for mk, a in pm if a == "Dijkstra" and not pm[(mk, a)]["found"]]
    un_big = [k for k in un if pm[(k, "Dijkstra")]["nodes"] > 100]
    out["unreach_equal_nodes"] = all(
        pm[(k, "A*")]["nodes"] == pm[(k, "Dijkstra")]["nodes"] == pm[(k, "A* (tie-break)")]["nodes"] for k in un)
    out["unreach_big_maps"] = len(un_big)
    out["unreach_big_astar_time_ratio"] = round(statistics.mean(
        pm[(k, "A*")]["time_mean"] / pm[(k, "Dijkstra")]["time_mean"] for k in un_big), 2)
    cv = [m["time_sd"] / m["time_mean"] for m in pm.values() if m["time_mean"] > 0.5]
    out["timing_cv_median_pct"] = round(100 * statistics.median(cv), 1)
    out["tb_faster_total"] = out["corner_tb_faster"] + out["middle_tb_faster"]
    out["solved_random_total"] = out["corner_solved"] + out["middle_solved"]
    for env in ("scenario", "unreachable"):
        for alg in ALGORITHMS:
            m = next(v for (mk, a), v in pm.items() if mk[0] == env and a == alg)
            key = f"{env}_{alg}".replace("A* (tie-break)", "tb").replace("A*", "astar").replace(" ", "")
            out[key] = {"cost": m["cost"], "nodes": m["nodes"],
                        "time_mean": round(m["time_mean"], 3), "time_sd": round(m["time_sd"], 3)}
    return out


def print_report(summary, f):
    print("\n=== Correctness ===")
    print(f"maps: {f['maps']}  (solved {f['solved_maps']}, unreachable {f['unsolved_maps']})"
          f"   runs recorded: {f['runs']}")
    print(f"invalid paths: {f['invalid_paths']}   non-deterministic results: "
          f"{f['non_deterministic']}")
    print(f"found/not-found disagreements: {len(f['found_mismatch'])}   "
          f"cost disagreements: {len(f['cost_mismatch'])}")
    print("\n=== Unexpected-result checks (Dijkstra vs A*) ===")
    print(f"maps where A* expanded MORE nodes than Dijkstra: {len(f['astar_more_nodes'])}")
    slow = f["astar_slower"]
    print(f"maps where A* was SLOWER on mean time: {len(slow)} "
          f"({sum(1 for s in slow if s[1])} solved, {sum(1 for s in slow if not s[1])} unreachable)")
    print(f"maps where tie-break A* expanded more than A*: "
          f"{len(f['tiebreak_more_nodes_than_astar'])}")
    print("\n=== Summary (solved maps, corner placement) ===")
    print(f"{'grid':>8} {'dens':>5} {'algorithm':<15}{'maps':>5} {'cost':>7} "
          f"{'nodes mean':>11} {'sd':>7} {'%open':>6} {'ms mean':>9} {'sd':>7}")
    for s in summary:
        if s["placement"] in ("corner", "fixed") and s["status"] == "solved":
            print(f"{s['grid']:>8} {int(round(s['density'] * 100)):>4}% {s['algorithm']:<15}"
                  f"{s['maps']:>5} {s['mean_cost']:>7} {s['nodes_mean']:>11} "
                  f"{s['nodes_sd']:>7} {s['pct_open_cells_expanded']:>6} "
                  f"{s['time_ms_mean']:>9.3f} {s['time_ms_sd_between_maps']:>7.3f}")


# Graphs
LABEL = {"Dijkstra": "Dijkstra", "A*": "A*", "A* (tie-break)": "A* with tie breaking"}
COLORS = {"Dijkstra": "#2a78d6", "A*": "#eb6834", "A* (tie-break)": "#1baf7a"}
MARKERS = {"Dijkstra": "o", "A*": "s", "A* (tie-break)": "^"}
INK, INK2, GRIDC, SURF = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"


def _style(ax, title, ylabel, xlabel="Grid size, cells per side"):
    ax.set_title(title, loc="left", fontsize=10.5, color=INK)
    ax.set_xlabel(xlabel, fontsize=9, color=INK2)
    ax.set_ylabel(ylabel, fontsize=9, color=INK2)
    ax.grid(True, color=GRIDC, linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color("#b5b4ae")
    ax.tick_params(colors=INK2, labelsize=8.5)
    ax.set_facecolor(SURF)


def make_graphs(rows, summary, algorithms=None, outdir=GRAPH_DIR):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    os.makedirs(outdir, exist_ok=True)
    algorithms = algorithms or list(ALGORITHMS)
    sizes = sorted({s["grid"] for s in summary if s["environment"] == "random"},
                   key=lambda g: int(g.split("x")[0]))
    xs = [int(g.split("x")[0]) for g in sizes]
    dens = sorted({s["density"] for s in summary if s["environment"] == "random"})
    saved = []

    def lookup(placement, grid, d, alg):
        for s in summary:
            if (s["environment"], s["placement"], s["grid"], s["density"],
                    s["algorithm"], s["status"]) == ("random", placement, grid, d,
                                                     alg, "solved"):
                return s
        return None

    for metric, sd_key, ylabel, fname, title in (
            ("nodes_mean", "nodes_sd", "Nodes expanded (mean, log scale)",
             "nodes_vs_size", "Nodes expanded vs grid size"),
            ("time_ms_mean", "time_ms_sd_between_maps",
             "Execution time, ms (mean, log scale)", "time_vs_size",
             "Execution time vs grid size")):
        for placement in sorted({s["placement"] for s in summary
                                 if s["environment"] == "random"}):
            fig, axes = plt.subplots(1, len(dens), figsize=(3.6 * len(dens), 3.6),
                                     sharey=True, facecolor=SURF)
            axes = axes if len(dens) > 1 else [axes]
            for ax, d in zip(axes, dens):
                for alg in algorithms:
                    pts = [(x, lookup(placement, g, d, alg)) for x, g in zip(xs, sizes)]
                    pts = [(x, s) for x, s in pts if s]
                    ys = [s[metric] for _, s in pts]
                    sds = [s[sd_key] for _, s in pts]
                    ax.errorbar([x for x, _ in pts], ys,
                                yerr=[[min(sd, 0.9 * y) for y, sd in zip(ys, sds)], sds],
                                label=LABEL[alg],
                                color=COLORS[alg], marker=MARKERS[alg], markersize=6,
                                linewidth=2, capsize=3, elinewidth=1,
                                markeredgecolor=SURF, markeredgewidth=1.2)
                ax.set_yscale("log")
                ax.set_xticks(xs)
                _style(ax, f"{int(round(d * 100))}% obstacles",
                       ylabel if ax is axes[0] else "")
            axes[0].legend(frameon=False, fontsize=8.5, loc="upper left")
            fig.suptitle(f"{title}, {placement} layout, maps with a path, "
                         f"error bars show 1 sd between maps", fontsize=11,
                         color=INK, x=0.01, ha="left")
            fig.tight_layout()
            p = os.path.join(outdir, f"{fname}_{placement}.png")
            fig.savefig(p, dpi=160)
            plt.close(fig)
            saved.append(p)

    pm = per_map(rows)
    fig, ax = plt.subplots(figsize=(4.8, 4.4), facecolor=SURF)
    maps = sorted({mk for mk, _ in pm})
    dc = [pm[(mk, "Dijkstra")]["cost"] for mk in maps if pm[(mk, "Dijkstra")]["found"]]
    for alg in algorithms[1:]:
        ac = [pm[(mk, alg)]["cost"] for mk in maps if pm[(mk, "Dijkstra")]["found"]]
        ax.scatter(dc, ac, s=60 if alg == "A*" else 22, label=LABEL[alg], color=COLORS[alg],
                   marker=MARKERS[alg], edgecolors=SURF, linewidths=0.8, zorder=3)
    hi = max(dc) * 1.05
    ax.plot([0, hi], [0, hi], color=INK2, linewidth=1, linestyle="--", zorder=1)
    ax.text(hi * 0.97, hi * 0.88, "equal cost", color=INK2, fontsize=8, ha="right")
    _style(ax, f"Path cost on the {len(dc)} maps with a path",
           "A* path cost", "Dijkstra path cost")
    ax.legend(frameon=False, fontsize=8.5, loc="upper left")
    fig.tight_layout()
    p = os.path.join(outdir, "path_cost_agreement.png")
    fig.savefig(p, dpi=160)
    plt.close(fig)
    saved.append(p)

    fig, axes = plt.subplots(1, 2, figsize=(9.6, 3.8), sharey=True, facecolor=SURF)
    for ax, placement in zip(axes, ["corner", "middle"]):
        width = 0.8 / len(algorithms[1:])
        labels = [f"{g.split('x')[0]}\n{int(round(d * 100))}%" for g in sizes for d in dens]
        for k, alg in enumerate(algorithms[1:]):
            vals = []
            for g in sizes:
                for d in dens:
                    a, dj = lookup(placement, g, d, alg), lookup(placement, g, d, "Dijkstra")
                    vals.append(100 * a["nodes_mean"] / dj["nodes_mean"] if a and dj else 0)
            pos = [i + (k - (len(algorithms[1:]) - 1) / 2) * width for i in range(len(vals))]
            ax.bar(pos, vals, width=width - 0.04, color=COLORS[alg], label=LABEL[alg])
        ax.axhline(100, color=INK2, linewidth=1, linestyle="--")
        ax.set_xticks(range(len(labels)))
        ax.set_xticklabels(labels, fontsize=7)
        ax.set_ylim(0, 112)
        ax.text(-0.5, 102, "Dijkstra = 100%", color=INK2, fontsize=7.5,
                ha="left", va="bottom")
        _style(ax, f"{placement} layout",
               "A* nodes as % of Dijkstra's" if ax is axes[0] else "",
               "Grid side length (cells) and obstacle density")
    axes[1].legend(frameon=False, fontsize=8.5, loc="upper right",
                   bbox_to_anchor=(1.0, 0.97))
    fig.suptitle("Nodes expanded by A* as a percentage of Dijkstra, maps with a path, lower is better",
                 fontsize=11, color=INK, x=0.01, ha="left")
    fig.tight_layout()
    p = os.path.join(outdir, "node_ratio.png")
    fig.savefig(p, dpi=160)
    plt.close(fig)
    saved.append(p)

    g = make_grid(50, 0.1, 0, "corner")
    import numpy as np
    fig, axes = plt.subplots(1, 3, figsize=(10.2, 3.7), facecolor=SURF)
    for ax, alg in zip(axes, algorithms):
        res = ALGORITHMS[alg](g, g.start, g.goal)
        img = np.ones((g.rows, g.cols, 3))
        for (r, c) in g.blocked:
            img[r, c] = (0.25, 0.25, 0.25)
        rgb = tuple(int(COLORS[alg][i:i + 2], 16) / 255 for i in (1, 3, 5))
        light = tuple(0.62 + 0.38 * v for v in rgb)
        for (r, c) in res["explored"]:
            img[r, c] = light
        for (r, c) in res["path"]:
            img[r, c] = (0.05, 0.05, 0.05)
        ax.imshow(img, interpolation="nearest")
        ax.set_xticks([]); ax.set_yticks([])
        ax.set_title(f"{LABEL[alg]}: {res['nodes_expanded']} nodes, cost {res['cost']}",
                     fontsize=9.5, color=INK, loc="left")
    fig.suptitle("Explored cells shaded and path in black, 50x50 map, 10% obstacles, "
                 "seed 0", fontsize=10.5, color=INK, x=0.01, ha="left")
    fig.tight_layout()
    p = os.path.join(outdir, "explored_comparison.png")
    fig.savefig(p, dpi=160)
    plt.close(fig)
    saved.append(p)
    return saved


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--quick", action="store_true", help="small smoke-test run")
    ap.add_argument("--repeats", type=int, default=REPEATS)
    ap.add_argument("--graphs-only", action="store_true",
                    help="reuse results/results.csv, only redo summary and graphs")
    ap.add_argument("--no-graphs", action="store_true")
    args = ap.parse_args(argv)
    # a quick smoke test writes to results/quick/ so it never overwrites the real results
    raw_csv, summary_csv, graph_dir = RAW_CSV, SUMMARY_CSV, GRAPH_DIR
    if args.quick:
        raw_csv = os.path.join(QUICK_DIR, "results.csv")
        summary_csv = os.path.join(QUICK_DIR, "summary.csv")
        graph_dir = os.path.join(QUICK_DIR, "graphs")

    if args.graphs_only:
        rows = load_raw(raw_csv)
    else:
        cfg = (dict(sizes=[10, 25], seeds=range(3), repeats=3) if args.quick
               else dict(repeats=args.repeats))
        print("Running experiments ...")
        t0 = time.time()
        rows = run_experiments(**cfg)
        print(f"done in {time.time() - t0:.1f} s")
        save_csv(rows, raw_csv)
        print(f"Saved {len(rows)} raw runs to {os.path.relpath(raw_csv, HERE)}")

    summary = summarise(rows)
    save_csv(summary, summary_csv)
    f = checks(rows)
    print_report(summary, f)
    print(f"\nSaved {len(summary)} summary rows to {os.path.relpath(summary_csv, HERE)}")
    if not args.quick:
        import json
        with open(STATS_JSON, "w", encoding="utf-8") as fh:
            json.dump(key_stats(rows), fh, indent=1)
        print(f"Saved headline numbers to {os.path.relpath(STATS_JSON, HERE)}")
    if not args.no_graphs:
        for p in make_graphs(rows, summary, outdir=graph_dir):
            print("graph:", os.path.relpath(p, HERE))
    ok = not (f["invalid_paths"] or f["found_mismatch"] or f["cost_mismatch"])
    print("\nALL CORRECTNESS CHECKS PASSED" if ok else "\nCORRECTNESS PROBLEMS FOUND")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
