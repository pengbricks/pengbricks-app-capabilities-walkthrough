import type { FlowDiagram, FlowNode } from '../data/walkthroughs/types.ts';

// Grid layout for flow diagrams: nodes sit in columns and rows. Edges route only through the empty
// channels between columns and rows, so a line never crosses a node or its text.
export const COL_W = 240;
const BASE_COL_GAP = 56;
export const ROW_H = 64;
const ROW_GAP = 84;
// Lanes wrap their rows with room above for the eyebrow and a smaller margin below.
export const LANE_TOP = 36;
export const LANE_BOTTOM = 14;
// Horizontal channels between rows run in the middle of the space two lanes leave between them.
const CHANNEL_BELOW = LANE_BOTTOM + (ROW_GAP - LANE_TOP - LANE_BOTTOM) / 2;
const TOP = 48;
export const SIDE = 24;
export const BOTTOM = 44;
const BEND = 16; // bends into a node turn this far before its edge
export const GATE = 22; // half-diagonal of an approval gate
export const PAD = 18; // horizontal padding inside a node

// Rough text widths (px) for the diagram fonts, used for layout only.
// Slightly generous so text is condensed before it reaches a node's outline.
export const CHAR_W = { label: 8.6, labelMono: 8.4, sub: 7.0, edge: 6.8 };
export const textWidth = (text: string, perChar: number) => text.length * perChar;

export type Layout = { colGap: number; colX: (col: number) => number; rowY: (row: number) => number };

export function layoutFor(diagram: FlowDiagram): Layout {
  // Labels on straight edges between neighbouring columns sit in the column gap, so it must fit them.
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  let colGap = BASE_COL_GAP;
  for (const edge of diagram.edges) {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!edge.label || !a || !b) continue;
    if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
      colGap = Math.max(colGap, Math.ceil(textWidth(edge.label, CHAR_W.edge)) + 2 * BEND + 24);
    }
  }
  return {
    colGap,
    colX: (col) => SIDE + col * (COL_W + colGap),
    rowY: (row) => TOP + row * (ROW_H + ROW_GAP),
  };
}

export type Box = { left: number; right: number; top: number; bottom: number; cx: number; cy: number };

export function box(node: FlowNode, L: Layout): Box {
  const x = L.colX(node.col);
  const y = L.rowY(node.row);
  if (node.kind === 'gate') {
    const cx = x + COL_W / 2;
    const cy = y + GATE;
    return { left: cx - GATE, right: cx + GATE, top: cy - GATE, bottom: cy + GATE, cx, cy };
  }
  return { left: x, right: x + COL_W, top: y, bottom: y + ROW_H, cx: x + COL_W / 2, cy: y + ROW_H / 2 };
}

export type Route = { d: string; label: [number, number]; anchor?: 'start' | 'middle' | 'end' };

/** Offsets that keep edges sharing a node side or a channel apart: where the edge leaves, where it enters, and its channel. */
export type RouteOffset = { out: number; inn: number; ch: number };
export const NO_OFFSET: RouteOffset = { out: 0, inn: 0, ch: 0 };

