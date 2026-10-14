// Data model for visual guide walkthroughs. Each guide's walkthrough is one file in this folder.

export type NodeKind = 'box' | 'highlight' | 'gate' | 'store' | 'surface';

export type FlowNode = {
  id: string;
  label: string;
  /** Second line, e.g. a command, table name, or role. */
  sub?: string;
  /** Monospace label, for code, table, or file names. */
  mono?: boolean;
  /** Zero-based grid position. */
  col: number;
  row: number;
  kind?: NodeKind;
};

export type FlowEdge = {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
};

export type FlowLane = {
  label: string;
  /** Rows covered by the lane, inclusive. */
  fromRow: number;
  toRow: number;
};

export type FlowDiagram = {
  type: 'flow';
  title: string;
  /** Screen-reader description of what the diagram shows. */
  description: string;
  lanes?: FlowLane[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  legend?: { kind: NodeKind | 'dashed' | 'line'; label: string }[];
  caption?: string;
};

export type MatrixCell = { state: 'own' | 'optional' | 'none'; text: string; sub?: string };

export type MatrixDiagram = {
  type: 'matrix';
  title: string;
  description: string;
  corner: string;
  columns: string[];
  rows: { label: string; sub?: string; cells: MatrixCell[] }[];
  legend?: { state: MatrixCell['state']; label: string }[];
  caption?: string;
};

export type Diagram = FlowDiagram | MatrixDiagram;

export type WalkthroughSection = {
  id: string;
  heading: string;
  prose?: string;
  diagram?: Diagram;
  table?: { caption?: string; columns: [string, string]; rows: [string, string][] };
  steps?: { title: string; body: string; code?: string }[];
  points?: { strong: string; text: string }[];
};

export type Walkthrough = {
  /** Guide slug this walkthrough belongs to; the route is /walkthroughs/<slug>. */
  slug: string;
  area: string;
  title: string;
  intro: string;
  shortVersion: { title: string; body: string }[];
  sections: WalkthroughSection[];
  related: { slug: string; title: string }[];
};
