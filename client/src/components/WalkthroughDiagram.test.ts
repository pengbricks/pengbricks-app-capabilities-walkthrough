import { describe, expect, it } from 'vitest';
import type { FlowDiagram } from '../data/walkthroughs/types.ts';
import { walkthroughs } from '../data/walkthroughs/index.ts';
import { box, CHAR_W, gateLabelArea, layoutFor, placeGateLabel, route, textWidth, type Box } from './diagramLayout.ts';

type Seg = { x1: number; y1: number; x2: number; y2: number };

// Turns an orthogonal path ("M x y H x V y ...") into segments.
function segments(d: string): Seg[] {
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

const inset = (b: Box, by: number): Box => ({
  ...b,
  left: b.left + by,
  right: b.right - by,
  top: b.top + by,
  bottom: b.bottom - by,
});

function crosses(s: Seg, b: Box): boolean {
  const [xa, xb] = [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)];
  const [ya, yb] = [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)];
  return xa < b.right && xb > b.left && ya < b.bottom && yb > b.top;
}

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const flows: [string, string, FlowDiagram][] = walkthroughs.flatMap((walkthrough) =>
  walkthrough.sections.flatMap((section) =>
    section.diagram?.type === 'flow'
      ? [[walkthrough.slug, section.id, section.diagram] as [string, string, FlowDiagram]]
      : []
  )
);

describe.each(flows)('%s / %s diagram', (_slug, _section, diagram) => {
  const L = layoutFor(diagram);
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  const occupied = new Set(diagram.nodes.map((node) => `${node.col},${node.row}`));

  it('routes no edge through a node other than its ends', () => {
    for (const edge of diagram.edges) {
      const from = byId.get(edge.from)!;
      const to = byId.get(edge.to)!;
      const { d } = route(from, to, L, occupied);
      for (const node of diagram.nodes) {
        if (node.id === edge.from || node.id === edge.to) continue;
        const hit = segments(d).some((seg) => crosses(seg, inset(box(node, L), 1)));
        expect(hit, `${edge.from} -> ${edge.to} crosses ${node.id}`).toBe(false);
      }
    }
  });

  it('keeps edge labels off every node', () => {
    for (const edge of diagram.edges) {
      if (!edge.label) continue;
      const { label, anchor = 'middle' } = route(byId.get(edge.from)!, byId.get(edge.to)!, L, occupied);
      const w = textWidth(edge.label, CHAR_W.edge);
      const left = anchor === 'start' ? label[0] : anchor === 'end' ? label[0] - w : label[0] - w / 2;
      const area: Box = { left, right: left + w, top: label[1] - 10, bottom: label[1] + 3, cx: 0, cy: 0 };
      for (const node of diagram.nodes) {
        expect(overlaps(area, box(node, L)), `label "${edge.label}" overlaps ${node.id}`).toBe(false);
      }
    }
  });

  it('runs no edge through a gate label', () => {
    const paths = diagram.edges.map((edge) => route(byId.get(edge.from)!, byId.get(edge.to)!, L, occupied).d);
    for (const gate of diagram.nodes.filter((node) => node.kind === 'gate')) {
      const { area } = gateLabelArea(gate, L, placeGateLabel(gate, L, paths));
      for (const [i, d] of paths.entries()) {
        const edge = diagram.edges[i];
        expect(
          segments(d).some((seg) => crosses(seg, area)),
          `${edge.from} -> ${edge.to} runs through the label of ${gate.id}`
        ).toBe(false);
      }
      for (const node of diagram.nodes) {
        if (node.id === gate.id) continue;
        expect(overlaps(area, box(node, L)), `label of ${gate.id} overlaps ${node.id}`).toBe(false);
      }
    }
  });
});
