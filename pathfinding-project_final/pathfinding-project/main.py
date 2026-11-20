"""main.py - Humanitarian Route Planner: Dijkstra vs A* on a 2D grid (Member 1).

Run:   python main.py
Mouse: click/drag on the grid to block or unblock cells (Wall tool),
       or choose the Start / Goal tool and click to move them.
Keys:  1 = Dijkstra, 2 = A*, 3 = run both, C = clear path, N = new random map,
       S = scenario map, ESC = quit.

Headless screenshot (for the report):
    python main.py --screenshot out.png --map scenario --algo astar
"""
import argparse
import os
import sys

import dijkstra
import astar
from grid import Grid

# ---- colours ---------------------------------------------------------------
BG = (244, 245, 247)
CELL = (255, 255, 255)
LINE = (210, 214, 220)
OBST = (52, 62, 78)
START = (46, 160, 67)
GOAL = (214, 48, 49)
EXPLORED_D = (170, 205, 245)   # Dijkstra explored
EXPLORED_A = (190, 230, 200)   # A* explored
PATH = (255, 159, 28)
TEXT = (30, 35, 45)
MUTED = (110, 118, 130)
BTN = (226, 231, 238)
BTN_HOVER = (210, 218, 228)
BTN_ON = (60, 110, 200)
OK = (30, 130, 60)
BAD = (200, 40, 40)

WIN_W, WIN_H = 1060, 680
GRID_AREA = 640
PANEL_X = 690

ALGOS = {"dijkstra": ("Dijkstra", dijkstra), "astar": ("A*", astar)}
SIZES = [(10, 10), (25, 25), (50, 50)]
REQUIRED_KEYS = {"found", "path", "cost", "nodes_expanded", "time", "explored"}


class Button:
    def __init__(self, label, action, toggled=lambda: False):
        self.label, self.action, self.toggled = label, action, toggled
        self.rect = None


