import type { FlowDiagram, FlowEdge, FlowNode } from '../data/walkthroughs/types.ts';

// Pure helpers for the diagram hover/focus tooltip: which edges touch a node, and where the card goes.

export type Connection = {
  /** The node on the other end of the edge. */
  node: FlowNode;
  /** Edge label, if the edge has one. */
  label?: string;
  /** Dashed edges are optional or asynchronous. */
  dashed: boolean;
};

export type NodeConnections = {
  from: Connection[];
  to: Connection[];
  /** Ids of the node and everything it connects to. */
  nodeIds: Set<string>;
  /** Indexes into diagram.edges of the edges that touch the node. */
  edgeIndexes: Set<number>;
};

export function connectionsFor(diagram: FlowDiagram, nodeId: string): NodeConnections {
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  const result: NodeConnections = { from: [], to: [], nodeIds: new Set([nodeId]), edgeIndexes: new Set() };
  diagram.edges.forEach((edge: FlowEdge, index) => {
    const incoming = edge.to === nodeId;
    const outgoing = edge.from === nodeId;
    if (!incoming && !outgoing) return;
    const other = byId.get(incoming ? edge.from : edge.to);
    if (!other) return;
    result.edgeIndexes.add(index);
    result.nodeIds.add(other.id);
    const connection = { node: other, label: edge.label, dashed: Boolean(edge.dashed) };
    // A self-loop counts in both lists.
    if (incoming) result.from.push(connection);
    if (outgoing) result.to.push(connection);
  });
  return result;
}

/** Plain-words suffix for a connection, e.g. "optional, async". */
export function connectionNote(connection: Connection): string {
  return connection.dashed ? 'optional or async' : '';
}

export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

/** Maps a rectangle in SVG viewBox units to pixels inside the container that holds the SVG. */
export function viewBoxToContainer(
  rect: Rect,
  viewBox: Size,
  svgPixels: Rect,
  containerOrigin: { left: number; top: number }
): Rect {
  const scale = viewBox.width > 0 ? svgPixels.width / viewBox.width : 1;
  return {
    left: svgPixels.left - containerOrigin.left + rect.left * scale,
    top: svgPixels.top - containerOrigin.top + rect.top * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/**
 * Places a tooltip box next to an anchor and keeps it inside the container.
 * Prefers below the anchor, then above, then beside it when the card is too tall for either, so it
 * never covers the anchor unless the container is smaller than the card. Always clamped to the container.
 */
export function placeTooltip(
  anchor: Rect,
  tooltip: Size,
  container: Size,
  gap = 12,
  margin = 8
): { left: number; top: number; placement: 'below' | 'above' | 'right' | 'left' } {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
  const clampLeft = (v: number) => clamp(v, margin, container.width - tooltip.width - margin);
  const clampTop = (v: number) => clamp(v, margin, container.height - tooltip.height - margin);
  const centeredLeft = anchor.left + anchor.width / 2 - tooltip.width / 2;
  const centeredTop = anchor.top + anchor.height / 2 - tooltip.height / 2;
  const spaceBelow = container.height - (anchor.top + anchor.height) - margin;
  const spaceAbove = anchor.top - margin;
  const need = tooltip.height + gap;
  if (spaceBelow >= need)
    return { left: clampLeft(centeredLeft), top: clampTop(anchor.top + anchor.height + gap), placement: 'below' };
  if (spaceAbove >= need)
    return { left: clampLeft(centeredLeft), top: clampTop(anchor.top - gap - tooltip.height), placement: 'above' };
  const spaceRight = container.width - (anchor.left + anchor.width) - margin;
  const spaceLeft = anchor.left - margin;
  const needSide = tooltip.width + gap;
  if (spaceRight >= needSide || spaceRight >= spaceLeft) {
    return { left: clampLeft(anchor.left + anchor.width + gap), top: clampTop(centeredTop), placement: 'right' };
  }
  return { left: clampLeft(anchor.left - gap - tooltip.width), top: clampTop(centeredTop), placement: 'left' };
}
