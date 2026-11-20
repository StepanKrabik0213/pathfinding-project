"""grid.py - 2D grid environment (Member 1).

A Grid is a rows x cols board. Each cell is either walkable or blocked.
In the project theme (Humanitarian Route Planner), a blocked cell is a
route segment that is unavailable (closed airport, port or road); a walkable
cell is a usable segment. Movement is 4-directional (up, down, left, right)
and every move costs 1, so Manhattan distance is an admissible heuristic.

The algorithm modules (dijkstra.py, astar.py) only need:
    grid.rows, grid.cols, grid.start, grid.goal
    grid.is_walkable(r, c)
    grid.neighbors(r, c)      -> list of (r, c) walkable neighbours
    grid.MOVE_COST            -> cost of one move (1)
"""
import random

Cell = tuple  

SCENARIO_MAP = [
    "..............................",
    "..............#...............",
    "....###.......#......#####....",
    "....###.......#..............#",
    "....###.......#..............#",
    "..............................",
    "...........####......#........",
    ".......##..#..#......#...##...",
    ".......##..#..#......#...##...",
    ".S.....##..#..#......#...##.G.",
    ".......##..#..#..............#",
    ".......##..#..#..............#",
    ".......##..#..#......#........",
    "...........#..#......#........",
    "...........####......#........",
    ".............................#",
    "..###########################.",
    "..............................",
    "......###.........###.........",
    "..............................",
]


class Grid:
    MOVE_COST = 1
    DIRECTIONS = ((-1, 0), (1, 0), (0, -1), (0, 1)) 

    def __init__(self, rows=20, cols=30):
        self.rows = rows
        self.cols = cols
        self.blocked = set()
        self.start = (rows // 2, 1)
        self.goal = (rows // 2, cols - 2)

    def in_bounds(self, r, c):
        return 0 <= r < self.rows and 0 <= c < self.cols

    def is_walkable(self, r, c):
        return self.in_bounds(r, c) and (r, c) not in self.blocked

    def neighbors(self, r, c):
        out = []
        for dr, dc in self.DIRECTIONS:
            nr, nc = r + dr, c + dc
            if self.is_walkable(nr, nc):
                out.append((nr, nc))
        return out

    def obstacle_density(self):
        return len(self.blocked) / (self.rows * self.cols)

    def toggle_obstacle(self, r, c):
        """Flip a cell between walkable and blocked. Start/goal are protected."""
        if not self.in_bounds(r, c) or (r, c) in (self.start, self.goal):
            return False
        self.blocked.symmetric_difference_update({(r, c)})
        return True

    def set_start(self, r, c):
        if not self.in_bounds(r, c) or (r, c) == self.goal:
            return False
        self.blocked.discard((r, c))
        self.start = (r, c)
        return True

    def set_goal(self, r, c):
        if not self.in_bounds(r, c) or (r, c) == self.start:
            return False
        self.blocked.discard((r, c))
        self.goal = (r, c)
        return True

    def clear_obstacles(self):
        self.blocked.clear()

    def randomize(self, density=0.2, seed=None):
        """Block each non-start/goal cell with probability `density`.
        The same seed always gives the same layout (needed for fair tests)."""
        if not 0 <= density < 1:
            raise ValueError("density must be in [0, 1)")
        rng = random.Random(seed)
        self.blocked = {
            (r, c)
            for r in range(self.rows)
            for c in range(self.cols)
            if (r, c) not in (self.start, self.goal) and rng.random() < density
        }

    def load_scenario(self):
        """Load the built-in Dubai-to-crisis-destination scenario."""
        self.load_text(SCENARIO_MAP)

    def load_unreachable(self):
        """Scenario where every gateway is closed: the goal cannot be reached."""
        self.load_text(SCENARIO_MAP)
        mid = self.cols - 4
        for r in range(self.rows):
            if (r, mid) not in (self.start, self.goal):
                self.blocked.add((r, mid))

    def load_text(self, lines):
        """'#' blocked, '.' walkable, 'S' start, 'G' goal."""
        self.rows, self.cols = len(lines), len(lines[0])
        self.blocked = set()
        for r, line in enumerate(lines):
            if len(line) != self.cols:
                raise ValueError("all rows must have the same length")
            for c, ch in enumerate(line):
                if ch == "#":
                    self.blocked.add((r, c))
                elif ch == "S":
                    self.start = (r, c)
                elif ch == "G":
                    self.goal = (r, c)

    def to_text(self):
        rows = []
        for r in range(self.rows):
            row = ""
            for c in range(self.cols):
                if (r, c) == self.start:
                    row += "S"
                elif (r, c) == self.goal:
                    row += "G"
                elif (r, c) in self.blocked:
                    row += "#"
                else:
                    row += "."
            rows.append(row)
        return rows

    @classmethod
    def from_text(cls, lines):
        g = cls(len(lines), len(lines[0]))
        g.load_text(lines)
        return g
