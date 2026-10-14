import { describe, expect, it } from 'vitest';
import { guides } from '../guides.ts';
import { walkthroughs } from './index.ts';

const MAX_LABEL = 24;
const MAX_SUB = 26;

describe.each(walkthroughs.map((walkthrough) => [walkthrough.slug, walkthrough] as const))('%s', (_, walkthrough) => {
  it('belongs to a guide and links to real guides', () => {
    const slugs = new Set(guides.map((guide) => guide.slug));
    expect(slugs.has(walkthrough.slug)).toBe(true);
    for (const related of walkthrough.related) expect(slugs.has(related.slug)).toBe(true);
  });

  it('has unique section ids and a short version', () => {
    const ids = walkthrough.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(walkthrough.shortVersion.length).toBeGreaterThanOrEqual(3);
  });

  it('draws diagrams whose edges, grid cells, and labels are valid', () => {
    for (const section of walkthrough.sections) {
      const diagram = section.diagram;
      if (!diagram) continue;
      if (diagram.type === 'matrix') {
        for (const row of diagram.rows) expect(row.cells).toHaveLength(diagram.columns.length);
        continue;
      }
      const ids = new Set(diagram.nodes.map((node) => node.id));
      expect(ids.size).toBe(diagram.nodes.length);
      for (const edge of diagram.edges) {
        expect(ids.has(edge.from), `${section.id}: ${edge.from}`).toBe(true);
        expect(ids.has(edge.to), `${section.id}: ${edge.to}`).toBe(true);
      }
      const cells = diagram.nodes.map((node) => `${node.col},${node.row}`);
      expect(new Set(cells).size, `${section.id}: overlapping nodes`).toBe(cells.length);
      for (const node of diagram.nodes) {
        expect(node.label.length, `${section.id}: ${node.label}`).toBeLessThanOrEqual(MAX_LABEL);
        if (node.sub) expect(node.sub.length, `${section.id}: ${node.sub}`).toBeLessThanOrEqual(MAX_SUB);
      }
    }
  });
});