// Orthogonal route from node a to node b through free channels. `occupied` holds "col,row" keys.
export function route(a: FlowNode, b: FlowNode, L: Layout, occupied: Set<string>, off: RouteOffset = NO_OFFSET): Route {
  const A = box(a, L);
  const B = box(b, L);
  // A gate is a small diamond: an edge sliding off its center stops where the slanted side is,
  // so the end is pulled in by the size of the slide.
  const { out, inn } = off;
  const pullA = a.kind === 'gate' ? Math.abs(out) : 0;
  const pullB = b.kind === 'gate' ? Math.abs(inn) : 0;
  const slide = 1;
  const Acy = A.cy + out;
  const Bcy = B.cy + inn;
  const Acx = A.cx + out;
  const Bcx = B.cx + inn;
  const { ch } = off;
  const gapCol = (col: number, side: 1 | -1) =>
    side === 1 ? L.colX(col) + COL_W + L.colGap / 2 : L.colX(col) - L.colGap / 2;
  const gapRowBelow = (row: number) => L.rowY(row) + ROW_H + CHANNEL_BELOW;
  const gapRowAbove = (row: number) => L.rowY(row) - ROW_GAP + CHANNEL_BELOW;
  const free = (cells: string[]) => cells.every((cell) => !occupied.has(cell));
  const between = (from: number, to: number) => {
    const list: number[] = [];
    for (let i = Math.min(from, to) + 1; i < Math.max(from, to); i += 1) list.push(i);
    return list;
  };

  // Same column.
  if (a.col === b.col) {
    const down = b.row > a.row;
    if (free(between(a.row, b.row).map((r) => `${a.col},${r}`))) {
      const y1 = down ? A.bottom - pullA : A.top + pullA;
      const y2 = down ? B.top - 2 + pullB : B.bottom + 2 - pullB;
      const ly = down ? gapRowBelow(a.row) : gapRowAbove(a.row);
      const x = A.cx + out * slide;
      return { d: `M${x} ${y1}V${y2}`, label: [x + 8, ly + 4], anchor: 'start' };
    }
    // Blocked: detour through the column gap to the right.
    const gx = gapCol(a.col, 1) + ch;
    return {
      d: `M${A.right - pullA} ${Acy}H${gx}V${Bcy}H${B.right + 2 - pullB}`,
      label: [gx + 6, down ? gapRowBelow(a.row) + 4 : gapRowAbove(a.row) + 4],
      anchor: 'start',
    };
  }

  const side: 1 | -1 = b.col > a.col ? 1 : -1;
  const x1 = side === 1 ? A.right - pullA : A.left + pullA;
  const x2 = side === 1 ? B.left - 2 + pullB : B.right + 2 - pullB;
  // Bends into b turn in the gap just before b's column edge. Measuring from the column, not from
  // the node, keeps the bend in the gap when b is a gate drawn narrower than its column.
  const bendX = (side === 1 ? L.colX(b.col) - BEND : L.colX(b.col) + COL_W + BEND) + ch;

  // Same row.
  if (a.row === b.row) {
    if (free(between(a.col, b.col).map((c) => `${c},${a.row}`))) {
      // Label sits just past the source, clear of bends that turn near the target.
      const y = A.cy + out * slide;
      return { d: `M${x1} ${y}H${x2}`, label: [x1 + side * 8, y - 9], anchor: side === 1 ? 'start' : 'end' };
    }
    // Blocked: drop into the row gap below, travel, and come back up.
    const gy = gapRowBelow(a.row) + ch;
    return {
      d: `M${Acx} ${A.bottom - pullA}V${gy}H${Bcx}V${B.bottom + 2 - pullB}`,
      label: [(Acx + Bcx) / 2, gy - 6],
    };
  }

  const down = b.row > a.row;
  // Neighbouring columns: one bend in the column gap between them.
  if (Math.abs(b.col - a.col) === 1) {
    const ly = down ? gapRowBelow(a.row) : gapRowAbove(a.row);
    return { d: `M${x1} ${Acy}H${bendX}V${Bcy}H${x2}`, label: [bendX + 6, ly + 4], anchor: 'start' };
  }

  // Further apart: leave through the gap next to a, travel along the row gap next to b, and enter
  // through the gap next to b. Gap columns and gap rows never hold nodes.
  const gx1 = gapCol(a.col, side) + ch;
  const gx2 = bendX;
  const gy = (down ? gapRowAbove(b.row) : gapRowBelow(b.row)) + ch;
  return {
    d: `M${x1} ${Acy}H${gx1}V${gy}H${gx2}V${Bcy}H${x2}`,
    label: [(gx1 + gx2) / 2, gy - 6],
  };
}

export type GatePlacement = 'above' | 'below' | 'right' | 'left';

// Where a gate's label (and sub) would sit for each placement, as a box plus the text anchor point.
export function gateLabelArea(
  gate: FlowNode,
  L: Layout,
  at: GatePlacement
): { area: Box; x: number; y: number; anchor: 'middle' | 'start' | 'end' } {
  const b = box(gate, L);
  const w = Math.max(textWidth(gate.label, CHAR_W.edge), gate.sub ? textWidth(gate.sub, CHAR_W.edge) : 0);
  const h = gate.sub ? 30 : 16;
  const mk = (left: number, top: number): Box => ({ left, right: left + w, top, bottom: top + h, cx: 0, cy: 0 });
  if (at === 'above')
    return { area: mk(b.cx - w / 2, b.top - 4 - h), x: b.cx, y: b.top - 4 - h + 12, anchor: 'middle' };
  if (at === 'below') return { area: mk(b.cx - w / 2, b.bottom + 4), x: b.cx, y: b.bottom + 16, anchor: 'middle' };
  if (at === 'right')
    return { area: mk(b.right + 6, b.cy - h / 2), x: b.right + 6, y: b.cy - h / 2 + 12, anchor: 'start' };
  return { area: mk(b.left - 6 - w, b.cy - h / 2), x: b.left - 6, y: b.cy - h / 2 + 12, anchor: 'end' };
}

