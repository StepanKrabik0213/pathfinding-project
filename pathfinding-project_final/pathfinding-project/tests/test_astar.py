"""Member 3 tests: A* pathfinding (astar.py).

Covers Manhattan distance, shortest paths, obstacles, unreachable goals,
edge cases, GUI result format, and optimality on 20 randomized grids.

"""

import os
import random
import sys
from collections import deque

import pytest

# Allow imports when this file is located inside the project's tests/ folder.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import astar
import dijkstra
from grid import Grid


def assert_valid_path(grid, result, start, goal):
    """Verify that a returned route really connects S to G legally."""
    assert result["found"] is True
    path = result["path"]
    assert path, "A successful search must return a nonempty path"
    assert path[0] == start
    assert path[-1] == goal
    assert len(path) == len(set(path)), "A shortest path should not repeat cells"

    for cell in path:
        assert grid.is_walkable(*cell), f"Path enters a wall/out-of-bounds cell: {cell}"

    for current, following in zip(path, path[1:]):
        distance = astar.manhattan(current, following)
        assert distance == 1, f"Illegal move from {current} to {following}"

    assert result["cost"] == (len(path) - 1) * grid.MOVE_COST


def bfs_shortest_cost(grid, start, goal):
    """Independent shortest-path reference for uniform movement costs."""
    if not (grid.is_walkable(*start) and grid.is_walkable(*goal)):
        return None

    queue = deque([(start, 0)])
    visited = {start}

    while queue:
        cell, steps = queue.popleft()
        if cell == goal:
            return steps * grid.MOVE_COST

        for neighbor in grid.neighbors(*cell):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, steps + 1))

    return None


# --- 1. Heuristic ----------------------------------------------------------

@pytest.mark.parametrize(
    "current, goal, expected",
    [
        ((0, 0), (3, 4), 7),
        ((5, 8), (2, 3), 8),
        ((4, 4), (4, 4), 0),
    ],
)
def test_manhattan_distance(current, goal, expected):
    assert astar.manhattan(current, goal) == expected
    assert astar.manhattan(goal, current) == expected


# --- 2. Basic shortest paths ----------------------------------------------

def test_straight_line():
    grid = Grid.from_text(["S...G"])
    result = astar.solve(grid, grid.start, grid.goal)
    assert result["cost"] == 4
    assert result["path"] == [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)]
    assert_valid_path(grid, result, grid.start, grid.goal)


def test_open_grid_shortest_cost():
    grid = Grid(10, 10)
    start, goal = (0, 0), (9, 9)
    result = astar.solve(grid, start, goal)
    assert result["cost"] == 18  # Manhattan distance with no obstacles
    assert_valid_path(grid, result, start, goal)


def test_detour_around_walls():
    grid = Grid.from_text([
        "S#...",
        ".#.#.",
        "...#G",
    ])
    result = astar.solve(grid, grid.start, grid.goal)
    assert result["cost"] == 10
    assert_valid_path(grid, result, grid.start, grid.goal)


def test_narrow_corridor():
    grid = Grid.from_text([
        "S.........",
        "#########.",
        "G.........",
    ])
    result = astar.solve(grid, grid.start, grid.goal)
    assert result["cost"] == 20
    assert_valid_path(grid, result, grid.start, grid.goal)


def test_team_scenario():
    grid = Grid()
    grid.load_scenario()
    result = astar.solve(grid, grid.start, grid.goal)
    expected = bfs_shortest_cost(grid, grid.start, grid.goal)
    assert expected is not None
    assert result["cost"] == expected
    assert_valid_path(grid, result, grid.start, grid.goal)
    assert not set(result["explored"]) & grid.blocked


# --- 3. Unreachable destinations ------------------------------------------

def test_unreachable_goal():
    grid = Grid()
    grid.load_unreachable()
    result = astar.solve(grid, grid.start, grid.goal)
    assert result["found"] is False
    assert result["path"] == []
    assert result["cost"] is None
    assert result["nodes_expanded"] > 0
    assert grid.goal not in result["explored"]


