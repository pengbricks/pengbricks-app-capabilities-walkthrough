import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { guides } from '../guides.ts';
import { walkthroughs } from './index.ts';

const ICON_DIR = fileURLToPath(new URL('../../../public/diagram-icons/', import.meta.url));
const MAX_DETAIL = 240;
const MAX_LABEL = 24;
const MAX_SUB = 26;

describe.each(walkthroughs.map((walkthrough) => [walkthrough.slug, walkthrough] as const))('%s', (_, walkthrough) => {
  it('belongs to a guide and links to real guides', () => {
    const slugs = new Set(guides.map((guide) => guide.slug));
    expect(slugs.has(walkthrough.slug)).toBe(true);
    for (const related of walkthrough.related) expect(slugs.has(related.slug)).toBe(true);
    for (const item of walkthrough.prerequisites ?? []) expect(slugs.has(item.slug), item.slug).toBe(true);
  });

  it('leads with a business value summary and three or four outcomes', () => {
    const value = walkthrough.businessValue;
    expect(value, 'businessValue').toBeDefined();
    const words = (text: string) => text.trim().split(/\s+/).length;
    expect(words(value!.summary)).toBeLessThanOrEqual(50);
    expect(value!.outcomes.length).toBeGreaterThanOrEqual(3);
    expect(value!.outcomes.length).toBeLessThanOrEqual(4);
    for (const outcome of value!.outcomes) {
      expect(words(outcome.title), outcome.title).toBeLessThanOrEqual(7);
      expect(words(outcome.body), outcome.title).toBeLessThanOrEqual(45);
    }
  });

  it('has unique section ids and a short version', () => {
    const ids = walkthrough.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(walkthrough.shortVersion.length).toBeGreaterThanOrEqual(3);
  });

  it('gives every options table at least two choices and a default', () => {
    for (const section of walkthrough.sections) {
      if (!section.options) continue;
      expect(section.options.rows.length, section.id).toBeGreaterThanOrEqual(2);
      expect(section.options.recommendation.trim().length, section.id).toBeGreaterThan(0);
      for (const row of section.options.rows) {
        expect(row.option && row.when && row.tradeoffs, `${section.id}: ${row.option}`).toBeTruthy();
      }
    }
  });

  it('links only to https pages', () => {
    for (const section of walkthrough.sections) {
      for (const link of section.links ?? []) expect(link.url, `${section.id}: ${link.label}`).toMatch(/^https:\/\//);
    }
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

  it('names real icon files and keeps hover details short', () => {
    for (const section of walkthrough.sections) {
      const diagram = section.diagram;
      if (!diagram) continue;
      if (diagram.type === 'flow') {
        for (const node of diagram.nodes) {
          if (node.icon)
            expect(existsSync(`${ICON_DIR}${node.icon}.png`), `${section.id}: ${node.id} icon ${node.icon}`).toBe(true);
          if (node.detail)
            expect(node.detail.length, `${section.id}: ${node.id} detail`).toBeLessThanOrEqual(MAX_DETAIL);
        }
      } else {
        for (const row of diagram.rows) {
          for (const cell of row.cells) {
            if (cell.detail)
              expect(cell.detail.length, `${section.id}: ${row.label} detail`).toBeLessThanOrEqual(MAX_DETAIL);
          }
        }
      }
    }
  });

  it('has valid boundaries and short lane and boundary details', () => {
    for (const section of walkthrough.sections) {
      const diagram = section.diagram;
      if (diagram?.type !== 'flow') continue;
      const rows = Math.max(...diagram.nodes.map((node) => node.row));
      const cols = Math.max(...diagram.nodes.map((node) => node.col));
      for (const lane of diagram.lanes ?? []) {
        if (lane.detail)
          expect(lane.detail.length, `${section.id}: lane ${lane.label}`).toBeLessThanOrEqual(MAX_DETAIL);
      }
      for (const b of diagram.boundaries ?? []) {
        expect(b.detail.trim().length, `${section.id}: boundary ${b.label} detail`).toBeGreaterThan(0);
        expect(b.detail.length, `${section.id}: boundary ${b.label}`).toBeLessThanOrEqual(MAX_DETAIL);
        expect(
          b.fromRow >= 0 && b.fromRow <= b.toRow && b.toRow <= rows,
          `${section.id}: boundary ${b.label} rows`
        ).toBe(true);
        const [fc, tc] = [b.fromCol ?? 0, b.toCol ?? cols];
        expect(fc >= 0 && fc <= tc && tc <= cols, `${section.id}: boundary ${b.label} columns`).toBe(true);
        expect(
          diagram.nodes.some((n) => n.row >= b.fromRow && n.row <= b.toRow && n.col >= fc && n.col <= tc),
          `${section.id}: boundary ${b.label} is empty`
        ).toBe(true);
      }
    }
  });

  it('gives every flow-diagram node a hover detail', () => {
    for (const section of walkthrough.sections) {
      const diagram = section.diagram;
      if (diagram?.type !== 'flow') continue;
      for (const node of diagram.nodes) {
        expect(node.detail?.trim(), `${section.id}: ${node.id} has no detail`).toBeTruthy();
      }
    }
  });
});