const segCrosses = (d: string, area: Box) => {
  const nums = (d.match(/[MHV][^MHV]*/g) ?? []).map(
    (t) => [t[0], ...t.slice(1).trim().split(/\s+/).map(Number)] as [string, ...number[]]
  );
  let x = 0;
  let y = 0;
  for (const [cmd, ...v] of nums) {
    let nx = x;
    let ny = y;
    if (cmd === 'M') {
      [x, y] = v;
      continue;
    }
    if (cmd === 'H') nx = v[0];
    if (cmd === 'V') ny = v[0];
    if (
      Math.min(x, nx) < area.right &&
      Math.max(x, nx) > area.left &&
      Math.min(y, ny) < area.bottom &&
      Math.max(y, ny) > area.top
    )
      return true;
    x = nx;
    y = ny;
  }
  return false;
};

// Picks the first side of a gate where no edge runs through its label.
export function placeGateLabel(gate: FlowNode, L: Layout, paths: string[]): GatePlacement {
  const order: GatePlacement[] = ['above', 'below', 'right', 'left'];
  return order.find((at) => !paths.some((d) => segCrosses(d, gateLabelArea(gate, L, at).area))) ?? 'above';
}

// ---- Text geometry, shared by the renderer and the overlap tests ----

/** Splits an orthogonal path ("M x y H x V y ...") into line segments. */
export type Seg = { x1: number; y1: number; x2: number; y2: number };
export function pathSegments(d: string): Seg[] {
  const tokens = d.match(/[MHV]-?[\d.]+(?:\s-?[\d.]+)?/g) ?? [];
  const out: Seg[] = [];
  let x = 0;
  let y = 0;
  for (const token of tokens) {
    const [cmd, ...nums] = [token[0], ...token.slice(1).trim().split(/\s+/).map(Number)];
    if (cmd === 'M') [x, y] = nums;
    if (cmd === 'H') {
      out.push({ x1: x, y1: y, x2: nums[0], y2: y });
      x = nums[0];
    }
    if (cmd === 'V') {
      out.push({ x1: x, y1: y, x2: x, y2: nums[0] });
      y = nums[0];
    }
  }
  return out;
}

/** Whether a segment passes through a box (touching the border does not count). */
export function segHitsBox(s: Seg, b: Box): boolean {
  const [xa, xb] = [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)];
  const [ya, yb] = [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)];
  return xa < b.right && xb > b.left && ya < b.bottom && yb > b.top;
}

export const boxesOverlap = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

type Anchor = 'start' | 'middle' | 'end';
const labelBox = (x: number, y: number, anchor: Anchor, w: number): Box => {
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { left, right: left + w, top: y - 11, bottom: y + 4, cx: 0, cy: 0 };
};
const inflate = (b: Box, by: number): Box => ({
  ...b,
  left: b.left - by,
  right: b.right + by,
  top: b.top - by,
  bottom: b.bottom + by,
});

export type PlacedLabel = { x: number; y: number; anchor: Anchor; box: Box };

/** Box of an edge label as drawn: baseline at label[1], anchored per the route. */
export function edgeLabelBox(r: Route, text: string): Box {
  return labelBox(r.label[0], r.label[1], r.anchor ?? 'middle', textWidth(text, CHAR_W.edge));
}

const LANE_CHAR_W = 8; // 11px mono with 0.12em letter spacing

/** Lane eyebrow (uppercase mono with letter spacing) plus the short lava rule under it, starting at x. */
export function laneLabelBox(label: string, fromRow: number, L: Layout, x = 20): Box {
  const baseline = L.rowY(fromRow) - 20;
  return {
    left: x,
    right: x + Math.max(label.length * LANE_CHAR_W + 4, 28),
    top: baseline - 10,
    bottom: baseline + 10,
    cx: 0,
    cy: 0,
  };
}

export type TextPlan = {
  routes: Route[];
  /** One entry per edge; undefined when the edge has no label. */
  edgeLabels: (PlacedLabel | undefined)[];
  /** Left x of each lane eyebrow, in lane order. */
  laneX: number[];
  laneBoxes: Box[];
  gateAreas: Map<string, { placement: GatePlacement; area: Box }>;
};

/**
 * Decides where every piece of text goes so that no line runs through text and no text overlaps text:
 * gate labels first, then lane eyebrows, then edge labels. Each edge label tries its preferred spot,
 * then spots along each segment of its own route, and takes the first one that is clear.
 */
