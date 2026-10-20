import type { FlowDiagram, FlowNode } from '../data/walkthroughs/types.ts';

// Grid layout for flow diagrams: nodes sit in columns and rows. Edges route only through the empty
// channels between columns and rows, so a line never crosses a node or its text.
export const COL_W = 208;
const BASE_COL_GAP = 56;
export const ROW_H = 64;
const ROW_GAP = 56;
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

// Orthogonal route from node a to node b through free channels. `occupied` holds "col,row" keys.
export function route(a: FlowNode, b: FlowNode, L: Layout, occupied: Set<string>): Route {
  const A = box(a, L);
  const B = box(b, L);
  const gapCol = (col: number, side: 1 | -1) => (side === 1 ? L.colX(col) + COL_W + L.colGap / 2 : L.colX(col) - L.colGap / 2);
  const gapRowBelow = (row: number) => L.rowY(row) + ROW_H + ROW_GAP / 2;
  const gapRowAbove = (row: number) => L.rowY(row) - ROW_GAP / 2;
  const free = (cells: string[]) => cells.every((cell) => !occupied.has(cell));
  const between = (from: number, to: number) => {
    const out: number[] = [];
    for (let i = Math.min(from, to) + 1; i < Math.max(from, to); i += 1) out.push(i);
    return out;
  };

  // Same column.
  if (a.col === b.col) {
    const down = b.row > a.row;
    if (free(between(a.row, b.row).map((r) => `${a.col},${r}`))) {
      const y1 = down ? A.bottom : A.top;
      const y2 = down ? B.top - 2 : B.bottom + 2;
      const ly = down ? gapRowBelow(a.row) : gapRowAbove(a.row);
      return { d: `M${A.cx} ${y1}V${y2}`, label: [A.cx + 8, ly + 4] };
    }
    // Blocked: detour through the column gap to the right.
    const gx = gapCol(a.col, 1);
    return {
      d: `M${A.right} ${A.cy}H${gx}V${B.cy}H${B.right + 2}`,
      label: [gx, down ? gapRowBelow(a.row) + 4 : gapRowAbove(a.row) + 4],
    };
  }

  const side: 1 | -1 = b.col > a.col ? 1 : -1;
  const x1 = side === 1 ? A.right : A.left;
  const x2 = side === 1 ? B.left - 2 : B.right + 2;
  // Bends into b turn in the gap just before b's column edge. Measuring from the column, not from
  // the node, keeps the bend in the gap when b is a gate drawn narrower than its column.
  const bendX = side === 1 ? L.colX(b.col) - BEND : L.colX(b.col) + COL_W + BEND;

  // Same row.
  if (a.row === b.row) {
    if (free(between(a.col, b.col).map((c) => `${c},${a.row}`))) {
      // Label sits just past the source, clear of bends that turn near the target.
      return { d: `M${x1} ${A.cy}H${x2}`, label: [x1 + side * 8, A.cy - 9], anchor: side === 1 ? 'start' : 'end' };
    }
    // Blocked: drop into the row gap below, travel, and come back up.
    const gy = gapRowBelow(a.row);
    return {
      d: `M${A.cx} ${A.bottom}V${gy}H${B.cx}V${B.bottom + 2}`,
      label: [(A.cx + B.cx) / 2, gy - 6],
    };
  }

  const down = b.row > a.row;
  // Neighbouring columns: one bend in the column gap between them.
  if (Math.abs(b.col - a.col) === 1) {
    const gx = bendX;
    const ly = down ? gapRowBelow(a.row) : gapRowAbove(a.row);
    return { d: `M${x1} ${A.cy}H${gx}V${B.cy}H${x2}`, label: [gx, ly + 4] };
  }

  // Further apart: leave through the gap next to a, travel along the row gap next to b, and enter
  // through the gap next to b. Gap columns and gap rows never hold nodes.
  const gx1 = gapCol(a.col, side);
  const gx2 = bendX;
  const gy = down ? gapRowAbove(b.row) : gapRowBelow(b.row);
  return {
    d: `M${x1} ${A.cy}H${gx1}V${gy}H${gx2}V${B.cy}H${x2}`,
    label: [(gx1 + gx2) / 2, gy - 6],
  };
}

export type GatePlacement = 'above' | 'below' | 'right' | 'left';

// Where a gate's label (and sub) would sit for each placement, as a box plus the text anchor point.
export function gateLabelArea(gate: FlowNode, L: Layout, at: GatePlacement): { area: Box; x: number; y: number; anchor: 'middle' | 'start' | 'end' } {
  const b = box(gate, L);
  const w = Math.max(textWidth(gate.label, CHAR_W.edge), gate.sub ? textWidth(gate.sub, CHAR_W.edge) : 0);
  const h = gate.sub ? 30 : 16;
  const mk = (left: number, top: number): Box => ({ left, right: left + w, top, bottom: top + h, cx: 0, cy: 0 });
  if (at === 'above') return { area: mk(b.cx - w / 2, b.top - 4 - h), x: b.cx, y: b.top - 4 - h + 12, anchor: 'middle' };
  if (at === 'below') return { area: mk(b.cx - w / 2, b.bottom + 4), x: b.cx, y: b.bottom + 16, anchor: 'middle' };
  if (at === 'right') return { area: mk(b.right + 6, b.cy - h / 2), x: b.right + 6, y: b.cy - h / 2 + 12, anchor: 'start' };
  return { area: mk(b.left - 6 - w, b.cy - h / 2), x: b.left - 6, y: b.cy - h / 2 + 12, anchor: 'end' };
}

const segCrosses = (d: string, area: Box) => {
  const nums = (d.match(/[MHV][^MHV]*/g) ?? []).map((t) => [t[0], ...t.slice(1).trim().split(/\s+/).map(Number)] as [string, ...number[]]);
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
    if (Math.min(x, nx) < area.right && Math.max(x, nx) > area.left && Math.min(y, ny) < area.bottom && Math.max(y, ny) > area.top) return true;
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
