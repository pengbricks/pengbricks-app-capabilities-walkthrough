import { describe, expect, it } from 'vitest';
import type { FlowDiagram } from '../data/walkthroughs/types.ts';
import { walkthroughs } from '../data/walkthroughs/index.ts';
import {
  box,
  boxesOverlap,
  laneBorders,
  LANE_CLEAR,
  MIN_PARALLEL,
  parallelTooClose,
  COL_W,
  layoutFor,
  pathSegments,
  planText,
  SIDE,
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
  const cols = Math.max(...diagram.nodes.map((node) => node.col)) + 1;
  const width = L.colX(cols - 1) + COL_W + SIDE;
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
    for (const border of laneBorders(diagram, L)) {
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

  it('keeps edge lines away from lane borders along their length', () => {
    for (const border of laneBorders(diagram, L)) {
      plan.routes.forEach((r, i) => {
        const edge = diagram.edges[i];
        const hit = pathSegments(r.d).some((seg) => parallelTooClose(seg, border, LANE_CLEAR));
        expect(hit, `${edge.from} -> ${edge.to} runs along a lane border`).toBe(false);
      });
    }
  });

  it('keeps parallel edge lines at least 16px apart', () => {
    plan.routes.forEach((r, i) => {
      for (let j = i + 1; j < plan.routes.length; j += 1) {
        const hit = pathSegments(r.d).some((p) =>
          pathSegments(plan.routes[j].d).some((q) => parallelTooClose(p, q, MIN_PARALLEL))
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