export function planText(diagram: FlowDiagram, L: Layout, width: number): TextPlan {
  const routes = routeAll(diagram, L);
  const segs = routes.flatMap((r) => pathSegments(r.d));
  const nodeBoxes = diagram.nodes.map((node) => inflate(box(node, L), 2));
  const hitsLine = (b: Box) => segs.some((seg) => segHitsBox(seg, inflate(b, 2)));
  const taken: Box[] = [];
  for (const b of laneBorders(diagram, L)) {
    taken.push({
      left: Math.min(b.x1, b.x2),
      right: Math.max(b.x1, b.x2),
      top: Math.min(b.y1, b.y2) - 1,
      bottom: Math.max(b.y1, b.y2) + 1,
      cx: 0,
      cy: 0,
    });
  }
  const free = (b: Box) =>
    !hitsLine(b) && !nodeBoxes.some((n) => boxesOverlap(n, b)) && !taken.some((t) => boxesOverlap(inflate(t, 2), b));

  const paths = routes.map((r) => r.d);
  const gateAreas = new Map<string, { placement: GatePlacement; area: Box }>();
  for (const gate of diagram.nodes.filter((node) => node.kind === 'gate')) {
    const placement = placeGateLabel(gate, L, paths);
    const { area } = gateLabelArea(gate, L, placement);
    gateAreas.set(gate.id, { placement, area });
    taken.push(area);
  }

  const laneX: number[] = [];
  const laneBoxes: Box[] = [];
  for (const lane of diagram.lanes ?? []) {
    const w = laneLabelBox(lane.label, lane.fromRow, L).right - 20;
    let x = 20;
    for (let candidate = 20; candidate <= width - 20 - w; candidate += 8) {
      if (free(laneLabelBox(lane.label, lane.fromRow, L, candidate))) {
        x = candidate;
        break;
      }
    }
    const b = laneLabelBox(lane.label, lane.fromRow, L, x);
    laneX.push(x);
    laneBoxes.push(b);
    taken.push(b);
  }

  const edgeLabels = diagram.edges.map((edge, i): PlacedLabel | undefined => {
    if (!edge.label) return undefined;
    const w = textWidth(edge.label, CHAR_W.edge);
    const r = routes[i];
    const preferred: PlacedLabel = {
      x: r.label[0],
      y: r.label[1],
      anchor: r.anchor ?? 'middle',
      box: edgeLabelBox(r, edge.label),
    };
    const candidates: PlacedLabel[] = [preferred];
    for (const seg of pathSegments(r.d)) {
      const horizontal = seg.y1 === seg.y2;
      const len = Math.abs(horizontal ? seg.x2 - seg.x1 : seg.y2 - seg.y1);
      if (len < 24) continue;
      for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        const x = seg.x1 + (seg.x2 - seg.x1) * t;
        const y = seg.y1 + (seg.y2 - seg.y1) * t;
        const spots: [number, number, Anchor][] = horizontal
          ? [
              [x, y - 7, 'middle'],
              [x, y + 17, 'middle'],
            ]
          : [
              [x + 7, y + 4, 'start'],
              [x - 7, y + 4, 'end'],
            ];
        for (const [sx, sy, anchor] of spots)
          candidates.push({ x: sx, y: sy, anchor, box: labelBox(sx, sy, anchor, w) });
      }
    }
    const pick = candidates.find((c) => free(c.box)) ?? preferred;
    taken.push(pick.box);
    return pick;
  });

  return { routes, edgeLabels, laneX, laneBoxes, gateAreas };
}

// Wide enough that an edge label fits between two parallel lines.
const SLIDE = [0, 22, -22, 44, -44, 11, -11];
const CHANNEL = [0, -16, 16, -32, 32];
/** Parallel lines from different edges stay at least this far apart. */
export const MIN_PARALLEL = 16;
/** Edge lines keep this far from a lane border along their length. */
export const LANE_CLEAR = 8;

/** Two segments lie on the same line and share a stretch longer than a pixel. */
export function collinearOverlap(p: Seg, q: Seg): boolean {
  const horizontal = (s: Seg) => s.y1 === s.y2;
  if (horizontal(p) !== horizontal(q)) return false;
  if (horizontal(p)) {
    if (Math.abs(p.y1 - q.y1) > 1) return false;
    return (
      Math.min(Math.max(p.x1, p.x2), Math.max(q.x1, q.x2)) - Math.max(Math.min(p.x1, p.x2), Math.min(q.x1, q.x2)) > 1
    );
  }
  if (Math.abs(p.x1 - q.x1) > 1) return false;
  return (
    Math.min(Math.max(p.y1, p.y2), Math.max(q.y1, q.y2)) - Math.max(Math.min(p.y1, p.y2), Math.min(q.y1, q.y2)) > 1
  );
}