def test_start_surrounded_by_walls():
    grid = Grid.from_text([
        ".#...",
        "#S#..",
        ".#..G",
    ])
    result = astar.solve(grid, grid.start, grid.goal)
    assert result["found"] is False
    assert result["path"] == []
    assert result["nodes_expanded"] == 1


# --- 4. Edge cases ---------------------------------------------------------

def test_start_equals_goal():
    grid = Grid(5, 5)
    start = (2, 2)
    result = astar.solve(grid, start, start)
    assert result["found"] is True
    assert result["path"] == [start]
    assert result["cost"] == 0
    assert result["nodes_expanded"] == 1


@pytest.mark.parametrize(
    "start, goal",
    [
        ((-1, 0), (4, 4)),       # Start outside grid
        ((0, 0), (5, 0)),        # Goal outside grid
        ((1, 1), (4, 4)),        # Blocked start
        ((0, 0), (3, 3)),        # Blocked goal
    ],
)
def test_invalid_or_blocked_endpoint(start, goal):
    grid = Grid(5, 5)
    grid.blocked.update({(1, 1), (3, 3)})
    result = astar.solve(grid, start, goal)
    assert result["found"] is False
    assert result["path"] == []
    assert result["cost"] is None
    assert result["nodes_expanded"] == 0
    assert result["explored"] == []


def test_single_cell_grid():
    grid = Grid(1, 1)
    result = astar.solve(grid, (0, 0), (0, 0))
    assert result["found"] is True
    assert result["path"] == [(0, 0)]
    assert result["cost"] == 0


# --- 5. Interface and correctness -----------------------------------------

def test_gui_result_format_and_explored_cells():
    grid = Grid(10, 10)
    result = astar.solve(grid, (0, 0), (9, 9))

    assert set(result) == {
        "found", "path", "cost", "nodes_expanded", "time", "explored"
    }
    assert isinstance(result["found"], bool)
    assert isinstance(result["path"], list)
    assert isinstance(result["nodes_expanded"], int)
    assert isinstance(result["time"], float) and result["time"] >= 0
    assert isinstance(result["explored"], list)
    assert result["nodes_expanded"] == len(result["explored"])
    assert len(result["explored"]) == len(set(result["explored"]))
    assert result["explored"][0] == (0, 0)
    assert result["explored"][-1] == (9, 9)
    assert all(grid.is_walkable(*cell) for cell in result["explored"])


def test_search_does_not_change_grid():
    grid = Grid()
    grid.load_scenario()
    before = (grid.rows, grid.cols, grid.start, grid.goal, set(grid.blocked))
    astar.solve(grid, grid.start, grid.goal)
    after = (grid.rows, grid.cols, grid.start, grid.goal, set(grid.blocked))
    assert after == before


def test_move_cost_is_respected():
    grid = Grid.from_text(["S...G"])
    grid.MOVE_COST = 3
    result = astar.solve(grid, grid.start, grid.goal)
    assert result["cost"] == 12
    assert_valid_path(grid, result, grid.start, grid.goal)


@pytest.mark.parametrize("seed", range(20))
def test_optimal_on_random_maps(seed):
    """Check A* against both independent BFS and Member 2's Dijkstra."""
    rng = random.Random(seed)
    size = rng.choice([10, 20, 35])
    density = rng.choice([0.1, 0.2, 0.3, 0.4])

    grid = Grid(size, size)
    grid.randomize(density, seed=seed)

    result = astar.solve(grid, grid.start, grid.goal)
    bfs_cost = bfs_shortest_cost(grid, grid.start, grid.goal)
    dijkstra_result = dijkstra.solve(grid, grid.start, grid.goal)

    assert result["cost"] == bfs_cost == dijkstra_result["cost"]
    assert result["found"] == dijkstra_result["found"]

    if bfs_cost is None:
        assert result["found"] is False
        assert result["path"] == []
    else:
        assert_valid_path(grid, result, grid.start, grid.goal)

    assert result["nodes_expanded"] == len(result["explored"])
    assert len(set(result["explored"])) == len(result["explored"])
