// build_m2.js - builds Member2_Report_Sections.docx (run inside report/: node build_m2.js)
const fs = require('fs');
const d = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, AlignmentType, LevelFormat, BorderStyle } = d;

const P = (t, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o, children: Array.isArray(t) ? t : [new TextRun(t)] });
const B = (t) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 }, children: Array.isArray(t) ? t : [new TextRun(t)] });
const N = (t) => new Paragraph({ numbering: { reference: 'num', level: 0 }, spacing: { after: 60 }, children: Array.isArray(t) ? t : [new TextRun(t)] });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const b = (t) => new TextRun({ text: t, bold: true });
const r = (t) => new TextRun(t);
const code = (t) => new TextRun({ text: t, font: 'Courier New', size: 20 });
const TEAM = (t) => new TextRun({ text: ` [TEAM: ${t}]`, bold: true, color: 'B45309' });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFC5CE' };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, rows) {
  const total = widths.reduce((a, c) => a + c, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((row, i) => new TableRow({ tableHeader: i === 0, children: row.map((c, j) => new TableCell({
      width: { size: widths[j], type: WidthType.DXA }, borders,
      shading: i === 0 ? { fill: 'E2E7EE', type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: i === 0, size: 20 })] })] })) })),
  });
}
const caption = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [new TextRun({ text: t, italics: true, size: 20 })] });

function img(file, cap, w, h, width = 560) {
  const height = Math.round(width * h / w);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width, height },
        altText: { title: cap, description: cap, name: cap } })] }),
    caption(cap),
  ];
}

// code block: one shaded paragraph per line, so indentation is kept
function codeBlock(src) {
  const lines = src.replace(/\n$/, '').split('\n');
  return lines.map((line, i) => new Paragraph({
    shading: { fill: 'F3F4F6', type: ShadingType.CLEAR, color: 'auto' },
    spacing: { after: 0, before: i === 0 ? 120 : 0, line: 240 },
    keepLines: true, keepNext: i < lines.length - 1,
    indent: { left: 200 },
    children: [new TextRun({ text: line.length ? line.replace(/ /g, ' ') : ' ', font: 'Courier New', size: 17 })],
  }));
}

const S = 'screenshots_m2/';
const src = fs.readFileSync('../dijkstra.py', 'utf8');
const solveBody = src.slice(src.indexOf('    tie = itertools.count()'), src.indexOf('    # Edge case 3'));

