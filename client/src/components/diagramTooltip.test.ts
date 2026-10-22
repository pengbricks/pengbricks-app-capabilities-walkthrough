import { describe, expect, it } from 'vitest';
import type { FlowDiagram } from '../data/walkthroughs/types.ts';
import { connectionsFor, placeTooltip, viewBoxToContainer } from './diagramTooltip.ts';

const diagram: FlowDiagram = {
  type: 'flow',
  title: 't',
  description: 'd',
  nodes: [
    { id: 'a', label: 'A', col: 0, row: 0 },
    { id: 'b', label: 'B', col: 1, row: 0 },
    { id: 'c', label: 'C', col: 2, row: 0 },
    { id: 'd', label: 'D', col: 3, row: 0 },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'ingest' },
    { from: 'b', to: 'c', label: 'publish', dashed: true },
    { from: 'a', to: 'c' },
  ],
};

describe('connectionsFor', () => {
  it('splits edges into comes-from and goes-to with labels and dashed flags', () => {
    const b = connectionsFor(diagram, 'b');
    expect(b.from.map((c) => [c.node.id, c.label, c.dashed])).toEqual([['a', 'ingest', false]]);
    expect(b.to.map((c) => [c.node.id, c.label, c.dashed])).toEqual([['c', 'publish', true]]);
    expect([...b.nodeIds].sort()).toEqual(['a', 'b', 'c']);
    expect([...b.edgeIndexes].sort()).toEqual([0, 1]);
  });

  it('returns empty lists for an unconnected node', () => {
    const d = connectionsFor(diagram, 'd');
    expect(d.from).toEqual([]);
    expect(d.to).toEqual([]);
    expect([...d.nodeIds]).toEqual(['d']);
  });

  it('keeps edges without a label', () => {
    expect(connectionsFor(diagram, 'a').to.map((c) => c.label)).toEqual(['ingest', undefined]);
  });
});

describe('viewBoxToContainer', () => {
  it('scales viewBox units to rendered pixels and offsets by the SVG position', () => {
    const rect = viewBoxToContainer(
      { left: 100, top: 50, width: 200, height: 60 },
      { width: 1000, height: 500 },
      { left: 30, top: 20, width: 500, height: 250 },
      { left: 10, top: 10 }
    );
    expect(rect).toEqual({ left: 70, top: 35, width: 100, height: 30 });
  });
});

describe('placeTooltip', () => {
  const container = { width: 800, height: 400 };
  const tip = { width: 300, height: 150 };

  it('centers below the anchor when there is room', () => {
    const p = placeTooltip({ left: 300, top: 50, width: 100, height: 60 }, tip, container, 10);
    expect(p.placement).toBe('below');
    expect(p.left).toBe(200);
    expect(p.top).toBe(120);
  });

  it('flips above near the bottom edge', () => {
    const p = placeTooltip({ left: 300, top: 320, width: 100, height: 60 }, tip, container, 10);
    expect(p.placement).toBe('above');
    expect(p.top).toBe(160);
  });

  it('clamps inside the container on both sides', () => {
    const left = placeTooltip({ left: 0, top: 50, width: 60, height: 40 }, tip, container, 10);
    expect(left.left).toBe(8);
    const right = placeTooltip({ left: 760, top: 50, width: 40, height: 40 }, tip, container, 10);
    expect(right.left).toBe(800 - 300 - 8);
  });

  it('moves beside the anchor when the card is too tall for above or below', () => {
    const tall = { width: 300, height: 380 };
    const right = placeTooltip({ left: 100, top: 150, width: 100, height: 60 }, tall, container, 10);
    expect(right.placement).toBe('right');
    expect(right.left).toBe(210);
    const left = placeTooltip({ left: 600, top: 150, width: 100, height: 60 }, tall, container, 10);
    expect(left.placement).toBe('left');
    expect(left.left).toBe(290);
  });

  it('never leaves the container, even when the tooltip is taller than it', () => {
    const p = placeTooltip({ left: 10, top: 10, width: 50, height: 30 }, { width: 900, height: 500 }, container, 10);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.top).toBeGreaterThanOrEqual(8);
  });
});
