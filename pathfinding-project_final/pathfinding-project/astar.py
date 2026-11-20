import heapq
import math
import time

def manhattan(current, goal):
    """Calculate Manhattan distance between two cells."""
    return abs(current[0] - goal[0]) + abs(current[1] - goal[1])


def solve(grid, start, goal):
    start_time = time.perf_counter()

    path = []
    explored = []
    found = False
    cost = None

    if grid.is_walkable(*start) and grid.is_walkable(*goal):

        cell_count = grid.rows * grid.cols
        g_score = [math.inf] * cell_count
        came_from = [-1] * cell_count

        def cell_index(position):
            return position[0] * grid.cols + position[1]

        g_score[cell_index(start)] = 0

        start_h = manhattan(start, goal) * grid.MOVE_COST
        open_set = [(start_h, 0, start)]

        while open_set:
            _, current_g, current = heapq.heappop(open_set)
            current_index = cell_index(current)

            if current_g > g_score[current_index]:
                continue

            explored.append(current)

            if current == goal:
                found = True
                cost = current_g

                path_index = current_index

                while path_index != -1:
                    row, col = divmod(path_index, grid.cols)
                    path.append((row, col))
                    path_index = came_from[path_index]

                path.reverse()
                break

            for neighbor in grid.neighbors(*current):

                tentative_g = current_g + grid.MOVE_COST
                neighbor_index = cell_index(neighbor)

                if tentative_g < g_score[neighbor_index]:

                    g_score[neighbor_index] = tentative_g
                    came_from[neighbor_index] = current_index

                    h = manhattan(neighbor, goal) * grid.MOVE_COST

                    heapq.heappush(
                        open_set,
                        (tentative_g + h, tentative_g, neighbor)
                    )

    return {
        "found": found,
        "path": path,
        "cost": cost,
        "nodes_expanded": len(explored),
        "time": time.perf_counter() - start_time,
        "explored": explored
    }
