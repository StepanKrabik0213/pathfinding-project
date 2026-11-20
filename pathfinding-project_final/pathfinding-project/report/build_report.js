// build_report.js - builds the group report body (run inside report/: node build_report.js)
// Result tables and headline numbers are read from ../results, and code excerpts from the
// source files, so the report always matches the code and the data. The UOWD cover sheet
// (cover_sheet.docx) is placed in front of this document afterwards.
const fs = require('fs');
const d = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ImageRun, AlignmentType, LevelFormat, BorderStyle, TableOfContents, Footer, PageNumber } = d;

// ------------------------------------------------------------ house style
const FONT = 'Times New Roman';
const BODY = 22;   // 11 pt
const HEAD = 24;   // 12 pt
const SMALL = 20;  // 10 pt: tables, captions, notes
const CODE = 17;   // 8.5 pt monospace for code listings, so the longest line fits

// ------------------------------------------------------------ helpers
const runs = (t) => (Array.isArray(t) ? t : [new TextRun(t)]);
const P = (t, o = {}) => new Paragraph({ spacing: { after: 160, line: 276 }, ...o, children: runs(t) });
const B = (t) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 80, line: 276 }, children: runs(t) });
const N = (t, ref) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 276 }, children: runs(t) });
const H1 = (t, o = {}) => new Paragraph({ heading: HeadingLevel.HEADING_1, ...o, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const i_ = (t) => new TextRun({ text: t, italics: true });
const r = (t) => new TextRun(t);
const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: line, bottom: line, left: line, right: line };

function table(widths, rows, right = false) {
  const total = widths.reduce((a, c) => a + c, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((row, i) => new TableRow({ tableHeader: i === 0, cantSplit: true, children: row.map((c, j) => new TableCell({
      width: { size: widths[j], type: WidthType.DXA }, borders,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ alignment: right && j > 0 && i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: String(c), bold: i === 0, size: SMALL })] })] })) })),
  });
}
const tcap = (t) => new Paragraph({ spacing: { before: 200, after: 80 }, keepNext: true,
  children: [new TextRun({ text: t, bold: true, size: SMALL })] });
const fcap = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 },
  children: [new TextRun({ text: t, italics: true, size: SMALL })] });
const note = (t) => new Paragraph({ spacing: { before: 60, after: 200 }, children: [new TextRun({ text: t, italics: true, size: SMALL })] });
const gap = () => new Paragraph({ spacing: { after: 80 }, children: [] });

function pngSize(file) { const buf = fs.readFileSync(file); return [buf.readUInt32BE(16), buf.readUInt32BE(20)]; }
function img(file, cap, width = 560) {
  const [w, h] = pngSize(file);
  const height = Math.round(width * h / w);
  return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 140, after: 60 }, keepNext: true,
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width, height },
      altText: { title: cap, description: cap, name: cap } })] }), fcap(cap)];
}
function codeBlock(src) {
  const lines = src.replace(/\n$/, '').split('\n');
  return lines.map((ln, i) => new Paragraph({
    spacing: { after: 0, before: i === 0 ? 120 : 0, line: 240 }, keepLines: true, keepNext: i < lines.length - 1,
    indent: { left: 120 },
    children: [new TextRun({ text: ln.length ? ln.replace(/ /g, ' ') : ' ', font: 'Courier New', size: CODE })] }));
}

// ------------------------------------------------------------ data
const csv = fs.readFileSync('../results/summary.csv', 'utf8').trim().split(/\r?\n/);
const head = csv[0].split(',');
const S = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, k) => [head[k], v])));
const get = (pl, grid, dens, alg) => S.find((s) => s.environment === 'random' && s.placement === pl
  && s.grid === grid && Math.abs(+s.density - dens) < 1e-9 && s.algorithm === alg && s.status === 'solved');
const GRIDS = ['10x10', '25x25', '50x50', '100x100'];
const DENS = [0.1, 0.2, 0.3];
const f1 = (x) => (+x).toFixed(1);
const f2 = (x) => (+x).toFixed(2);
const fmtN = (s) => (+s.maps > 1 ? `${Math.round(+s.nodes_mean)} ± ${Math.round(+s.nodes_sd)}` : `${Math.round(+s.nodes_mean)}`);
const fmtT = (s) => (+s.maps > 1 ? `${f2(s.time_ms_mean)} ± ${f2(s.time_ms_sd_between_maps)}` : `${f2(s.time_ms_mean)}`);
function resultTable(pl) {
  const rows = [['Grid', 'Obstacles', 'Maps with a path', 'Cost', 'Dijkstra nodes', 'A* nodes', 'A* as % of Dijkstra', 'Dijkstra ms', 'A* ms', 'Speed up']];
  for (const g of GRIDS) for (const dd of DENS) {
    const D = get(pl, g, dd, 'Dijkstra'), A = get(pl, g, dd, 'A*');
    if (!D) continue;
    rows.push([g.replace('x', '×'), `${Math.round(dd * 100)}%`, `${D.maps}/10`, f1(D.mean_cost), fmtN(D), fmtN(A),
      `${Math.round(100 * A.nodes_mean / D.nodes_mean)}%`, f2(D.time_ms_mean), f2(A.time_ms_mean),
      `${(+D.time_ms_mean / +A.time_ms_mean).toFixed(2)}`]);
  }
  return table([700, 760, 840, 560, 1150, 1300, 820, 880, 880, 1136], rows, true);
}
const fx = (pl, g, dd, alg, key) => +get(pl, g, dd, alg)[key];
const K = JSON.parse(fs.readFileSync('../results/key_stats.json', 'utf8'));
const pct = (x) => Math.round(x);
const overhead = K.us_per_node_astar / K.us_per_node_dijkstra;
const breakEven = Math.round(100 * (1 - 1 / overhead));
const maxSpeed = Math.round(fx('middle', '100x100', 0.1, 'Dijkstra', 'time_ms_mean') / fx('middle', '100x100', 0.1, 'A*', 'time_ms_mean'));
const sc = (k) => K[k];
const allOr = (n, total, noun) => (n === total ? `all ${total} ${noun}` : `${n} of the ${total} ${noun}`);

const dsrc = fs.readFileSync('../dijkstra.py', 'utf8');
const dLoop = dsrc.slice(dsrc.indexOf('    while frontier:'), dsrc.indexOf('    # Edge case 3'))
  .replace(/\n+$/, '').replace(/^ {4}/gm, '');
const asrc = fs.readFileSync('../astar.py', 'utf8');
const aLoop = asrc.slice(asrc.indexOf('            for neighbor in grid.neighbors(*current):'), asrc.indexOf('    # Return the exact fields'))
  .replace(/\n\s*\n/g, '\n').replace(/^ {12}/gm, '').replace(/\n+$/, '');

const SF = 'screenshots_final/', G = '../results/graphs/';
const c100 = (alg, key) => fx('corner', '100x100', 0.1, alg, key);
const m100 = (alg, key) => fx('middle', '100x100', 0.1, alg, key);