const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [r('Humanitarian Route Planner: Dijkstra vs A* Search')] }),
  P([new TextRun({ text: 'CSCI218 Topic 8, Intelligent Pathfinding. Member 2 report sections: Dijkstra’s algorithm, implementation and validation.', italics: true })]),
  P([new TextRun({ text: 'Section numbers continue from Member 1 (sections 1 to 5, Figures 1 to 4). Items marked [TEAM: ...] need input from other members before submission.', bold: true, color: 'B45309' })]),

  // ------------------------------------------------------------------ 6
  H1('6. Dijkstra’s Algorithm'),
  H2('6.1 Dijkstra in simple terms'),
  P('Imagine dropping a stone into a pond at Dubai. The ripple spreads outward evenly, reaching nearby places first and distant places later. Dijkstra’s algorithm works the same way: starting at the start cell, it always visits the closest unvisited cell next, then records how far each of that cell’s neighbours is from the start. Because cells are visited strictly in order of distance, the first time the ripple reaches the goal, the distance it carries is the shortest possible one.'),
  P('In our humanitarian-route model, this is a planner that checks every usable route segment one step further out from Dubai, ignoring closed airports, ports and roads, until the crisis destination is reached. It never guesses where the destination is, which makes it reliable but means it also searches in directions that lead away from the goal.'),

  H2('6.2 The grid as a search problem'),
  P('The grid from Member 1 is turned into a graph search problem as follows.'),
  table([2300, 6726], [
    ['Element', 'Definition in our project'],
    ['State (node)', 'A walkable cell (row, col). Blocked cells are not states.'],
    ['Initial state', 'grid.start, the cell representing Dubai'],
    ['Actions', 'Move up, down, left or right to a walkable neighbour, given by grid.neighbors(r, c). No diagonals.'],
    ['Transition model', 'Moving from (r, c) in direction (dr, dc) leads to (r + dr, c + dc)'],
    ['Step cost', 'grid.MOVE_COST = 1 for every move (non-negative)'],
    ['Goal test', 'The cell being expanded equals grid.goal'],
    ['Path cost g(n)', 'Sum of step costs from the start, i.e. number of moves'],
    ['Solution', 'A list of cells from start to goal with the lowest path cost, or “unreachable”'],
  ]),
  P(''),
  P('A grid with R rows and C columns therefore has at most V = R × C nodes, and each node has at most 4 edges, so the number of edges is E ≤ 4V.'),

  H2('6.3 Data structures'),
  table([2000, 2300, 4726], [
    ['Structure', 'Python type', 'Role'],
    ['Priority queue (frontier)', 'list used as a min-heap with heapq', 'Holds (distance, tie, cell). heappop always returns the cell with the smallest known distance in O(log n).'],
    ['dist', 'dict: cell → int', 'Best distance from the start found so far for each discovered cell.'],
    ['prev', 'dict: cell → cell', 'The cell we came from on that best route. Followed backwards from the goal to rebuild the path.'],
    ['visited', 'set of cells', 'Cells already expanded. Their distance is final, so they are never expanded again.'],
    ['explored', 'list of cells', 'Expansion order, returned so the interface can shade explored cells and so nodes_expanded can be counted.'],
    ['tie', 'itertools.count()', 'Increasing counter added to each heap entry so equal distances are served first-in, first-out and two cells are never compared directly.'],
  ]),
  P(''),
  P([b('Lazy deletion. '), r('Python’s heapq has no “decrease key” operation. When a shorter route to a cell is found, we push a new entry instead of updating the old one. The old, larger entry is skipped when it is later popped because the cell is already in visited. This keeps the code simple and keeps the same O((V + E) log V) bound.')]),

  H2('6.4 Algorithm steps'),
  N('If start or goal is blocked or outside the grid, return “not found”. If start equals goal, return a path of one cell with cost 0.'),
  N('Put the start cell in the priority queue with distance 0.'),
  N('Pop the cell with the smallest distance. If it was already visited, skip it (stale entry). Otherwise mark it visited and add it to explored.'),
  N('If this cell is the goal, rebuild the path from prev and return it with its distance as the cost.'),
  N('Relaxation: for each walkable neighbour not yet visited, compute new_d = d + MOVE_COST. If new_d is smaller than the neighbour’s current dist, update dist and prev and push (new_d, neighbour).'),
  N('Repeat from step 3. If the queue becomes empty, every reachable cell has been examined without finding the goal, so return “unreachable”.'),
  P([b('Path reconstruction and cost. '), r('Starting at the goal, the algorithm follows prev links back to the start, then reverses the list. The reported cost is the goal’s final distance, which always equals (number of cells in path − 1) × MOVE_COST; the unit tests check this for every returned path.')]),

  H2('6.5 Worked example'),
  P('Figure 5 shows the algorithm on a small 3×5 map. Cells are popped in order of distance: all cells at distance 1 before any at distance 2, and so on. The blue cells at the bottom left are expanded because they are as close to the start as cells on the real route, even though they lead to a dead end. This is the “search in all directions” behaviour that A* is designed to reduce.'),
  ...img(S + 'm2_small_trace.png', 'Figure 5. Worked example: final distance d and pop order for every expanded cell. Path cost 6, 12 cells expanded.', 840, 532, 470),

  H2('6.6 Why Dijkstra returns an optimal path'),
  P('Dijkstra is guaranteed to return a lowest-cost path when every edge cost is non-negative. The argument is short:'),
  B([b('Claim. '), r('When a cell u is popped from the queue for the first time, dist[u] is the true shortest distance from the start to u.')]),
  B([b('Reason. '), r('Suppose a shorter route to u existed. That route leaves the set of visited cells at some point, so it passes through a frontier cell x that is still in the queue. Its cost to x is already at least dist[x], and because costs are never negative, the rest of the route from x to u cannot make it shorter. So that route costs at least dist[x] ≥ dist[u], since u was popped before x. This contradicts the route being shorter, so dist[u] is optimal.')]),
  B([b('Consequence. '), r('Because we test for the goal when it is popped, not when it is first discovered, the returned cost is the shortest possible. Testing on discovery could return a longer route if a cheaper one is found later.')]),
  B([b('When it fails. '), r('With a negative edge cost, a route could become cheaper after its end cell has already been finalised, so the guarantee breaks (Bellman–Ford is needed then). Our grid has only cost-1 moves, so the condition holds.')]),
  P('The unit tests confirm this empirically: on 40 seeded random maps the cost returned by our Dijkstra equals the cost found by an independent breadth-first search, which is exact when all moves cost the same (Section 8).'),

  H2('6.7 Complexity, advantages and disadvantages'),
  table([2600, 6426], [
    ['Measure', 'Value for our grid'],
    ['Time', 'O((V + E) log V) with a binary heap. With E ≤ 4V this is O(V log V).'],
    ['Space', 'O(V) for dist, prev, visited and the heap (lazy deletion can add up to E entries, still O(V)).'],
    ['Worst case', 'Goal unreachable or in the far corner: almost every walkable cell is expanded.'],
    ['Optimal?', 'Yes, for non-negative edge costs.'],
    ['Complete?', 'Yes, on a finite grid it either finds the goal or proves it unreachable.'],
  ]),
  P(''),
  table([4513, 4513], [
    ['Advantages', 'Disadvantages'],
    ['Always returns the shortest path (non-negative costs).', 'Uninformed: expands cells in every direction, including away from the goal.'],
    ['Needs no heuristic, so there is no risk of a bad estimate.', 'Expands many more nodes than A* when the goal is far and the map is open.'],
    ['Works with any non-negative costs, e.g. future risk-weighted routes.', 'Cannot handle negative costs.'],
    ['One run from the start gives shortest distances to every reachable cell.', 'The heap adds a log V factor and memory for every discovered cell.'],
    ['Proves unreachability by exhausting the reachable area.', 'Must re-run from scratch if a route closes (no incremental update).'],
  ]),
  P(''),
  P([b('Relation to other algorithms. '), r('With all costs equal to 1, Dijkstra explores in the same distance order as breadth-first search; the heap becomes necessary once costs differ. A* is Dijkstra with the priority changed from g(n) to g(n) + h(n); with h(n) = 0 it is exactly Dijkstra (Member 3, Section [TEAM: number]).')]),

  // ------------------------------------------------------------------ 7
  H1('7. Dijkstra Implementation'),
  H2('7.1 Module and interface'),
  P([r('The algorithm lives in '), code('dijkstra.py'), r(' and follows the interface agreed in INTERFACE.md. It exposes '), code('solve(grid, start, goal)'), r(' and only uses '), code('grid.neighbors()'), r(', '), code('grid.is_walkable()'), r(' and '), code('grid.MOVE_COST'), r(', so it works with any grid from Member 1’s grid.py without changes. It returns found, path, cost, nodes_expanded, time (seconds, measured with time.perf_counter) and explored. The function never modifies the grid, which a unit test checks.')]),
  H2('7.2 Code excerpt: the main loop'),
  ...codeBlock(solveBody),
  caption('Listing 1. Main search loop of dijkstra.solve (from dijkstra.py).'),

  H2('7.3 Edge cases'),
  table([3000, 3000, 3026], [
    ['Case', 'Behaviour', 'Test'],
    ['Start equals goal', 'found = True, path = [start], cost = 0, 1 node expanded', 'test_start_equals_goal, test_one_by_one_grid'],
    ['Goal unreachable (walled off)', 'Explores the reachable area, then found = False, path = [], cost = None', 'test_goal_surrounded_by_walls, test_unreachable_scenario...'],
    ['Start boxed in', 'Only the start is expanded, then found = False', 'test_start_boxed_in'],
    ['Start or goal on a blocked cell', 'Returns not found immediately, 0 nodes expanded', 'test_blocked_goal_is_unreachable'],
    ['Start or goal outside the grid', 'Returns not found instead of crashing', 'test_goal_outside_grid_is_unreachable'],
  ]),

  H2('7.4 Dijkstra working in the application'),
  P('Figures 6 to 9 show the final module running inside Member 1’s interface and two diagnostic figures.'),
  ...img(S + 'm2_scenario_dijkstra.png', 'Figure 6. Dijkstra on the built-in scenario: path found with cost 35 after expanding 459 cells (blue).', 1060, 680),
  ...img(S + 'm2_wavefront.png', 'Figure 7. Expansion order on the same map. Colour shows when each cell was popped; the even spread outward from S is the “ripple” behaviour.', 1170, 806, 520),
  ...img(S + 'm2_unreachable_dijkstra.png', 'Figure 8. Unreachable demo: Dijkstra expands every cell it can reach, then reports that the goal is unreachable.', 1060, 680),
  ...img(S + 'm2_random_dijkstra.png', 'Figure 9. Random 10×10 layout (20% obstacles) solved by Dijkstra.', 1060, 680),

  // ------------------------------------------------------------------ 8
  H1('8. Dijkstra Validation and Unit Tests'),
  H2('8.1 Test plan'),
  P([r('The tests are in '), code('tests/test_dijkstra.py'), r(' and run with '), code('python -m pytest tests/test_dijkstra.py -v'), r('. Every returned path is checked by one helper: it must start at the start, end at the goal, make only 4-directional moves of length 1, never enter a blocked cell, never repeat a cell, and have cost equal to (path length − 1) × MOVE_COST.')]),
  table([2200, 4400, 2426], [
    ['Group', 'What is checked', 'Tests'],
    ['Basic paths', 'Straight line, adjacent cells and an open 10×10 grid where the cost must equal the Manhattan distance (18).', '3'],
    ['Obstacles', 'Hand-counted detour (cost 10), a narrow corridor forcing a long route (cost 20), and the scenario map, where neither path nor explored cells touch a wall.', '3'],
    ['Unreachable', 'Goal walled in, start boxed in, and the unreachable scenario: found = False, empty path, cost None.', '3'],
    ['Edge cases', 'Start = goal, 1×1 grid, goal on a blocked cell, goal outside the grid.', '4'],
    ['Correctness', 'Result format and node count; cells expanded in non-decreasing distance order; cost equal to an independent breadth-first search on 40 seeded random maps (10×10 to 50×50, 10–40% obstacles); grid not modified; 100×100 grid solved in under 2 s.', '44'],
  ]),
  P(''),
  H2('8.2 Results'),
  P('All 57 Dijkstra tests pass (Figure 10). Running the whole suite, including Member 1’s 18 interface and integration tests with the final dijkstra.py, gives 75 passed (Figure 11). In the 40 random-map tests, Dijkstra’s cost matched breadth-first search every time, and it correctly reported “unreachable” whenever breadth-first search found no route.'),
  ...img(S + 'm2_pytest.png', 'Figure 10. pytest output for tests/test_dijkstra.py: 57 passed (the 40 random-map cases are grouped on one line).', 762, 500, 470),
  ...img(S + 'm2_pytest_all.png', 'Figure 11. Whole project test suite with the final Dijkstra module.', 700, 104, 420),
  P([TEAM('rerun python -m pytest tests after Member 3 adds the final astar.py and update the total.')]),
  P([b('Integration check (Members 1 and 4 to test). '), r('The interface runs Dijkstra without errors on the scenario, unreachable and random maps (Figures 6, 8 and 9), and test_both_algorithms_agree_on_cost_for_random_maps confirms the same costs as the A* module on 30 maps.')]),

  // ------------------------------------------------------------------ 9
  H1('9. Recorded Dijkstra Performance Metrics'),
  P([r('These metrics validate Dijkstra on its own and give Member 4 a baseline. '), code('dijkstra_benchmark.py'), r(' runs Dijkstra on 10 seeded random maps for each grid size (10×10 to 100×100) and obstacle density (10, 20, 30%), with the start in the top-left corner and the goal in the bottom-right. Each map is timed 5 times and the median is kept to reduce timing noise. All 120 rows are saved in results/dijkstra_metrics.csv. The table reports solved runs only, because an unreachable run stops early and would distort the averages.')]),
  table([1150, 1150, 950, 1000, 1750, 1800, 1226], [
    ['Grid', 'Obstacles', 'Solved', 'Mean cost', 'Nodes (mean ± sd)', 'Time ms (mean ± sd)', '% of open cells'],
    ['10×10', '10%', '10/10', '18.0', '89 ± 4', '0.13 ± 0.01', '99%'],
    ['10×10', '20%', '6/10', '18.0', '80 ± 6', '0.11 ± 0.01', '100%'],
    ['10×10', '30%', '4/10', '18.0', '71 ± 9', '0.09 ± 0.02', '100%'],
    ['25×25', '10%', '9/10', '48.0', '562 ± 9', '0.86 ± 0.03', '100%'],
    ['25×25', '20%', '7/10', '48.3', '495 ± 13', '0.74 ± 0.03', '99%'],
    ['25×25', '30%', '1/10', '48.0', '382 (one run)', '0.56 (one run)', '87%'],
    ['50×50', '10%', '10/10', '98.0', '2251 ± 17', '3.67 ± 0.12', '100%'],
    ['50×50', '20%', '9/10', '98.0', '1997 ± 18', '3.16 ± 0.06', '100%'],
    ['50×50', '30%', '8/10', '101.0', '1694 ± 37', '2.79 ± 0.12', '97%'],
    ['100×100', '10%', '10/10', '198.0', '8992 ± 36', '15.86 ± 0.75', '100%'],
    ['100×100', '20%', '8/10', '198.0', '7970 ± 63', '14.22 ± 3.47', '100%'],
    ['100×100', '30%', '6/10', '199.0', '6821 ± 60', '11.53 ± 0.35', '97%'],
  ]),
  caption('Table 1. Dijkstra metrics on solved runs. “% of open cells” = nodes expanded ÷ expected walkable cells. Times depend on the machine.'),
  ...img(S + 'm2_scaling.png', 'Figure 12. Mean nodes expanded and execution time against grid size (solved runs, error bars = 1 sd).', 1300, 494),
  P([b('Observations. ')]),
  B('With the goal in the far corner, Dijkstra expands almost every walkable cell (97 to 100%). This is expected: every open cell is closer to the start than the goal, so all of them are popped first. It is the clearest evidence of its uninformed, all-direction search.'),
  B('Nodes expanded grow in proportion to the number of cells (about 4× per doubling of the side), and time grows slightly faster because of the log V heap cost.'),
  B('More obstacles mean fewer open cells and so fewer expansions, but also more unreachable maps (only 1 of 10 at 25×25 with 30% obstacles, because random walls often box in a corner).'),
  B('Costs stay at or near the Manhattan distance (18, 48, 98, 198), so the random walls rarely force long detours on these maps.'),
  P([r('The fair Dijkstra-versus-A* comparison with identical inputs is Member 4’s experiments section. '), TEAM('Member 4: confirm these Dijkstra figures match experiments.py results, or note any difference in method.')]),

  // ------------------------------------------------------------------ refs
  H1('References for Sections 6 to 9'),
  P('Cormen, T.H., Leiserson, C.E., Rivest, R.L. and Stein, C. (2022) Introduction to Algorithms. 4th edn. Cambridge, MA: MIT Press (Chapter 22, Single-Source Shortest Paths).'),
  P('Dijkstra, E.W. (1959) ‘A note on two problems in connexion with graphs’, Numerische Mathematik, 1(1), pp. 269–271.'),
  P('Python Software Foundation (2025) heapq: Heap queue algorithm. Python 3 documentation. Available at: https://docs.python.org/3/library/heapq.html.'),
  P('Russell, S. and Norvig, P. (2021) Artificial Intelligence: A Modern Approach. 4th edn. Hoboken, NJ: Pearson (Chapter 3, Solving Problems by Searching).'),
  P([TEAM('Member 4: merge these into the main reference list and check the citation style.')]),

  H1('Contribution Row for Appendix A'),
  table([1700, 5626, 1700], [
    ['Member', 'Contribution', 'Share'],
    ['Member 2: Afra Almheiri (8739468)', 'dijkstra.py; tests/test_dijkstra.py (57 tests); dijkstra_benchmark.py and results/dijkstra_metrics.csv; report/m2_figures.py; report Sections 6 to 9; README module notes; confirmed interface compatibility.', '25%'],
  ]),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: 'Arial', size: 40, bold: true }, paragraph: { spacing: { before: 0, after: 160 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 30, bold: true }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 25, bold: true }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ] },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } }, children }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync('Member2_Report_Sections.docx', buf); console.log('done'); });
