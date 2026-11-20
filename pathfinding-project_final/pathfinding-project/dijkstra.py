"""dijkstra.py - Dijkstra's shortest-path algorithm on the project grid (Member 2).

How the grid becomes a search problem
-------------------------------------
* Node  : every walkable cell (row, col).
* Edge  : a move to a walkable up / down / left / right neighbour
          (given by grid.neighbors(r, c)).
* Cost  : grid.MOVE_COST per move (1 in this project). All costs are
          non-negative, which is the condition Dijkstra needs to be optimal.

Main data structures
--------------------
* frontier : a min-heap (heapq) of (distance, tie, cell). The cell with the
             smallest known distance from the start is always popped first.
* dist     : dict cell -> best distance found so far (g value).
* prev     : dict cell -> the cell we came from on that best route. Used to
             rebuild the path backwards from the goal.
* visited  : set of cells already expanded. Once a cell is expanded its
             distance is final and it is never expanded again.

Interface (see INTERFACE.md)
----------------------------
solve(grid, start, goal) returns a dict with the keys
found, path, cost, nodes_expanded, time, explored.
"""
import heapq
import itertools
import time

INF = float("inf")


def reconstruct_path(prev, start, goal):
    """Walk the `prev` links back from goal to start, then reverse.

    Returns the list of cells from start to goal (both included).
    """
    path = [goal]
    while path[-1] != start:
        path.append(prev[path[-1]])
    path.reverse()
    return path


def _result(found, path, cost, explored, t0):
    """Build the result dictionary in the format agreed in INTERFACE.md."""
    return {
        "found": found,
        "path": path,
        "cost": cost,
        "nodes_expanded": len(explored),
        "time": time.perf_counter() - t0,
        "explored": explored,
    }


def solve(grid, start, goal):
    """Find the lowest-cost path from `start` to `goal` with Dijkstra's algorithm.

    Parameters
    ----------
    grid  : Grid object (grid.py). Only neighbors(), is_walkable() and
            MOVE_COST are used.
    start : (row, col) start cell.
    goal  : (row, col) goal cell.

    Returns
    -------
    dict with keys found, path, cost, nodes_expanded, time, explored.
    If the goal cannot be reached: found=False, path=[], cost=None.
    """
    t0 = time.perf_counter()
    start, goal = tuple(start), tuple(goal)

    if not grid.is_walkable(*start) or not grid.is_walkable(*goal):
        return _result(False, [], None, [], t0)

    if start == goal:
        return _result(True, [start], 0, [start], t0)

    tie = itertools.count()        
    frontier = [(0, next(tie), start)] 
    dist = {start: 0}
    prev = {}
    visited = set()
    explored = []                 

    while frontier:
        d, _, cell = heapq.heappop(frontier)

        if cell in visited:
            continue
        visited.add(cell)
        explored.append(cell)

        if cell == goal:
            return _result(True, reconstruct_path(prev, start, goal), d, explored, t0)

        for nb in grid.neighbors(*cell):   
            if nb in visited:
                continue
            new_d = d + grid.MOVE_COST
            if new_d < dist.get(nb, INF):
                dist[nb] = new_d
                prev[nb] = cell
                heapq.heappush(frontier, (new_d, next(tie), nb))

    return _result(False, [], None, explored, t0)