// ------------------------------------------------------------ content
const children = [
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Table of Contents', bold: true, size: HEAD })] }),
  new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),

  // ============================================================ 1
  H1('1. Executive Summary', { pageBreakBefore: true }),
  P('Aid often has to reach a crisis area quickly, but the routes into that area can close without warning. An airport may shut, a port may stop working or a road may be cut off, and the delivery plan then has to be worked out again with whatever routes are left. Our project looks at a simple version of this problem. The region is a 2D grid where open cells are routes that can be used and blocked cells are routes that are closed. An agent has to find the shortest route from a start point, which is Dubai in our scenario, to a goal, which is the crisis destination.'),
  P('We wrote two well known search algorithms in Python, Dijkstra’s algorithm and A* search, and gave them the same interface so that either one can be run on the same grid. A* uses the Manhattan distance as its heuristic. We also built an application that shows the grid, the cells each algorithm explored and the final route, and tells the user when the goal cannot be reached. We then compared the two algorithms on running time, number of nodes expanded and path cost.'),
  P(`We tested ${K.maps} maps in total. These covered four grid sizes from 10×10 to 100×100, three obstacle densities and two positions for the start and goal, and each algorithm ran ten times on every map. Both algorithms always found paths with the same optimal cost, and they always agreed when there was no path. A* never expanded more cells than Dijkstra. When the start and goal were on the same row, it expanded about a fifth as many cells and was around five times faster. On open grids with the goal in the far corner, though, it saved very little and was sometimes a bit slower. We found that this came from the way A* chooses between cells that look equally good. When we changed it to prefer the cell closest to the goal, A* expanded less than a fifth of Dijkstra’s cells in both cases and still found paths with the same cost.`),
  P('Overall, A* is the better choice for finding a route to one destination on these grids, as long as its heuristic never overestimates and ties are handled well. Dijkstra is still a simple and reliable algorithm to compare against. The grid is only a model. It does not use real data and should not be used to plan real relief work.'),

  // ============================================================ 2
  H1('2. Motivation and Problem Statement'),
  H2('2.1 Motivation'),
  P('Getting aid to a crisis area depends on air, sea and land routes, and these change all the time. A port that was open yesterday might be closed today, so planners need a way to find a new route quickly whenever the available routes change.'),
  P('Shortest path search is the usual way to solve this kind of problem (Russell and Norvig, 2021). Dijkstra’s algorithm always finds the best route, but it searches evenly in every direction from the start (Dijkstra, 1959). A* adds an estimate of the distance left to the goal, so it can head towards the goal and usually checks far fewer places (Hart, Nilsson and Raphael, 1968). How much A* saves depends on where the obstacles are, which is why we wanted to compare the two directly.'),
  H2('2.2 Problem statement'),
  P('We are given a grid of open and blocked cells, a start cell and a goal cell. The task is to find the cheapest path that only uses open cells, or to report that the goal cannot be reached. We then compare Dijkstra’s algorithm and A* on running time, nodes expanded and path cost for different grid sizes and obstacle densities, and decide when each one is the better choice.'),
  P('In our scenario the start is Dubai, the goal is the crisis destination, and each closed airport, port or road is a blocked area on the grid.'),

  // ============================================================ 3
  H1('3. Project Objectives and Scope'),
  H2('3.1 Objectives'),
  B('Build a 2D grid with open and blocked cells, a start point and a goal point.'),
  B('Write Dijkstra’s algorithm and A* search as separate Python modules that take the same input and return the same output.'),
  B('Show the grid, the explored cells and the final path on screen, and make it clear when there is no path.'),
  B('Let the user draw and reset layouts and run new tests without restarting the program.'),
  B('Compare the two algorithms fairly on running time, nodes expanded and path cost over different grid sizes and obstacle densities.'),
  B('Check that both algorithms return the same optimal cost whenever a path exists.'),
  H2('3.2 Scope and assumptions'),
  P('The project uses grids from 10×10 to 100×100 cells that do not change while the search runs. The agent can move up, down, left or right, and every move costs 1. We included a scenario map designed by hand, random maps with 10% to 40% obstacles, a map where the goal cannot be reached, a desktop application, unit tests and an experiment script that can be run again at any time.'),
  P('Moving obstacles, diagonal moves, different costs for different moves and real map data were left out because the topic does not ask for them. We also used one number, the path cost, for both the fastest and the safest route, since every step costs the same. Giving risky routes a higher cost would need a different cost model and a different heuristic, so we list it as future work in Section 9.'),

  // ============================================================ 4
  H1('4. Technical Requirements'),
  H2('4.1 Software and libraries'),
  tcap('Table 1. Software used in the project'),
  table([2500, 6526], [
    ['Item', 'Requirement'],
    ['Language', 'Python 3.10 or newer, tested on Python 3.11 and 3.13'],
    ['User interface', 'pygame 2.5 or newer for the grid window and buttons (Pygame Community, 2024)'],
    ['Testing', 'pytest 7 or newer (Krekel et al., 2004)'],
    ['Experiments', 'The Python standard library, and matplotlib 3.7 or newer for the graphs (Hunter, 2007)'],
    ['Version control', 'Git and a shared GitHub repository'],
    ['Operating system', 'Windows, macOS or Linux'],
  ]),
  H2('4.2 Hardware'),
  P('A normal laptop is enough. The largest grid in our tests, 100×100 cells, is solved in a few tens of milliseconds, so no special hardware is needed. The application window needs a screen of at least 1100×700 pixels.'),
  H2('4.3 Functional and non functional requirements'),
  tcap('Table 2. Functional requirements and how each one was checked'),
  table([700, 5100, 3226], [
    ['ID', 'Requirement', 'Checked by'],
    ['F1', 'A grid with open and blocked cells, one start and one goal', 'tests/test_grid.py'],
    ['F2', 'Different colours for the start, goal, obstacles, explored cells and path', 'Figures 4 to 7'],
    ['F3', 'Draw and edit layouts by clicking, and create random layouts', 'Manual testing and a test for seeded maps'],
    ['F4', 'Run Dijkstra and A* through the same interface', 'Interface tests for both modules'],
    ['F5', 'Show whether a path was found or the goal cannot be reached', 'Tests on maps with no path and Figure 6'],
    ['F6', 'Clear or reset the grid and run again without restarting', 'Manual testing'],
    ['F7', 'Show the path cost, nodes expanded and time for each run', 'Result cards in the application'],
  ]),
  gap(),
  P('There were also three non functional requirements. Both algorithms had to get exactly the same grid, start, goal and movement rules so that the comparison would be fair. Random maps had to be made from a seed so that any test could be repeated. Finally, the grid, the interface and each algorithm had to be in separate files, so that one part could be changed without touching the others.'),

  // ============================================================ 5
  H1('5. Main Constructs'),
  H2('5.1 The grid as a search problem'),
  P('The environment is a grid with R rows and C columns. Each cell is named by its row and column, and the blocked cells are stored in a set. Table 3 shows how we turned the grid into a search problem, following the usual approach in Russell and Norvig (2021).'),
  tcap('Table 3. The grid as a search problem'),
  table([2200, 6826], [
    ['Part', 'Meaning in our project'],
    ['State', 'An open cell, given by its row and column. Blocked cells are not states.'],
    ['Initial state', 'The start cell, which is Dubai'],
    ['Actions', 'Move up, down, left or right to an open neighbour'],
    ['Step cost', '1 for every move'],
    ['Goal test', 'The cell being expanded is the goal'],
    ['Path cost g(n)', 'The total of the step costs from the start, which is the number of moves'],
    ['Solution', 'A list of cells from the start to the goal with the lowest cost, or a message that the goal cannot be reached'],
  ]),
  gap(),
  P('This means a grid has at most V = R × C nodes. Each cell has at most four neighbours, so the number of edges E is at most 4V. In the application, open cells are white, blocked cells are dark grey, the start is green and the goal is red. Explored cells are shaded blue for Dijkstra and green for A*, and the final path is orange.'),

  H2('5.2 Dijkstra’s algorithm'),
  P('Dijkstra’s algorithm works outward from the start, a bit like a ripple on a pond. At each step it takes the closest cell it has not finished yet and updates the distances to that cell’s neighbours. Cells are finished in order of their distance, so when the goal is taken off the queue its distance must be the shortest one (Dijkstra, 1959; Cormen et al., 2022). The weakness is that it does not know where the goal is, so it searches away from the goal just as much as towards it.'),
  tcap('Table 4. Data structures used in the Dijkstra module'),
  table([1700, 1900, 5426], [
    ['Name', 'Python type', 'What it does'],
    ['frontier', 'heapq list', 'Holds a distance, a counter and a cell. The cell with the smallest distance always comes out first.'],
    ['dist', 'dictionary', 'The best distance found so far for each cell'],
    ['prev', 'dictionary', 'The cell we came from on that best route, used to build the path backwards'],
    ['visited', 'set', 'Cells that are finished. Their distance will not change.'],
    ['explored', 'list', 'The order the cells were expanded in, used for shading and for counting nodes'],
    ['tie', 'itertools.count', 'A counter that makes cells with the same distance come out in the order they were added'],
  ]),
  gap(),
  P('Python’s heapq module cannot lower the priority of an item that is already in the heap (Python Software Foundation, 2026a). So when we find a shorter route to a cell, we simply push it again with the new distance. The old entry stays in the heap, and when it comes out later we skip it because the cell is already finished. This is called lazy deletion. It keeps the code short and does not change the running time.'),
  P('The steps are:'),
  N('If the start or goal is blocked or off the grid, report that no path was found. If the start is the goal, return a path of one cell with cost 0.', 'dj'),
  N('Put the start cell in the queue with distance 0.', 'dj'),
  N('Take out the cell with the smallest distance. Skip it if it is already finished, otherwise mark it as finished.', 'dj'),
  N('If it is the goal, follow the prev links back to the start and return the path and its cost.', 'dj'),
  N('For each open neighbour, work out the distance through this cell. If it is shorter than the neighbour’s current distance, update dist and prev and add the neighbour to the queue.', 'dj'),
  N('Go back to step 3. If the queue runs out first, the goal cannot be reached.', 'dj'),
  P('Figure 1 shows a small example. Every cell at distance 1 is expanded before any cell at distance 2, which is why the dead end cells in the bottom left are expanded even though they do not lead to the goal.', { spacing: { before: 120, after: 160, line: 276 } }),
  ...img('screenshots_m2/m2_small_trace.png', 'Figure 1. Dijkstra on a 3×5 map, showing the final distance d and the order each cell was expanded in. The path costs 6 and 12 cells were expanded.', 430),
  P('Dijkstra always finds the shortest path as long as no move has a negative cost. Suppose a cell u has just been taken off the queue but there is a shorter route to it. That route must leave the finished cells at some point through a cell x that is still in the queue. Reaching x already costs at least as much as reaching u, because u came off the queue first, and since no move has a negative cost the rest of the route cannot make it cheaper. So a shorter route cannot exist (Cormen et al., 2022). This is also why we test for the goal when it comes off the queue and not when it is first seen. The argument would fail with negative costs, but every move on our grid costs 1.'),
  P('Figure 2 shows the order in which Dijkstra expanded the cells on the scenario map. The colour changes evenly with distance from the start, which is the ripple effect described above.'),
  ...img('screenshots_m2/m2_wavefront.png', 'Figure 2. The order Dijkstra expanded the cells on the 20×30 scenario map. Darker cells were expanded earlier.', 470),
  P('Dijkstra’s main advantage is that it always finds the shortest path and does not need a heuristic, so a bad estimate can never send it the wrong way. It works with any costs that are zero or more, which would matter if risky routes were later given a higher cost, and one run gives the distance from the start to every cell it can reach. When there is no path, searching every reachable cell also proves that the goal cannot be reached. Its main disadvantage is that it searches in every direction, even away from the goal, so on large open maps it does much more work than it needs to. It also cannot handle negative costs, the heap uses extra time and memory, and if a route closes the whole search has to start again.'),

  H2('5.3 A* search and the Manhattan heuristic'),
  P('A* keeps everything that makes Dijkstra correct but changes the order that cells come off the queue. Instead of using only the distance so far, it uses an estimate of the full cost of a route through each cell (Hart, Nilsson and Raphael, 1968):'),
  P([new TextRun({ text: 'f(n) = g(n) + h(n)', bold: true })], { alignment: AlignmentType.CENTER }),
  tcap('Table 5. The parts of the A* evaluation function'),
  table([1400, 7626], [
    ['Term', 'Meaning in our project'],
    ['g(n)', 'The cost of the best route found so far from the start to cell n'],
    ['h(n)', 'The estimated cost from n to the goal, using the Manhattan distance'],
    ['f(n)', 'The estimated total cost of a route through n. The queue is ordered by this value.'],
  ]),
  gap(),
  P('Because the agent can only move up, down, left and right, we used the Manhattan distance as the heuristic. It is the number of rows plus the number of columns between a cell and the goal, multiplied by the cost of one move:'),
  P([new TextRun({ text: 'h(n) = ( |row of n − row of goal| + |column of n − column of goal| ) × move cost', bold: true })], { alignment: AlignmentType.CENTER }),
  P('For example, a cell at row 2, column 3 is at least 5 + 6 = 11 moves away from a goal at row 7, column 9. Walls can only make the real route longer, never shorter, so this estimate never overestimates the cost that is left. This property is called admissible. The heuristic is also consistent, because one move changes the Manhattan distance by exactly one, which is never more than the cost of that move. With these two properties A* is guaranteed to find an optimal path and never has to expand the same cell twice (Russell and Norvig, 2021). We did not use the straight line distance because it underestimates more on this kind of grid and so guides the search less well. The octile distance was not suitable either, as it is meant for grids that allow diagonal moves.'),
  P('Apart from the queue order, A* follows the same steps as Dijkstra. Our A* code stores the g values and parent links in flat lists with one entry per cell, and each heap entry holds f, g and the cell. Figure 3 shows A* on a small map. The h value on each cell pulls the search towards the goal, so the cells are expanded in a different order from Dijkstra.'),
  ...img('final/m3img/fig13.png', 'Figure 3. A* on a 3×5 map, showing the order the cells were expanded in, from 1 to 11, and the Manhattan estimate h for each cell. The optimal path costs 10.', 470),
  P('Since the Manhattan heuristic is admissible and consistent, A* keeps the same guarantees as Dijkstra. It always finds an optimal path and it always finishes. It usually expands far fewer cells because the search is pulled towards the goal, and it worked with our grid and application without any changes. The size of the saving depends on how close the estimate is to the real distance, which changes with the map and its obstacles. Each step of A* also takes slightly more work, so expanding fewer cells does not always mean a faster run in Python. The heuristic only works for one goal and for our movement rules. Diagonal moves or different costs would need a different heuristic, and a heuristic that overestimates would lose the guarantee of an optimal path.'),

  H2('5.4 Theoretical comparison'),
  P('In theory the two algorithms are very close. If h(n) is always 0, A* is exactly Dijkstra’s algorithm, and when every move costs 1 Dijkstra expands cells in the same order as breadth first search. Table 6 sums up the differences.'),
  tcap('Table 6. Theoretical comparison of the two algorithms on our grid'),
  table([2300, 3363, 3363], [
    ['Property', 'Dijkstra', 'A* with Manhattan distance'],
    ['Optimal', 'Yes, when costs are never negative', 'Yes, because the heuristic is admissible and consistent'],
    ['Complete', 'Yes, on a finite grid', 'Yes, on a finite grid'],
    ['Queue order', 'g(n), the distance from the start', 'f(n) = g(n) + h(n)'],
    ['Time with a binary heap', 'O(V log V) on our grid', 'Same worst case, but usually far fewer expansions'],
    ['Memory', 'O(V)', 'O(V)'],
    ['Shape of the search', 'Spreads evenly in all directions', 'Stretches towards the goal'],
    ['Work per expansion', 'Lower', 'Slightly higher'],
    ['Goal cannot be reached', 'Searches every reachable cell', 'Also searches every reachable cell'],
    ['Distances to all cells', 'Yes, from one run', 'No, the heuristic is tied to one goal'],
  ]),
  gap(),
  P('Before running the experiments we expected A* to expand fewer cells whenever a path exists, both algorithms to return the same cost, and A* to be faster only when the cells it saves are worth more than its extra work per cell.'),

  // ============================================================ 6
  H1('6. Implementation'),
  H2('6.1 Project structure and shared interface'),
  P('Before writing either algorithm, we agreed on the grid rules and on one function that both modules had to provide, and wrote these down in INTERFACE.md. Each module has a solve function that takes the grid, the start and the goal. It returns the same six values: whether a path was found, the path, its cost, the number of nodes expanded, the time taken and the list of explored cells. Time is measured with time.perf_counter (Python Software Foundation, 2026b). The modules only use three things from the grid: its neighbours, whether a cell is open, and the cost of a move. This lets the application and the experiment script call either algorithm in exactly the same way. Table 7 lists the main files.'),
  tcap('Table 7. Main files in the repository'),
  table([2900, 6126], [
    ['File', 'Purpose'],
    ['grid.py', 'The grid: cells, obstacles, neighbours, random maps and the scenario maps'],
    ['main.py', 'The interactive pygame application, which can also save screenshots'],
    ['dijkstra.py', 'Dijkstra’s algorithm'],
    ['astar.py', 'A* search and the Manhattan heuristic'],
    ['experiments.py', 'Runs the comparison, checks the results, works out the statistics and draws the graphs'],
    ['tests', 'Unit tests for the grid, both algorithms and the experiment script'],
    ['results', 'Raw results, summary statistics and graphs'],
    ['INTERFACE.md, README.md, requirements.txt', 'Interface rules, setup instructions and required libraries'],
  ]),

  H2('6.2 Grid environment and application'),
  P('grid.py keeps the blocked cells in a set, so checking whether a cell is open is quick. Random maps block each cell, apart from the start and goal, with a chosen probability. A seed is used, so the same seed always gives the same map. There is also a 20×30 scenario map with Dubai on the west side, the destination on the east side, and walls with a few gaps that act as closed gateways. A second version of this map has a full wall between the start and the goal, so the goal cannot be reached.'),
  P('The application in main.py has buttons to draw walls, move the start and goal, run Dijkstra, A* or both, switch between their results, clear the path, reset the grid, load the scenario maps and create random maps of different sizes and densities. Each algorithm has a result card that shows whether a path was found, its cost, the number of nodes expanded and the time taken. Changing any cell clears the old results, so an old path is never left on screen. If both algorithms are run, the application also warns the user when their results disagree. Figures 4 to 7 show the finished application.'),
  ...img(SF + 'shot_scenario_astar.png', 'Figure 4. A* on the scenario map. It found a path with cost 35 after expanding 149 cells, shaded green.', 520),
  ...img(SF + 'shot_scenario_dijkstra.png', 'Figure 5. Dijkstra on the same map. It found the same path with cost 35 but expanded 459 cells, shaded blue.', 520),
  ...img(SF + 'shot_unreachable_both.png', 'Figure 6. The map where the goal cannot be reached. Both algorithms search the area they can reach and then report that there is no path.', 520),
  ...img(SF + 'shot_random_both.png', 'Figure 7. A random 10×10 map with both algorithms run. The path costs 7. Dijkstra expanded 51 cells and A* expanded 8.', 520),

  H2('6.3 Dijkstra implementation'),
  P('Listing 1 shows the main loop of dijkstra.py. The goal test happens when a cell comes off the queue, not when it is first found, so the distance returned is final. The neighbours come from the grid, which never returns blocked cells, so the search can never pass through a wall.'),
  ...codeBlock(dLoop),
  fcap('Listing 1. The main loop of the Dijkstra solve function in dijkstra.py'),

  H2('6.4 A* implementation'),
  P('Listing 2 shows the part of astar.py that is most different from Dijkstra. When a better route to a neighbour is found, its g value and parent are updated and it is pushed onto the heap with priority g plus h. Old heap entries are skipped when they come out, in the same way as in the Dijkstra module. When the goal is reached, the path is built by following the parent links back to the start.'),
  ...codeBlock(aLoop),
  fcap('Listing 2. The step in the A* solve function that updates a neighbour and adds it to the heap with priority f = g + h'),

  H2('6.5 Edge cases'),
  P('Both modules deal with the same special cases in the same way, as Table 8 shows. This matters because the application and the experiment script treat both algorithms identically.'),
  tcap('Table 8. Special cases handled by both modules'),
  table([3000, 6026], [
    ['Case', 'What happens'],
    ['The start is the goal', 'A path of one cell is returned with cost 0, and one node is expanded'],
    ['The start or goal is blocked or off the grid', 'No path is returned, the cost is empty and nothing is expanded'],
    ['The start is completely walled in', 'Only the start is expanded, then no path is reported'],
    ['The goal cannot be reached', 'Every reachable cell is searched, then no path is reported'],
    ['A different move cost is used', 'The path cost changes with it. This was tested with a move cost of 3.'],
  ]),

  H2('6.6 Testing and validation'),
  P('All tests are written with pytest (Krekel et al., 2004) and the whole set runs with a single command, given in Appendix B. Every path an algorithm returns is checked separately. It must start at the start, end at the goal, only move one step up, down, left or right through open cells, never visit a cell twice, and have a cost equal to the number of moves times the move cost. Working out expected costs by hand turned out to be error prone, so the random map tests compare each algorithm with a simple breadth first search instead. This always gives the exact answer when every move costs the same. Table 9 summarises the tests.'),
  tcap('Table 9. Unit tests'),
  table([2300, 5826, 900], [
    ['Test file', 'What it checks', 'Tests'],
    ['test_grid.py', 'Grid edges, neighbours, protected start and goal, repeatable random maps, reset, saving and loading maps, and that both modules follow the interface and agree on cost on 30 random maps', '18'],
    ['test_dijkstra.py', 'Simple paths, detours, a long corridor, the scenario map, goals that cannot be reached, special cases, cells expanded in order of distance, and the same cost as breadth first search on 40 random maps', '57'],
    ['test_astar.py', 'The Manhattan heuristic, simple paths and obstacles, goals that cannot be reached, special cases, the output format, an unchanged grid, and the same cost as breadth first search and Dijkstra on 20 random maps', '39'],
    ['test_experiments.py', 'Random maps can be rebuilt exactly, the start and goal are never blocked, the path checker catches bad paths, every algorithm runs the same number of times, and the tie breaking version in Section 7.6 is optimal', '43'],
    ['Total', '', '157'],
  ]),
  gap(),
  P('All 157 tests pass, as Figure 8 shows. Passing tests only show that the cases we tested work, but because the random map tests compare against a separate method, we are confident that both algorithms return optimal paths.'),
  ...img(SF + 'pytest_all.png', 'Figure 8. Output of the full test suite, with 157 tests passed.', 480),

  // ============================================================ 7
  H1('7. Experiments and Results'),
  H2('7.1 Experimental design'),
  P('The experiments were designed to answer three questions. Do both algorithms always return a valid path with the same optimal cost, and agree when there is no path? How many nodes does each one expand, and how long does it take, as the grid size, obstacle density and start and goal positions change? And if A* does not beat Dijkstra somewhere, why not? We fixed the test plan before collecting any results. Testing on many random maps of different sizes, instead of a few chosen by hand, is common practice when comparing grid search methods (Sturtevant, 2012).'),
  tcap('Table 10. Test settings'),
  table([2300, 6726], [
    ['Setting', 'Values'],
    ['Grid size', '10×10, 25×25, 50×50 and 100×100, which is 100 to 10,000 cells'],
    ['Obstacle density', '10%, 20% and 30% of cells blocked at random'],
    ['Maps', '10 random maps for each size and density, using seeds 0 to 9'],
    ['Start and goal', 'Corner layout: start at the top left and goal at the bottom right. Middle layout: start and goal on the middle row near the left and right edges, which is the default in the application.'],
    ['Fixed maps', 'The 20×30 scenario map and the version where the goal cannot be reached'],
    ['Repeats', '10 timed runs per algorithm on every map, after one warm up run'],
    ['Total', `${K.maps} maps and ${K.runs.toLocaleString('en-GB')} timed runs`],
  ]),
  gap(),
  P('We used two layouts because the position of the goal affects how much the heuristic can help. The corner layout turned out to be the hardest case for A*, as Section 7.6 explains, while the middle layout is what a user sees when they open the application.'),
  P('To keep the test fair, each map is built once and the same grid, start, goal and movement rules are given to every algorithm. Afterwards the script checks that no algorithm changed the grid. The order the algorithms run in changes on every repeat, so none of them always benefits from going first or last, and Python’s garbage collector is paused while each run is timed to reduce random delays. Every path that comes back is checked with the same checker used in the unit tests.'),
  P('The number of nodes expanded, the path cost and whether a path was found stay the same on every repeat, which the script also checks. Only the time changes between runs. For each map we take the average of its ten times, and for each setting we report the average and standard deviation across the maps that have a path. Maps with no path are summarised separately, because both algorithms then have to search every cell they can reach, which is a different kind of workload. The raw data are saved in results/results.csv with one row per run, and the summary is saved in results/summary.csv.'),

  H2('7.2 Correctness'),
  tcap(`Table 11. Correctness checks over all ${K.maps} maps`),
  table([6026, 3000], [
    ['Check', 'Result'],
    ['Maps with a path', String(K.solved_maps)],
    ['Maps with no path', String(K.unsolved_maps)],
    ['Invalid paths returned', '0'],
    ['Maps where the algorithms disagreed on whether a path exists', '0'],
    ['Maps with a path where the costs were different', '0'],
    ['Results that changed between repeats', '0'],
    ['Maps where A* expanded more nodes than Dijkstra', '0'],
  ]),
  gap(),
  P(`On all ${K.solved_maps} maps with a path, the two algorithms returned paths with exactly the same cost, and every path was valid, as Figure 9 shows. On all ${K.unsolved_maps} maps with no path, both reported that no path exists. Dijkstra is always optimal when costs are never negative, so equal costs on every map confirm that A* with the Manhattan heuristic was also optimal on every map we tested, as expected from Section 5.3. We also found that the node counts from the experiment script exactly match the benchmark results recorded separately for each algorithm earlier in the project, which are saved in results/dijkstra_metrics.csv and results/astar_metrics.csv.`),
  ...img(G + 'path_cost_agreement.png', `Figure 9. Path cost found by A* against path cost found by Dijkstra on the ${K.solved_maps} maps with a path. Every point lies on the line where both costs are equal.`, 330),

  H2('7.3 Corner layout'),
  tcap('Table 12. Results with the corner layout, maps with a path only'),
  resultTable('corner'),
  note('Node counts are the average ± standard deviation across maps, and a setting with only one map that has a path has no standard deviation. Times are average milliseconds and depend on the computer. Speed up is Dijkstra’s time divided by the time for A*, so a value above 1 means A* was faster. The spread in times is shown by the error bars in Figures 11 and 13.'),
  P(`With the goal in the far corner, Dijkstra expanded almost every open cell, between 96% and 100% of them. A* did better, but by less than we expected. Across the ${K.corner_solved} corner maps with a path, it expanded ${pct(K.corner_astar_node_pct_mean)}% of Dijkstra’s nodes on average and was faster on ${K.corner_astar_faster} of them, but the median speed up was only ${K.corner_astar_speedup_median.toFixed(2)} times. On open maps the saving was very small. At 100×100 with 10% obstacles, A* still expanded ${Math.round(c100('A*', 'nodes_mean'))} cells compared with Dijkstra’s ${Math.round(c100('Dijkstra', 'nodes_mean'))}, and took ${f1(c100('A*', 'time_ms_mean'))} ms compared with ${f1(c100('Dijkstra', 'time_ms_mean'))} ms. The saving grew as more obstacles were added. At 100×100, A* needed 88%, 61% and 23% of Dijkstra’s nodes at 10%, 20% and 30% obstacles. Figures 10 and 11 show the same pattern for every grid size.`),
  ...img(G + 'nodes_vs_size_corner.png', 'Figure 10. Average nodes expanded against grid size with the corner layout, on a log scale. Error bars show one standard deviation across maps.', 600),
  ...img(G + 'time_vs_size_corner.png', 'Figure 11. Average running time against grid size with the corner layout, on a log scale.', 600),

  H2('7.4 Middle layout'),
  tcap('Table 13. Results with the middle layout, maps with a path only. The columns are the same as in Table 12.'),
  resultTable('middle'),
  gap(),
  P(`When the start and goal are on the same row, the heuristic guides A* much better. Across the ${K.middle_solved} middle maps with a path, A* expanded ${pct(K.middle_astar_node_pct_mean)}% of Dijkstra’s nodes on average, was faster on ${K.middle_astar_faster === K.middle_solved ? 'every map' : `${K.middle_astar_faster} of them`} and was ${K.middle_astar_speedup_mean.toFixed(1)} times faster on average. At 100×100 with 10% obstacles, A* needed ${Math.round(m100('A*', 'nodes_mean'))} expansions and ${f2(m100('A*', 'time_ms_mean'))} ms, while Dijkstra needed ${Math.round(m100('Dijkstra', 'nodes_mean'))} expansions and ${f1(m100('Dijkstra', 'time_ms_mean'))} ms, about ${maxSpeed} times longer. Here the effect of obstacles goes the other way. More walls mean more detours that a straight line estimate cannot predict, so the advantage of A* gets slightly smaller as the density goes up, as Figures 12 and 13 show.`),
  ...img(G + 'nodes_vs_size_middle.png', 'Figure 12. Average nodes expanded against grid size with the middle layout, on a log scale.', 600),
  ...img(G + 'time_vs_size_middle.png', 'Figure 13. Average running time against grid size with the middle layout, on a log scale.', 600),
  ...img(G + 'node_ratio.png', 'Figure 14. Nodes expanded by A* and by A* with tie breaking, as a percentage of Dijkstra’s, for every setting.', 600),

  H2('7.5 Scenario map'),
  tcap('Table 14. Results on the 20×30 scenario map'),
  table([2600, 1300, 1500, 1900, 1726], [
    ['Algorithm', 'Path cost', 'Nodes expanded', 'Time ms, mean ± sd', 'Nodes compared with Dijkstra'],
    ...[['Dijkstra', 'scenario_Dijkstra'], ['A*', 'scenario_astar'], ['A* with tie breaking', 'scenario_tb']].map(([n, k]) => [
      n, String(sc(k).cost), String(sc(k).nodes), `${sc(k).time_mean.toFixed(2)} ± ${sc(k).time_sd.toFixed(2)}`,
      `${Math.round(100 * sc(k).nodes / sc('scenario_Dijkstra').nodes)}%`]),
  ]),
  gap(),
  P(`On the scenario map that the application opens with, A* found the same route as Dijkstra, with cost 35, after expanding about a third as many cells and in roughly ${Math.round(10 * sc('scenario_astar').time_mean / sc('scenario_Dijkstra').time_mean) * 10}% of the time. On the version of the map with no path, both algorithms expanded the same ${sc('unreachable_Dijkstra').nodes} cells before reporting that the goal could not be reached.`),

  H2('7.6 Investigating the unexpected results'),
  P('The first surprise was how little A* helped on open grids with the goal in the far corner. On a grid with no walls where the agent moves in four directions, every cell inside the rectangle between the start and the goal lies on some shortest path. All of these cells therefore have exactly the same f value, so the queue cannot rank them and the tie breaking rule decides the order instead. Our A* stores each entry as f, g and the cell, so when two cells have the same f it takes the one with the smaller g first, which is the one nearest the start. This makes it fill the rectangle almost row by row, much like Dijkstra, before it reaches the goal, as the middle picture in Figure 15 shows. With the goal in the far corner the rectangle is the whole grid, which explains why A* needed about 88% of Dijkstra’s expansions. Obstacles break these ties, because detours give many cells an f value higher than the best cost, and those cells are never expanded. That is why A* did better on corner maps with more obstacles. With the middle layout the rectangle is only one row high, so the problem almost disappears.'),
  P('To test this explanation, the experiment script also runs a second version of the A* module with one small change. When two cells have the same f, it takes the one with the smaller h, which is the one closest to the goal. Listing 3 shows the change. The cells are still ordered by f, which is what makes A* optimal, so this version still returns optimal paths, and the unit tests confirm that it never expands more nodes than the original.'),
  ...codeBlock(`# astar.py: when f is equal, the cell with the smaller g comes out first
heapq.heappush(open_set, (tentative_g + h, tentative_g, neighbor))

# experiments.py: when f is equal, the cell with the smaller h comes out first
heapq.heappush(open_set, (ng + h, h, ng, nb))`),
  fcap('Listing 3. The only difference between the A* module and the tie breaking version is the second value in each heap entry'),
  P(`The change made a large difference. On the corner maps the new version expanded ${pct(K.corner_tb_node_pct_mean)}% of Dijkstra’s nodes on average, compared with ${pct(K.corner_astar_node_pct_mean)}% for the original, and was faster than Dijkstra on ${allOr(K.corner_tb_faster, K.corner_solved, 'maps')}. At 100×100 with 10% obstacles it needed ${Math.round(c100('A* (tie-break)', 'nodes_mean'))} expansions and ${f2(c100('A* (tie-break)', 'time_ms_mean'))} ms, compared with ${Math.round(c100('A*', 'nodes_mean'))} expansions and ${f1(c100('A*', 'time_ms_mean'))} ms for the original, and it found paths with exactly the same cost. Figure 15 shows the difference on one map.`),
  ...img(G + 'explored_comparison.png', 'Figure 15. Cells expanded, shown shaded, and the path found, shown in black, on a 50×50 map with 10% obstacles. All three paths cost 98. Only the amount of searching is different.', 600),
  P(`A* was also sometimes slower than Dijkstra even when it expanded fewer cells. This happened on ${K.astar_slower_solved} maps with a path, ${K.astar_slower_solved_corner === K.astar_slower_solved ? 'all' : 'mostly'} with the corner layout and ${K.astar_slower_solved_low_density === K.astar_slower_solved ? 'all' : 'mostly'} with 10% or 20% obstacles, where A* usually saved less than 20% of the expansions. Each A* step does a little more work, because it calculates the heuristic for each neighbour it updates and its heap entries are larger. On maps with more than 500 expansions, Dijkstra spent about ${K.us_per_node_dijkstra.toFixed(1)} microseconds per expanded node and A* about ${K.us_per_node_astar.toFixed(1)}, which is roughly ${Math.round(100 * (overhead - 1))}% more. So A* only comes out ahead on time when it saves more than about ${breakEven}% of the expansions, and close to that point small timing differences decide which one wins. The two modules were also written slightly differently. Dijkstra uses dictionaries and A* uses flat lists, so some of the time difference comes from the code and not only from the algorithms.`),
  P(`On all ${K.unsolved_maps} maps with no path, both algorithms expanded exactly the same cells. When the goal cannot be reached, any complete search has to check every cell connected to the start, and the heuristic cannot rule any of them out. A* was slower on ${K.astar_slower_unreachable} of these maps, by about ${Math.round(100 * (K.unreach_big_astar_time_ratio - 1))}% on average on the ${K.unreach_big_maps} larger ones, which matches its extra work per step. A heuristic only saves work when a path exists.`),
  P(`Many corner maps had no path, ${120 - K.corner_solved} out of 120, because a corner cell only has two neighbours and random walls can easily block it in. At 25×25 with 30% obstacles only 1 of the 10 maps had a path. The middle layout had ${120 - K.middle_solved} maps out of 120 with no path. Averages for settings with only a few maps should be read with care.`),

  H2('7.7 Discussion'),
  P('There was no difference in path quality. Both algorithms always found an optimal path and never disagreed about whether a path existed, so using A* costs nothing in the quality of the answer.'),
  P('A* never expanded more nodes than Dijkstra and usually expanded far fewer. How much it saved depended on how close its estimate was to the real distance. That in turn depends on where the goal is, how many obstacles there are and, on open grids, how ties are broken. The work Dijkstra does only depends on how much of the map is closer to the start than the goal is.'),
  P(`A* was faster in most tests and up to about ${maxSpeed} times faster on large open grids with the middle layout. It was slightly slower when it saved only a few expansions, as on open corner maps, or none at all, as when there was no path, because each of its steps costs a little more. On 10×10 grids both finish in well under a millisecond, so a user would not notice any difference.`),
  P(`So on our grids the real trade off is between extra work per node and fewer nodes, not between speed and optimal paths, since both algorithms always found optimal paths. A* would only give up optimal paths for speed if we used a heuristic that overestimates, such as weighted A* (Pohl, 1970), which we did not do. For the route planning application we recommend A* with tie breaking towards the goal. It never gives a worse path, it was faster on ${allOr(K.tb_faster_total, K.solved_random_total, 'random maps with a path')}, and its advantage grows as the map gets bigger. Dijkstra is still the better tool when distances to many destinations are needed at once, because one run gives the distance to every reachable cell, while the A* heuristic is tied to a single goal.`),

  // ============================================================ 8
  H1('8. Limitations and Difficulties'),
  H2('8.1 Limitations'),
  P(`All timings were taken on one laptop using standard Python. On the same map, repeated runs usually varied by about ${Math.round(K.timing_cv_median_pct)}%, and other programs running on the computer add more variation. For this reason we used the number of nodes expanded as the main measure of effort, and we describe timing results as comparisons between the algorithms instead of exact times. The two modules also use different data structures, so the timings compare the code as well as the algorithms.`),
  P('Some settings had very few maps with a path. With the corner layout at 25×25 and 30% obstacles there was only one, so those averages are less reliable. A larger study could keep making maps until every setting had the same number with a path, and could use random start and goal positions instead of two fixed layouts.'),
  P('The model is also simple. Every move costs the same, the agent only moves in four directions and obstacles never change. Real route planning involves different costs for air, sea and road, different levels of risk and closures that change over time, and the results could be different under those conditions. Finally, the tie breaking version was only used in the experiments. The A* module in the application still uses the original tie breaking.'),
  H2('8.2 Difficulties and how we handled them'),
  P('Our biggest surprise was how poorly A* did on open corner maps. Early benchmarks suggested it was hardly better than Dijkstra there. Instead of reporting this as a general weakness of A*, we worked out that tie breaking was the cause and tested it with the one line change in Listing 3, which confirmed the explanation.'),
  P('Timing noise was another problem. Early runs gave quite different times for the same map, so we added warm up runs, ten repeats, a changing run order and a paused garbage collector, and we report the remaining variation as a standard deviation. Including maps with no path in the averages also gave misleading numbers at first, since a blocked corner map can stop after only two expansions, so these maps are now summarised separately.'),
  P('There were also smaller problems. One early unit test had an expected cost worked out by hand that turned out to be wrong, while the algorithm was right. After that, the tests compared results with a breadth first search instead. The first screenshots of the application were taken before the real algorithms were finished and had to be taken again. To keep the report consistent with the data, the result tables in Section 7 are created directly from results/summary.csv.'),

  // ============================================================ 9
  H1('9. Conclusion and Future Work'),
  H2('9.1 Conclusion'),
  P(`We built a grid environment with an interactive display, wrote Dijkstra’s algorithm and A* search with a shared interface, and compared them on ${K.maps} maps and ${K.runs.toLocaleString('en-GB')} timed runs. Both found optimal paths with identical costs on every map that had a path, and agreed on every map that did not. This shows that both implementations are correct and that the Manhattan heuristic is admissible for our movement rules.`),
  P('A* never expanded more nodes than Dijkstra, but how much it helped depended a lot on the map. With the start and goal on the same row it expanded about a fifth as many nodes and was about five times faster on average. On open corner maps it saved little and was sometimes slightly slower. We showed that this came from the tie breaking rule and not from A* itself. Breaking ties towards the goal cut its expansions to less than a fifth of Dijkstra’s in both layouts without changing any path cost. When there is no path, both algorithms have to search the same area, and A* is slightly slower because each of its steps does more work.'),
  P('Overall, A* is the more efficient choice for finding a route to one destination on grids like ours, as long as its heuristic is admissible and ties are broken towards the goal. Dijkstra is still a simple and reliable algorithm, and the better option when distances to many destinations are needed.'),
  H2('9.2 Future work'),
  B('Use tie breaking towards the goal in the A* module used by the application, as shown in Listing 3.'),
  B('Give different costs to air, sea and road routes, or add a risk score, to model the humanitarian scenario more closely. The heuristic would then need to be scaled by the cheapest move cost to stay admissible.'),
  B('Allow diagonal moves and switch to the octile distance heuristic.'),
  B('Handle routes that close while the agent is moving, using a replanning algorithm such as D* Lite (Koenig and Likhachev, 2002).'),
  B('Compare with other methods such as bidirectional search, Jump Point Search on grids where every move costs the same (Harabor and Grastien, 2011) and weighted A* (Pohl, 1970).'),
  B('Improve the timing tests by using the same data structures in both modules, running more repeats and testing on more than one computer.'),

  // ============================================================ refs
  H1('References'),
  ...[
    [r('Cormen, T.H., Leiserson, C.E., Rivest, R.L. and Stein, C. (2022) '), i_('Introduction to algorithms'), r('. 4th edn. Cambridge, MA: MIT Press.')],
    [r('Dijkstra, E.W. (1959) ‘A note on two problems in connexion with graphs’, '), i_('Numerische Mathematik'), r(', 1(1), pp. 269–271. Available at: https://doi.org/10.1007/BF01386390.')],
    [r('Harabor, D. and Grastien, A. (2011) ‘Online graph pruning for pathfinding on grid maps’, '), i_('Proceedings of the AAAI Conference on Artificial Intelligence'), r(', 25(1), pp. 1114–1119.')],
    [r('Hart, P.E., Nilsson, N.J. and Raphael, B. (1968) ‘A formal basis for the heuristic determination of minimum cost paths’, '), i_('IEEE Transactions on Systems Science and Cybernetics'), r(', 4(2), pp. 100–107. Available at: https://doi.org/10.1109/TSSC.1968.300136.')],
    [r('Hunter, J.D. (2007) ‘Matplotlib: a 2D graphics environment’, '), i_('Computing in Science & Engineering'), r(', 9(3), pp. 90–95. Available at: https://doi.org/10.1109/MCSE.2007.55.')],
    [r('Koenig, S. and Likhachev, M. (2002) ‘D* Lite’, in '), i_('Proceedings of the Eighteenth National Conference on Artificial Intelligence'), r('. Menlo Park, CA: AAAI Press, pp. 476–483.')],
    [r('Krekel, H., Oliveira, B., Pfannschmidt, R., Bruynooghe, F., Laugher, B. and Bruhin, F. (2004) '), i_('pytest'), r('. Version 9.2. Available at: https://github.com/pytest-dev/pytest (Accessed: 18 November 2026).')],
    [r('Pohl, I. (1970) ‘Heuristic search viewed as path finding in a graph’, '), i_('Artificial Intelligence'), r(', 1(3–4), pp. 193–204. Available at: https://doi.org/10.1016/0004-3702(70)90007-X.')],
    [r('Pygame Community (2024) '), i_('Pygame documentation'), r('. Available at: https://www.pygame.org/docs/ (Accessed: 17 November 2026).')],
    [r('Python Software Foundation (2026a) '), i_('heapq: heap queue algorithm'), r('. Available at: https://docs.python.org/3/library/heapq.html (Accessed: 17 November 2026).')],
    [r('Python Software Foundation (2026b) '), i_('time: time access and conversions'), r('. Available at: https://docs.python.org/3/library/time.html (Accessed: 18 November 2026).')],
    [r('Russell, S.J. and Norvig, P. (2021) '), i_('Artificial intelligence: a modern approach'), r('. 4th edn. Hoboken, NJ: Pearson.')],
    [r('Sturtevant, N.R. (2012) ‘Benchmarks for grid-based pathfinding’, '), i_('IEEE Transactions on Computational Intelligence and AI in Games'), r(', 4(2), pp. 144–148. Available at: https://doi.org/10.1109/TCIAIG.2012.2197681.')],
  ].map((t) => P(t, { indent: { left: 440, hanging: 440 }, spacing: { after: 140, line: 264 } })),

  // ============================================================ appendices
  H1('Appendix A. Team Contribution Table', { pageBreakBefore: true }),
  P('Each member’s main contributions and estimated share of the total work. The commit history in the shared repository gives supporting evidence.'),
  table([1700, 6426, 900], [
    ['Member', 'Contribution', 'Share'],
    ['Feliks, 8843892', 'Set up the repository and folder structure. Built the grid environment in grid.py and the application in main.py, including the display, editing, reset and connecting both algorithms. Wrote INTERFACE.md, the README and the requirements file, wrote 18 grid and integration tests and took the application screenshots. Wrote the executive summary, motivation, objectives, technical requirements and environment sections.', '25%'],
    ['Afra, 8739468', 'Wrote Dijkstra’s algorithm in dijkstra.py and 57 unit tests for it. Wrote the Dijkstra benchmark and recorded its results in results/dijkstra_metrics.csv. Made the Dijkstra figures and wrote the sections explaining, implementing and testing Dijkstra. Checked that the module worked with the shared interface.', '25%'],
    ['Zaid, 8964543', 'Wrote A* search and the Manhattan heuristic in astar.py and 39 unit tests for it. Wrote the A* benchmark and recorded its results in results/astar_metrics.csv. Made the A* figures and screenshots and wrote the sections explaining A*, justifying the heuristic and implementing and testing A*.', '25%'],
    ['Zicheng, 8725135', 'Designed the experiments and wrote experiments.py. Produced the raw and summary results and the graphs, and wrote 43 tests for the experiment code. Investigated the tie breaking result and checked the recorded benchmark results. Wrote the experiments, results, limitations and conclusion sections and the references, and put the final report together.', '25%'],
  ]),

  H1('Appendix B. Reproducing the Results'),
  P('Everything in this report can be reproduced from the repository with these commands:'),
  ...codeBlock(`pip install -r requirements.txt
python main.py                  # opens the application
python -m pytest tests          # runs the 157 unit tests
python experiments.py           # writes the results files and graphs`),
  gap(),
  P('Node counts, path costs and whether a path was found will be the same on any computer. Running times will be different on other computers, but the comparison between the algorithms should be similar. The raw data has one row per run, with the map settings, algorithm, run number, start, goal, number of open cells, whether a path was found, path cost and length, nodes expanded, time in milliseconds and the result of the path check.'),
];

const doc = new Document({
  creator: 'CSCI218 Topic 8 group', title: 'Intelligent Pathfinding Using Dijkstra’s Algorithm and A* Search',
  styles: {
    default: { document: { run: { font: FONT, size: BODY } } },
    paragraphStyles: [
      { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: BODY, bold: true }, paragraph: { spacing: { before: 100, after: 20 } } },
      { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: BODY }, paragraph: { spacing: { before: 0, after: 20 }, indent: { left: 300 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: HEAD, bold: true, color: '000000' }, paragraph: { spacing: { before: 360, after: 140 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: HEAD, bold: true, italics: true, color: '000000' }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: 'dj', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: SMALL })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('Final_Report.docx', buf);
  console.log('wrote Final_Report.docx');
});
