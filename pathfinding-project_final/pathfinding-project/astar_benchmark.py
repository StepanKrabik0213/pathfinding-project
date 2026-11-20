"""astar_benchmark.py - record A* performance metrics (Member 3).
"""

import csv
import os
import statistics

import astar
from grid import Grid

SIZES = [10, 25, 50, 100]
DENSITIES = [0.1, 0.2, 0.3]
MAPS_PER_CONFIG = 10  
REPEATS = 5
OUT = os.path.join("results", "astar_metrics.csv")


def main():
    os.makedirs("results", exist_ok=True)
    rows = []

    for size in SIZES:
        for density in DENSITIES:
            for seed in range(MAPS_PER_CONFIG):
                grid = Grid(size, size)
                grid.start, grid.goal = (0, 0), (size - 1, size - 1)
                grid.randomize(density, seed=seed)

                runs = [
                    astar.solve(grid, grid.start, grid.goal)
                    for _ in range(REPEATS)
                ]
                result = runs[0]

                rows.append({
                    "grid": f"{size}x{size}",
                    "density": density,
                    "seed": seed,
                    "found": result["found"],
                    "cost": result["cost"] if result["found"] else "",
                    "nodes_expanded": result["nodes_expanded"],
                    "time_ms": round(
                        statistics.median(run["time"] for run in runs) * 1000,
                        4,
                    ),
                })

    with open(OUT, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    print(
        f"{'grid':>8} {'dens':>5} {'found':>6} {'nodes mean':>11} "
        f"{'nodes sd':>9} {'time ms mean':>13} {'time sd':>8}"
    )

    for size in SIZES:
        for density in DENSITIES:
            group = [
                row for row in rows
                if row["grid"] == f"{size}x{size}"
                and row["density"] == density
            ]
            expanded = [row["nodes_expanded"] for row in group]
            times = [row["time_ms"] for row in group]
            found = sum(row["found"] for row in group)

            print(
                f"{f'{size}x{size}':>8} {int(density * 100):>4}% "
                f"{found:>3}/{len(group):<2} "
                f"{statistics.mean(expanded):>11.1f} "
                f"{statistics.stdev(expanded):>9.1f} "
                f"{statistics.mean(times):>13.3f} "
                f"{statistics.stdev(times):>8.3f}"
            )

    print(f"\nSaved {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
