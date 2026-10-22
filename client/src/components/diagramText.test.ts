import { describe, expect, it } from 'vitest';
import type { FlowDiagram } from '../data/walkthroughs/types.ts';
import { walkthroughs } from '../data/walkthroughs/index.ts';
import {
  box,
  boxesOverlap,
  laneBorders,
  LANE_CLEAR,
  MIN_PARALLEL,
  MIN_PARALLEL_DENSE,
  parallelTooClose,
  boundaryBorders,
  boundaryRect,
  diagramWidth,
  layoutFor,
  pathSegments,
  planText,
  segHitsBox,
  wrapText,
  type Box,
} from './diagramLayout.ts';

const flows: [string, string, FlowDiagram][] = walkthroughs.flatMap((walkthrough) =>
  walkthrough.sections.flatMap((section) =>
    section.diagram?.type === 'flow'
      ? [[walkthrough.slug, section.id, section.diagram] as [string, string, FlowDiagram]]
      : []
  )
);

// Text never sits on a line or on other text: every label gets its own clear box.
describe.each(flows)('%s / %s text clearance', (_slug, _section, diagram) => {
  const L = layoutFor(diagram);
  const width = diagramWidth(diagram, L);
  const plan = planText(diagram, L, width);
  const segs = plan.routes.flatMap((r, i) => pathSegments(r.d).map((seg) => ({ seg, edge: diagram.edges[i] })));
  const labels: { name: string; box: Box }[] = [];
  diagram.edges.forEach((edge, i) => {
    const placed = plan.edgeLabels[i];
    if (edge.label && placed) labels.push({ name: `edge label "${edge.label}"`, box: placed.box });
  });
  for (const gate of diagram.nodes.filter((node) => node.kind === 'gate')) {
    labels.push({ name: `gate label "${gate.label}"`, box: plan.gateAreas.get(gate.id)!.area });
  }
  (diagram.lanes ?? []).forEach((lane, i) =>
    labels.push({ name: `lane label "${lane.label}"`, box: plan.laneBoxes[i] })
  );

  it('keeps every edge line out of every label', () => {
    for (const { name, box: b } of labels) {
      for (const { seg, edge } of segs) {
        expect(segHitsBox(seg, b), `${edge.from} -> ${edge.to} runs through ${name}`).toBe(false);
      }
    }
  });

  it('keeps labels off each other and off node cards', () => {
    labels.forEach((a, i) => {
      for (const b of labels.slice(i + 1))
        expect(boxesOverlap(a.box, b.box), `${a.name} overlaps ${b.name}`).toBe(false);
      for (const node of diagram.nodes)
        expect(boxesOverlap(a.box, box(node, L)), `${a.name} overlaps node ${node.id}`).toBe(false);
    });
  });

  it('keeps edge and gate labels off lane borders', () => {
    for (const border of [...laneBorders(diagram, L), ...boundaryBorders(diagram, L)]) {
      const thin = {
        left: Math.min(border.x1, border.x2),
        right: Math.max(border.x1, border.x2),
        top: Math.min(border.y1, border.y2),
        bottom: Math.max(border.y1, border.y2),
        cx: 0,
        cy: 0,
      };
      for (const { name, box: b } of labels)
        expect(boxesOverlap(b, thin) || segHitsBox(border, b), `${name} sits on a lane border`).toBe(false);
    }
  });

  it('keeps edge lines away from lane and boundary borders along their length', () => {
    for (const border of [...laneBorders(diagram, L), ...boundaryBorders(diagram, L)]) {
      plan.routes.forEach((r, i) => {
        const edge = diagram.edges[i];
        const hit = pathSegments(r.d).some((seg) => parallelTooClose(seg, border, LANE_CLEAR));
        expect(hit, `${edge.from} -> ${edge.to} runs along a lane border`).toBe(false);
      });
    }
  });

  it('draws boundaries around whole nodes, with their label clear of nodes and edges', () => {
    for (const [i, boundary] of (diagram.boundaries ?? []).entries()) {
      const rect = boundaryRect(boundary, L, width);
      const lines = boundaryBorders(diagram, L).slice(i * 4, i * 4 + 4);
      for (const node of diagram.nodes) {
        const b = box(node, L);
        expect(
          lines.some((line) => segHitsBox(line, b)),
          `boundary "${boundary.label}" cuts through ${node.id}`
        ).toBe(false);
        const inside = b.left >= rect.left && b.right <= rect.right && b.top >= rect.top && b.bottom <= rect.bottom;
        const rowsIn = node.row >= boundary.fromRow && node.row <= boundary.toRow;
        const colsIn = node.col >= (boundary.fromCol ?? 0) && node.col <= (boundary.toCol ?? Infinity);
        expect(
          inside,
          `${node.id} should be ${rowsIn && colsIn ? 'inside' : 'outside'} boundary "${boundary.label}"`
        ).toBe(rowsIn && colsIn);
      }
    }
  });

  it('keeps parallel edge lines at least 16px apart (10px where a node has four or more edges)', () => {
    const crowded = diagram.nodes.some(
      (n) =>
        diagram.edges.filter((e) => e.from === n.id).length >= 4 ||
        diagram.edges.filter((e) => e.to === n.id).length >= 4
    );
    const min = crowded ? MIN_PARALLEL_DENSE : MIN_PARALLEL;
    plan.routes.forEach((r, i) => {
      for (let j = i + 1; j < plan.routes.length; j += 1) {
        const hit = pathSegments(r.d).some((p) =>
          pathSegments(plan.routes[j].d).some((q) => parallelTooClose(p, q, min))
        );
        const [a, b] = [diagram.edges[i], diagram.edges[j]];
        expect(hit, `${a.from} -> ${a.to} runs too close to ${b.from} -> ${b.to}`).toBe(false);
      }
    });
  });

  it('keeps every routed edge out of nodes other than its ends', () => {
    plan.routes.forEach((r, i) => {
      const edge = diagram.edges[i];
      for (const node of diagram.nodes) {
        if (node.id === edge.from || node.id === edge.to) continue;
        const b = box(node, L);
        const inner = { ...b, left: b.left + 1, right: b.right - 1, top: b.top + 1, bottom: b.bottom - 1 };
        expect(
          pathSegments(r.d).some((seg) => segHitsBox(seg, inner)),
          `${edge.from} -> ${edge.to} crosses ${node.id}`
        ).toBe(false);
      }
    });
  });
});

describe('wrapText', () => {
  it('keeps short text on one line and splits long text into two balanced lines', () => {
    expect(wrapText('Read', 8, 100)).toEqual(['Read']);
    expect(wrapText('One per environment and domain', 8, 150)).toEqual(['One per environment', 'and domain']);
    expect(wrapText('averyveryverylongsingleword', 8, 50)).toEqual(['averyveryverylongsingleword']);
  });
});
