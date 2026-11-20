const fs = require('fs');
const d = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, AlignmentType, LevelFormat, BorderStyle } = d;

const P = (t, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o, children: Array.isArray(t) ? t : [new TextRun(t)] });
const B = (t) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 }, children: Array.isArray(t) ? t : [new TextRun(t)] });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const TEAM = (t) => new TextRun({ text: ` [TEAM: ${t}]`, bold: true, color: 'B45309' });
const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFC5CE' };
const borders = { top: border, bottom: border, left: border, right: border };
function table(widths, rows) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, children: r.map((c, j) => new TableCell({
      width: { size: widths[j], type: WidthType.DXA }, borders,
      shading: i === 0 ? { fill: 'E2E7EE', type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: i === 0, size: 20 })] })] })) })),
  });
}
function img(file, caption) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: 560, height: 359 },
        altText: { title: caption, description: caption, name: caption } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: caption, italics: true, size: 20 })] }),
  ];
}
const S = 'screenshots/';

const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Humanitarian Route Planner: Dijkstra vs A* Search')] }),
  P([new TextRun({ text: 'CSCI218 Topic 8, Intelligent Pathfinding. Member 1 report sections: grid environment, interface and integration.', italics: true })]),
  P([new TextRun({ text: 'Items marked [TEAM: ...] depend on other members\u2019 work and must be completed before submission.', bold: true, color: 'B45309' })]),

  H1('1. Executive Summary'),
  P('Humanitarian aid reaching a crisis destination depends on routes that can close without warning: an airport, a port or a road may become unavailable and the plan must change quickly. This project studies that planning problem in a simplified form. We model a region as a 2D grid in which open cells are usable route segments and blocked cells are unavailable ones, and an agent must find the shortest route from Dubai to a crisis destination.'),
  P('We implemented Dijkstra\u2019s algorithm and A* search in Python behind one shared interface and built an interactive grid application that displays the start, goal, closed routes, explored cells and final path, and reports whether the goal is reachable. The two algorithms are compared on execution time, number of nodes expanded and path cost across several grid sizes and obstacle densities, using identical inputs for both.'),
  P([new TextRun('Both algorithms are expected to return paths of equal, optimal cost under the chosen rules, with A* expanding fewer cells when its Manhattan-distance heuristic guides the search well.'), TEAM('Member 4: replace this sentence with the confirmed findings and key figures from results.csv, e.g. average nodes expanded and time per algorithm, once experiments are complete.')]),
  P('The environment is an illustrative model. It does not use real operational data, and it is not a tool for planning actual relief operations.'),

  H1('2. Motivation and Problem Statement'),
  H2('2.1 Motivation'),
  P('Delivering relief to a crisis area is a logistics problem over a network of air, sea and land links. Those links are not always available: facilities can close, access can be restricted and conditions can change from one day to the next. Planners therefore need to recompute a good route whenever the set of usable links changes, and the method must give a reliable answer fast.'),
  P('Shortest-path search is the standard computational tool for this. Dijkstra\u2019s algorithm guarantees an optimal route but searches in all directions; A* adds a heuristic estimate of the remaining distance and can reach the goal while examining far fewer locations. Which is more efficient depends on the layout of the obstacles, which is why a controlled comparison is useful.'),
  H2('2.2 Problem statement'),
  P('Given a grid with open and blocked cells, a start cell (Dubai) and a goal cell (a crisis destination), find a lowest-cost path using only open cells, or report that the goal is unreachable. Compare Dijkstra and A* on execution time, nodes expanded and path cost, and determine when each is the better choice.'),
  P([new TextRun('Theme link. '), new TextRun('This corresponds to the topic \u201CHumanitarian Route Planner\u201D: find the fastest or lowest-risk route from Dubai to a crisis destination when selected airports, ports or roads are unavailable. In our model each closed airport, port or road is a blocked region of the grid.')]),

  H1('3. Project Objectives and Scope'),
  H2('3.1 Objectives'),
  B('Build a 2D grid environment with walkable and blocked cells, a start point and a goal point.'),
  B('Implement Dijkstra\u2019s algorithm and A* search (Manhattan heuristic) in separate Python modules with one common input and output format.'),
  B('Visualise the grid, explored cells and final path, and clearly report when no path exists.'),
  B('Let the user create, edit and reset environments, and run repeated tests without restarting.'),
  B('Compare the algorithms fairly on execution time, nodes expanded and path cost over several grid sizes and obstacle densities.'),
  B('Verify that both algorithms return the same optimal cost whenever a path exists.'),
  H2('3.2 In scope'),
  B('Static grids from 10x10 up to 100x100 with 4-directional movement and unit move cost.'),
  B('A built-in scenario (Dubai to a crisis destination with closed gateways), random layouts at 10 to 40% obstacle density, and a deliberately unreachable layout.'),
  B('Interactive desktop application, unit tests, and a repeatable experiment script.'),
  H2('3.3 Out of scope'),
  B('Moving obstacles, real-time updates, diagonal movement and variable edge costs.'),
  B('Real geographic, airspace or security data, and any operational use. Real corridor availability changes over time and is not modelled.'),
  B('A full multimodal network with separate air, sea and road costs or risk scoring. This is a possible future extension (listed under future improvements).'),
  P([new TextRun({ text: 'Assumption: ', bold: true }), new TextRun('treating \u201Cfastest\u201D and \u201Clowest-risk\u201D as one number, the path cost, with every step costing 1. Risk weighting would require non-uniform costs and a different heuristic.')]),

  H1('4. Technical Requirements'),
  H2('4.1 Software and libraries'),
  table([2700, 6326], [
    ['Item', 'Requirement'],
    ['Language', 'Python 3.10 or newer'],
    ['Interface library', 'pygame 2.5 or newer (grid window and buttons)'],
    ['Testing', 'pytest 7 or newer'],
    ['Experiments', 'Standard library (csv, statistics, time); matplotlib for graphs [TEAM: Member 4 to confirm]'],
    ['Version control', 'Git, shared GitHub or GitLab repository'],
    ['Operating system', 'Windows, macOS or Linux with a display'],
  ]),
  P('', {}),
  H2('4.2 Hardware'),
  P('A standard laptop is sufficient. The largest test (100x100, 10,000 cells) runs in milliseconds per search, so no special hardware or GPU is needed. A screen of at least 1100x700 pixels is recommended for the application window.'),
  H2('4.3 Functional requirements'),
  table([900, 5326, 2800], [
    ['ID', 'Requirement', 'Verified by'],
    ['F1', 'Grid with walkable and blocked cells, one start and one goal', 'tests/test_grid.py'],
    ['F2', 'Colour display of start, goal, obstacles, explored cells and path', 'Screenshots (Figures 1 to 4)'],
    ['F3', 'Create and edit layouts by clicking, and generate random layouts', 'Manual test, seeded layout test'],
    ['F4', 'Run Dijkstra and A* through one consistent interface', 'Interface contract tests'],
    ['F5', 'Show whether a path was found or the goal is unreachable', 'Unreachable test and Figure 4'],
    ['F6', 'Reset or clear and run again without restarting', 'Manual test'],
    ['F7', 'Report path cost, nodes expanded and time for each run', 'Result cards in the interface'],
  ]),
  P('', {}),
  H2('4.4 Non-functional requirements'),
  B('Fairness: both algorithms receive the same grid, start, goal and movement rules.'),
  B('Repeatability: random layouts use a seed so any experiment can be reproduced.'),
  B('Modularity: grid, interface and each algorithm live in separate files, so a module can be replaced without changing the others.'),

  H1('5. Grid Environment and Visualisation'),
  H2('5.1 Representation as a search problem'),
  P('The environment is a Grid object with rows and columns. Each cell is a (row, column) pair, and the blocked cells are stored in a set. A walkable cell is a node; each walkable up, down, left or right neighbour is a possible move. Every move costs 1, and diagonal moves are not allowed. Under these rules the Manhattan distance never overestimates the true remaining cost, so A* with this heuristic returns an optimal path.'),
  table([2700, 6326], [
    ['Element', 'Meaning in the humanitarian-route model'],
    ['Start cell (green, S)', 'Dubai, where the relief shipment begins'],
    ['Goal cell (red, G)', 'Crisis destination'],
    ['Open cell (white)', 'Usable route segment'],
    ['Blocked cell (dark)', 'Unavailable airport, port or road'],
    ['Explored cell (blue or green tint)', 'Cell expanded by the search; blue for Dijkstra, green for A*'],
    ['Path cell (orange)', 'Final route returned by the algorithm'],
  ]),
  P('', {}),
  H2('5.2 Creating and changing environments'),
  B('Built-in scenario: a 20x30 grid with Dubai on the west side, the destination on the east, and walls with gaps that act as closed gateways, so the shortest route must detour.'),
  B('Random layouts: 10x10, 25x25 or 50x50 at 10, 20, 30 or 40% obstacle density. A seed makes each layout repeatable. Start and goal are never blocked.'),
  B('Manual editing: click or drag to block or reopen cells; the Start and Goal tools move the endpoints. Editing a cell clears old results so a stale path is never shown.'),
  B('Unreachable demo: a full wall of closed cells separates start and goal.'),
  B('Reset: Clear path keeps the map; Reset grid opens every cell. Neither needs a restart.'),
  H2('5.3 Integration with the algorithms'),
  P('Both algorithm modules expose solve(grid, start, goal) and return the same dictionary: found, path, cost, nodes_expanded, time and explored. The interface only calls grid.neighbors() and grid.is_walkable(), so it works with any module that follows INTERFACE.md. The application checks that each result contains the required keys and shows an error message instead of crashing if a module fails. When both are run on the same grid, it also warns if they disagree on whether a path exists or on its cost.'),
  H2('5.4 Interface'),
  P('The right-hand panel contains tool buttons (Wall, Start, Goal), run buttons (Dijkstra, A*, both), a view switch, reset and map buttons, and one result card per algorithm showing the status (path found or goal unreachable), path cost, nodes expanded and time in milliseconds. A legend and a status line explain the colours and the latest action.'),
  ...img(S + 'shot_scenario_astar.png', 'Figure 1. A* on the built-in scenario: path found, with explored cells shaded green.'),
  ...img(S + 'shot_scenario_dijkstra.png', 'Figure 2. Dijkstra on the same scenario: explored cells shaded blue.'),
  ...img(S + 'shot_unreachable_both.png', 'Figure 3. Unreachable demo: both algorithms report that the goal cannot be reached.'),
  ...img(S + 'shot_random_both.png', 'Figure 4. Random 10x10 layout with both algorithms run.'),
  P([new TextRun('Screenshots above use placeholder algorithm modules. '), TEAM('retake Figures 1 to 4 after Members 2 and 3 add their final dijkstra.py and astar.py (python main.py --screenshot out.png --map scenario --algo both).')]),
  H2('5.5 Testing the interface'),
  P('tests/test_grid.py contains 18 tests. They cover grid bounds, neighbour generation, protection of start and goal, repeatable random layouts, reset and text round-tripping. For each algorithm module they check that the result has the agreed keys, that every move in the path is a valid 4-directional step through open cells, that the reported cost equals the path length, that an unreachable goal gives found = False with an empty path, and that start equal to goal gives cost 0. A final test checks that both algorithms agree on cost for 30 seeded random maps. All 18 tests passed with the placeholder modules.'),
  P([TEAM('rerun python -m pytest tests with the final modules and update the count and result.')]),
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
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } }, children }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync('Member1_Report_Sections.docx', b); console.log('done'); });
