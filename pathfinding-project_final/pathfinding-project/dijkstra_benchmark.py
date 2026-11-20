"""dijkstra_benchmark.py - record Dijkstra performance metrics (Member 2).

Runs dijkstra.solve on seeded random grids and saves one row per run to
results/dijkstra_metrics.csv, then prints mean and standard deviation per
configuration. Member 4's experiments.py does the full Dijkstra-vs-A*
comparison; this script only validates and records Dijkstra on its own.

Run:  python dijkstra_benchmark.py
"""
import csv
import os
import statistics

import dijkstra
from grid import Grid

SIZES = [10, 25, 50, 100]
DENSITIES = [0.1, 0.2, 0.3]
MAPS_PER_CONFIG = 10
REPEATS = 5              
OUT = os.path.join("results", "dijkstra_metrics.csv")


def main():
    os.makedirs("results", exist_ok=True)
    rows = []
    for size in SIZES:
        for density in DENSITIES:
            for seed in range(MAPS_PER_CONFIG):
                g = Grid(size, size)
                g.start, g.goal = (0, 0), (size - 1, size - 1)
                g.randomize(density, seed=seed)
                runs = [dijkstra.solve(g, g.start, g.goal) for _ in range(REPEATS)]
                res = runs[0]
                rows.append({
                    "grid": f"{size}x{size}",
                    "density": density,
                    "seed": seed,
                    "found": res["found"],
                    "cost": res["cost"] if res["found"] else "",
                    "nodes_expanded": res["nodes_expanded"],
                    "time_ms": round(statistics.median(r["time"] for r in runs) * 1000, 4),
                })

    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    print(f"{'grid':>8} {'dens':>5} {'found':>6} {'nodes mean':>11} {'nodes sd':>9} "
          f"{'time ms mean':>13} {'time sd':>8}")
    for size in SIZES:
        for density in DENSITIES:
            grp = [r for r in rows if r["grid"] == f"{size}x{size}" and r["density"] == density]
            nodes = [r["nodes_expanded"] for r in grp]
            times = [r["time_ms"] for r in grp]
            found = sum(r["found"] for r in grp)
            label = f"{size}x{size}"
            print(f"{label:>8} {int(density*100):>4}% {found:>3}/{len(grp):<2} "
                  f"{statistics.mean(nodes):>11.1f} {statistics.stdev(nodes):>9.1f} "
                  f"{statistics.mean(times):>13.3f} {statistics.stdev(times):>8.3f}")
    print(f"\nSaved {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
