"""m2_figures.py - extra report figures for Member 2 (run from the project root).

    python report/m2_figures.py

Creates in report/screenshots_m2/:
  m2_wavefront.png  - order in which Dijkstra expands cells on the scenario map
  m2_small_trace.png - step-by-step distances on a tiny 5x5 example
  m2_scaling.png     - nodes expanded and time vs grid size (from results CSV)
"""
import csv
import os
import statistics
import sys

sys.path.insert(0, os.getcwd())

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import ListedColormap

import dijkstra
from grid import Grid

OUT = os.path.join("report", "screenshots_m2")
os.makedirs(OUT, exist_ok=True)


def wavefront():
    g = Grid()
    g.load_scenario()
    res = dijkstra.solve(g, g.start, g.goal)
    order = np.full((g.rows, g.cols), np.nan)
    for i, cell in enumerate(res["explored"]):
        order[cell] = i
    fig, ax = plt.subplots(figsize=(9, 6.2), dpi=130)
    walls = np.zeros((g.rows, g.cols))
    for c in g.blocked:
        walls[c] = 1
    ax.imshow(np.where(walls == 1, 1, np.nan), cmap=ListedColormap(["#343e4e"]), vmin=0, vmax=1)
    im = ax.imshow(order, cmap="viridis")
    pr, pc = zip(*res["path"])
    ax.plot(pc, pr, color="#ff9f1c", lw=3)
    for cell, col, lab in ((g.start, "#2ea043", "S"), (g.goal, "#d63031", "G")):
        ax.scatter(cell[1], cell[0], s=220, c=col, edgecolors="white", zorder=3)
        ax.text(cell[1], cell[0], lab, ha="center", va="center", color="white", fontsize=9, weight="bold", zorder=4)
    ax.set_xticks([]); ax.set_yticks([])
    cb = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
    cb.set_label("expansion order (0 = first cell popped)")
    ax.set_title(f"Dijkstra expansion order on the scenario map "
                 f"({res['nodes_expanded']} cells expanded, path cost {res['cost']})", fontsize=11)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "m2_wavefront.png"))
    plt.close(fig)


def small_trace():
    g = Grid.from_text([
        "S..#.",
        ".#...",
        "...#G",
    ])
    res = dijkstra.solve(g, g.start, g.goal)
    # distance of every expanded cell = its index in a BFS layer; recompute from path data
    dist = {}
    for cell in res["explored"]:
        # Dijkstra's final distance; reconstruct via solving to that cell
        dist[cell] = dijkstra.solve(g, g.start, cell)["cost"]
    fig, ax = plt.subplots(figsize=(6, 3.8), dpi=140)
    for r in range(g.rows):
        for c in range(g.cols):
            cell = (r, c)
            if cell in g.blocked:
                fc = "#343e4e"
            elif cell in res["path"]:
                fc = "#ff9f1c"
            elif cell in dist:
                fc = "#aacdf5"
            else:
                fc = "white"
            ax.add_patch(plt.Rectangle((c, r), 1, 1, fc=fc, ec="#9aa3ad"))
            if cell in dist:
                step = res["explored"].index(cell) + 1
                ax.text(c + 0.5, r + 0.42, f"d={dist[cell]}", ha="center", va="center", fontsize=11, weight="bold")
                ax.text(c + 0.5, r + 0.75, f"pop #{step}", ha="center", va="center", fontsize=7.5, color="#333")
    ax.text(0.12, 0.2, "S", fontsize=9, color="#2ea043", weight="bold")
    ax.text(4.12, 2.2, "G", fontsize=9, color="#d63031", weight="bold")
    ax.set_xlim(0, g.cols); ax.set_ylim(g.rows, 0); ax.set_aspect("equal"); ax.axis("off")
    ax.set_title("Worked example: d = final distance, pop # = expansion order\n(orange = shortest path, blue = expanded but not on the path)", fontsize=9.5)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "m2_small_trace.png"))
    plt.close(fig)


def scaling():
    path = os.path.join("results", "dijkstra_metrics.csv")
    rows = list(csv.DictReader(open(path)))
    sizes = ["10x10", "25x25", "50x50", "100x100"]
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8), dpi=130)
    for dens, col in (("0.1", "#2a6fdb"), ("0.2", "#e07b00"), ("0.3", "#2ea043")):
        nodes, times, sds = [], [], []
        for s in sizes:
            grp = [r for r in rows if r["grid"] == s and r["density"] == dens and r["found"] == "True"]
            n = [int(r["nodes_expanded"]) for r in grp]
            t = [float(r["time_ms"]) for r in grp]
            nodes.append(statistics.mean(n)); times.append(statistics.mean(t))
            sds.append(statistics.stdev(t) if len(t) > 1 else 0)
        lab = f"{int(float(dens)*100)}% obstacles"
        axes[0].plot(sizes, nodes, marker="o", color=col, label=lab)
        axes[1].errorbar(sizes, times, yerr=sds, marker="o", color=col, capsize=3, label=lab)
    axes[0].set_ylabel("mean nodes expanded"); axes[0].set_title("Nodes expanded (solved runs)")
    axes[1].set_ylabel("mean time (ms) ± sd"); axes[1].set_title("Execution time (solved runs)")
    for a in axes:
        a.set_xlabel("grid size"); a.grid(alpha=0.3); a.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "m2_scaling.png"))
    plt.close(fig)


if __name__ == "__main__":
    wavefront()
    small_trace()
    scaling()
    print("figures saved to", OUT)