class App:
    def __init__(self, pygame):
        self.pg = pygame
        self.grid = Grid()
        self.grid.load_scenario()
        self.results = {}
        self.view = "astar"
        self.tool = "wall"
        self.density = 0.2
        self.size_idx = 0
        self.seed = 1
        self.message = "Scenario loaded. Choose an algorithm to run."
        self.drag_value = None
        self.font = self._font(17)
        self.small = self._font(14)
        self.big = self._font(22, bold=True)
        self.buttons = self._make_buttons()

    def _font(self, size, bold=False):
        return self.pg.font.SysFont("dejavusans,arial,helvetica", size, bold=bold)

    # ---- actions ---------------------------------------------------------
    def run(self, key):
        name, module = ALGOS[key]
        g = self.grid
        try:
            res = module.solve(g, g.start, g.goal)
        except Exception as exc:  # surface integration problems in the UI
            self.message = f"{name} raised an error: {exc}"
            return
        missing = REQUIRED_KEYS - set(res)
        if missing:
            self.message = f"{name} result is missing keys: {sorted(missing)}"
            return
        self.results[key] = res
        self.view = key
        if res["found"]:
            self.message = f"{name}: path found, cost {res['cost']}."
        else:
            self.message = f"{name}: goal is UNREACHABLE (no open route)."

    def run_both(self):
        self.run("dijkstra")
        self.run("astar")
        d, a = self.results.get("dijkstra"), self.results.get("astar")
        if d and a:
            if d["found"] != a["found"] or (d["found"] and d["cost"] != a["cost"]):
                self.message = "WARNING: algorithms disagree on result. Check modules."
            elif d["found"]:
                self.message = f"Both found cost {d['cost']}. Use 'Switch view' to compare."
            else:
                self.message = "Both report the goal is UNREACHABLE."

    def clear_path(self):
        self.results = {}
        self.message = "Path cleared. Ready for another run."

    def reset_all(self):
        self.grid.clear_obstacles()
        self.results = {}
        self.message = "Grid reset: all cells open."

    def _new_map(self, fn, msg):
        self.results = {}
        fn()
        self.message = msg

    def scenario(self):
        self._new_map(self.grid.load_scenario, "Scenario: Dubai (green) to crisis destination (red).")

    def unreachable(self):
        self._new_map(self.grid.load_unreachable, "Unreachable demo: every gateway is closed.")

    def random_map(self):
        r, c = SIZES[self.size_idx]
        if (self.grid.rows, self.grid.cols) != (r, c):
            self.grid = Grid(r, c)
        self.seed += 1
        self._new_map(lambda: self.grid.randomize(self.density, self.seed),
                      f"Random map {r}x{c}, density {int(self.density*100)}%, seed {self.seed}.")

    def change_density(self, delta):
        self.density = min(0.4, max(0.1, round(self.density + delta, 2)))
        self.message = f"Density set to {int(self.density*100)}%. Press 'New random map'."

    def change_size(self):
        self.size_idx = (self.size_idx + 1) % len(SIZES)
        r, c = SIZES[self.size_idx]
        self.message = f"Size set to {r}x{c}. Press 'New random map'."

    def switch_view(self):
        other = "dijkstra" if self.view == "astar" else "astar"
        self.view = other
        self.message = f"Showing {ALGOS[other][0]} result on the grid."

    # ---- buttons ---------------------------------------------------------
    def _make_buttons(self):
        set_tool = lambda t: (lambda: setattr(self, "tool", t))
        return [
            [Button("Wall", set_tool("wall"), lambda: self.tool == "wall"),
             Button("Start", set_tool("start"), lambda: self.tool == "start"),
             Button("Goal", set_tool("goal"), lambda: self.tool == "goal")],
            [Button("Run Dijkstra", lambda: self.run("dijkstra")),
             Button("Run A*", lambda: self.run("astar"))],
            [Button("Run both", self.run_both), Button("Switch view", self.switch_view)],
            [Button("Clear path", self.clear_path), Button("Reset grid", self.reset_all)],
            [Button("Scenario map", self.scenario), Button("Unreachable demo", self.unreachable)],
            [Button("New random map", self.random_map)],
            [Button("Density -", lambda: self.change_density(-0.1)),
             Button("Density +", lambda: self.change_density(0.1)),
             Button("Size", self.change_size)],
        ]

    def layout_buttons(self):
        x0, y, w, gap, h = PANEL_X, 70, WIN_W - PANEL_X - 20, 8, 34
        for row in self.buttons:
            bw = (w - gap * (len(row) - 1)) // len(row)
            for i, b in enumerate(row):
                b.rect = self.pg.Rect(x0 + i * (bw + gap), y, bw, h)
            y += h + gap
        return y

    # ---- geometry --------------------------------------------------------
    def cell_size(self):
        return max(4, min(GRID_AREA // self.grid.cols, GRID_AREA // self.grid.rows))

    def cell_at(self, pos):
        cs = self.cell_size()
        c, r = (pos[0] - 20) // cs, (pos[1] - 20) // cs
        return (r, c) if self.grid.in_bounds(r, c) and pos[0] >= 20 and pos[1] >= 20 else None

    # ---- input -----------------------------------------------------------
    def edit_cell(self, cell, first=False):
        g, (r, c) = self.grid, cell
        if self.tool == "start":
            changed = g.set_start(r, c)
        elif self.tool == "goal":
            changed = g.set_goal(r, c)
        else:
            if first:
                self.drag_value = (r, c) not in g.blocked
            if (r, c) in (g.start, g.goal) or ((r, c) in g.blocked) == self.drag_value:
                return
            changed = g.toggle_obstacle(r, c)
        if changed:
            self.results = {}

    def handle(self, event):
        pg = self.pg
        if event.type == pg.MOUSEBUTTONDOWN and event.button == 1:
            for row in self.buttons:
                for b in row:
                    if b.rect.collidepoint(event.pos):
                        b.action()
                        return
            cell = self.cell_at(event.pos)
            if cell:
                self.edit_cell(cell, first=True)
        elif event.type == pg.MOUSEMOTION and event.buttons[0] and self.tool == "wall":
            cell = self.cell_at(event.pos)
            if cell:
                self.edit_cell(cell)
        elif event.type == pg.MOUSEBUTTONUP:
            self.drag_value = None
        elif event.type == pg.KEYDOWN:
            keys = {pg.K_1: lambda: self.run("dijkstra"), pg.K_2: lambda: self.run("astar"),
                    pg.K_3: self.run_both, pg.K_c: self.clear_path, pg.K_n: self.random_map,
                    pg.K_s: self.scenario}
            if event.key in keys:
                keys[event.key]()

    # ---- drawing ---------------------------------------------------------
    def draw(self, screen):
        pg, g = self.pg, self.grid
        screen.fill(BG)
        cs = self.cell_size()
        res = self.results.get(self.view)
        explored = set(res["explored"]) if res else set()
        path = set(res["path"]) if res else set()
        ex_col = EXPLORED_D if self.view == "dijkstra" else EXPLORED_A
        for r in range(g.rows):
            for c in range(g.cols):
                rect = pg.Rect(20 + c * cs, 20 + r * cs, cs, cs)
                cell = (r, c)
                if cell in g.blocked:
                    col = OBST
                elif cell in path:
                    col = PATH
                elif cell in explored:
                    col = ex_col
                else:
                    col = CELL
                pg.draw.rect(screen, col, rect)
                if cs >= 8:
                    pg.draw.rect(screen, LINE, rect, 1)
        for cell, col, label in ((g.start, START, "S"), (g.goal, GOAL, "G")):
            rect = pg.Rect(20 + cell[1] * cs, 20 + cell[0] * cs, cs, cs)
            pg.draw.rect(screen, col, rect)
            if cs >= 14:
                t = self.small.render(label, True, (255, 255, 255))
                screen.blit(t, t.get_rect(center=rect.center))
        self.draw_panel(screen)

    def draw_panel(self, screen):
        pg = self.pg
        screen.blit(self.big.render("Humanitarian Route Planner", True, TEXT), (PANEL_X, 18))
        screen.blit(self.small.render("Dijkstra vs A* on a 2D grid", True, MUTED), (PANEL_X, 46))
        y = self.layout_buttons()
        mouse = pg.mouse.get_pos()
        for row in self.buttons:
            for b in row:
                on = b.toggled()
                col = BTN_ON if on else (BTN_HOVER if b.rect.collidepoint(mouse) else BTN)
                pg.draw.rect(screen, col, b.rect, border_radius=6)
                t = self.small.render(b.label, True, (255, 255, 255) if on else TEXT)
                screen.blit(t, t.get_rect(center=b.rect.center))
        info = (f"Grid {self.grid.rows}x{self.grid.cols}   obstacles "
                f"{int(self.grid.obstacle_density()*100)}%   random density {int(self.density*100)}%")
        screen.blit(self.small.render(info, True, MUTED), (PANEL_X, y + 2))
        y += 28
        for key in ("dijkstra", "astar"):
            y = self.draw_card(screen, key, y)
        # legend
        y += 2
        items = [(START, "Start (Dubai)"), (GOAL, "Goal (destination)"),
                 (OBST, "Closed route"), (EXPLORED_D, "Explored: Dijkstra"),
                 (EXPLORED_A, "Explored: A*"), (PATH, "Final path")]
        for i, (col, label) in enumerate(items):
            x = PANEL_X + (i % 2) * 175
            yy = y + (i // 2) * 22
            pg.draw.rect(screen, col, pg.Rect(x, yy + 2, 14, 14))
            pg.draw.rect(screen, LINE, pg.Rect(x, yy + 2, 14, 14), 1)
            screen.blit(self.small.render(label, True, TEXT), (x + 20, yy))
        self.draw_wrapped(screen, self.message, PANEL_X, WIN_H - 40, WIN_W - PANEL_X - 20)

    def draw_card(self, screen, key, y):
        pg = self.pg
        name = ALGOS[key][0]
        h = 70
        rect = pg.Rect(PANEL_X, y, WIN_W - PANEL_X - 20, h)
        pg.draw.rect(screen, (255, 255, 255), rect, border_radius=8)
        pg.draw.rect(screen, BTN_ON if key == self.view and key in self.results else LINE, rect, 2, border_radius=8)
        screen.blit(self.font.render(name, True, TEXT), (rect.x + 10, rect.y + 6))
        res = self.results.get(key)
        if not res:
            screen.blit(self.small.render("not run yet", True, MUTED), (rect.x + 10, rect.y + 34))
        else:
            ok = res["found"]
            status = "Path found" if ok else "Goal unreachable"
            screen.blit(self.font.render(status, True, OK if ok else BAD), (rect.x + 110, rect.y + 6))
            cost = res["cost"] if ok else "-"
            line = (f"cost {cost}   nodes expanded {res['nodes_expanded']}   "
                    f"time {res['time']*1000:.3f} ms")
            screen.blit(self.small.render(line, True, TEXT), (rect.x + 10, rect.y + 38))
        return y + h + 8

    def draw_wrapped(self, screen, text, x, y, width):
        words, line, yy = text.split(), "", y
        for w in words:
            test = (line + " " + w).strip()
            if self.small.size(test)[0] > width:
                screen.blit(self.small.render(line, True, TEXT), (x, yy))
                line, yy = w, yy + 18
            else:
                line = test
        screen.blit(self.small.render(line, True, TEXT), (x, yy))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--screenshot", help="save a PNG and exit (headless)")
    ap.add_argument("--map", default="scenario", choices=["scenario", "unreachable", "random"])
    ap.add_argument("--algo", default="astar", choices=["dijkstra", "astar", "both", "none"])
    args = ap.parse_args()
    if args.screenshot:
        os.environ["SDL_VIDEODRIVER"] = "dummy"
    import pygame
    pygame.init()
    screen = pygame.display.set_mode((WIN_W, WIN_H))
    pygame.display.set_caption("Humanitarian Route Planner - Dijkstra vs A*")
    app = App(pygame)

    if args.screenshot:
        if args.map == "unreachable":
            app.unreachable()
        elif args.map == "random":
            app.random_map()
        if args.algo == "both":
            app.run_both()
        elif args.algo != "none":
            app.run(args.algo)
        app.draw(screen)
        pygame.image.save(screen, args.screenshot)
        print("saved", args.screenshot)
        return

    clock = pygame.time.Clock()
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT or (event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE):
                pygame.quit()
                sys.exit()
            app.handle(event)
        app.draw(screen)
        pygame.display.flip()
        clock.tick(60)


if __name__ == "__main__":
    main()