/** Two segments run side by side (or on top of each other) closer than `min` for more than a pixel. */
export function parallelTooClose(p: Seg, q: Seg, min: number): boolean {
  const horizontal = (g: Seg) => g.y1 === g.y2;
  if (horizontal(p) !== horizontal(q)) return false;
  const [pa, pb] = horizontal(p)
    ? [Math.min(p.x1, p.x2), Math.max(p.x1, p.x2)]
    : [Math.min(p.y1, p.y2), Math.max(p.y1, p.y2)];
  const [qa, qb] = horizontal(q)
    ? [Math.min(q.x1, q.x2), Math.max(q.x1, q.x2)]
    : [Math.min(q.y1, q.y2), Math.max(q.y1, q.y2)];
  if (Math.min(pb, qb) - Math.max(pa, qa) <= 1) return false;
  const gap = horizontal(p) ? Math.abs(p.y1 - q.y1) : Math.abs(p.x1 - q.x1);
  return gap < min;
}

export function diagramWidth(diagram: FlowDiagram, L: Layout): number {
  const cols = Math.max(...diagram.nodes.map((node) => node.col)) + 1;
  return L.colX(cols - 1) + COL_W + SIDE;
}

/** The rectangle a lane band covers, as drawn. */
export function laneRect(lane: { fromRow: number; toRow: number }, L: Layout, width: number): Box {
  return {
    left: 8,
    right: width - 8,
    top: L.rowY(lane.fromRow) - LANE_TOP,
    bottom: L.rowY(lane.toRow) + ROW_H + LANE_BOTTOM,
    cx: 0,
    cy: 0,
  };
}

/** The four border lines of every lane. */
export function laneBorders(diagram: FlowDiagram, L: Layout): Seg[] {
  const width = diagramWidth(diagram, L);
  return (diagram.lanes ?? []).flatMap((lane) => {
    const r = laneRect(lane, L, width);
    return [
      { x1: r.left, y1: r.top, x2: r.right, y2: r.top },
      { x1: r.left, y1: r.bottom, x2: r.right, y2: r.bottom },
      { x1: r.left, y1: r.top, x2: r.left, y2: r.bottom },
      { x1: r.right, y1: r.top, x2: r.right, y2: r.bottom },
    ];
  });
}

/**
 * Routes every edge. Each edge takes the first slide offsets (where it leaves, where it enters, and
 * its channel) that put it on no line already used by an earlier edge and through no other node.
 */
export function routeAll(diagram: FlowDiagram, L: Layout): Route[] {
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  const occupied = new Set(diagram.nodes.map((node) => `${node.col},${node.row}`));
  const nodeBoxes = diagram.nodes.map((node) => ({ id: node.id, b: { ...box(node, L) } }));
  const used: Seg[] = [];
  const borders = laneBorders(diagram, L);
  return diagram.edges.map((edge) => {
    const from = byId.get(edge.from)!;
    const to = byId.get(edge.to)!;
    const ok = (r: Route) => {
      const segs = pathSegments(r.d);
      if (segs.some((seg) => used.some((u) => parallelTooClose(seg, u, MIN_PARALLEL)))) return false;
      if (segs.some((seg) => borders.some((b) => parallelTooClose(seg, b, LANE_CLEAR)))) return false;
      return nodeBoxes.every(({ id, b }) => {
        if (id === edge.from || id === edge.to) return true;
        return !segs.some((seg) =>
          segHitsBox(seg, { ...b, left: b.left + 1, right: b.right - 1, top: b.top + 1, bottom: b.bottom - 1 })
        );
      });
    };
    let chosen: Route | undefined;
    search: for (const ch of CHANNEL) {
      for (const out of SLIDE) {
        for (const inn of SLIDE) {
          const r = route(from, to, L, occupied, { out, inn, ch });
          if (ok(r)) {
            chosen = r;
            break search;
          }
        }
      }
    }
    const result = chosen ?? route(from, to, L, occupied);
    used.push(...pathSegments(result.d));
    return result;
  });
}

/**
 * Breaks text into at most two lines that each fit `max` px, splitting at the space that balances the
 * lines. Text with no good split (one long word) stays on one line and the caller condenses it.
 */
export function wrapText(text: string, perChar: number, max: number): string[] {
  if (textWidth(text, perChar) <= max) return [text];
  const words = text.split(' ');
  let best: string[] | undefined;
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const widest = Math.max(...lines.map((line) => textWidth(line, perChar)));
    if (widest < bestWidth) {
      best = lines;
      bestWidth = widest;
    }
  }
  return best ?? [text];
}
