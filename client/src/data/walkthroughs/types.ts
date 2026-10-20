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
  /** Outside reading, such as the official docs page for each topic. Opens in a new tab. */
  links?: { label: string; url: string; note?: string }[];
  /**
   * Short setup examples for options the reference code does not use, such as other Auto Loader
   * schema modes. Real code from the bundle comes from artifacts.json highlights with a matching section.
   */
  examples?: { label: string; language: string; code: string; notes?: string[] }[];
};

export type Walkthrough = {
  /** Guide slug this walkthrough belongs to; the route is /walkthroughs/<slug>. */
  slug: string;
  area: string;
  title: string;
  intro: string;
  /**
   * Why the business should care, shown first: a one- or two-sentence summary and three or four
   * outcomes a sponsor would recognize (cost, risk, speed, who it helps), stated concretely.
   */
  businessValue?: { summary: string; outcomes: { title: string; body: string }[] };
  shortVersion: { title: string; body: string }[];
  sections: WalkthroughSection[];
  related: { slug: string; title: string }[];
};
