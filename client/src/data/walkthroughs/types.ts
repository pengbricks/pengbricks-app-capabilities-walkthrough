// Data model for visual guide walkthroughs. Each guide's walkthrough is one file in this folder.

export type NodeKind = 'box' | 'highlight' | 'gate' | 'store' | 'surface';

/** Architecture icons from the databricks-architecture design library, served from /diagram-icons/<name>.png. */
export type DiagramIcon =
  | 'checklist'
  | 'cloud-database'
  | 'cloud-network'
  | 'dashboard'
  | 'data-file'
  | 'data-model'
  | 'data-search'
  | 'data-shares'
  | 'database'
  | 'delta-sharing-mark'
  | 'event-stream'
  | 'gear-amber'
  | 'gear-data'
  | 'gear-lava'
  | 'gear-maroon'
  | 'gear-navy'
  | 'gear-slate'
  | 'gear-teal'
  | 'id-provider'
  | 'list'
  | 'media'
  | 'network'
  | 'saas'
  | 'users'
  | 'warehouse'
  | 'workflow';

/** Platform domain, which sets the node's accent color (databricks-architecture domain palette). */
export type DiagramDomain = 'data' | 'governance' | 'ai' | 'orchestration' | 'apps' | 'neutral';

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
  icon?: DiagramIcon;
  domain?: DiagramDomain;
  /** One or two sentences shown on hover or focus: what this step is and why it is there. */
  detail?: string;
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
  /** One or two sentences shown on hover or focus of the lane label: what the stage holds. */
  detail?: string;
};

/** A dashed boundary drawn around part of the grid, such as what one governance system covers. */
export type FlowBoundary = {
  label: string;
  /** Shown on hover or focus of the label or the line. */
  detail: string;
  /** Rows covered, inclusive. */
  fromRow: number;
  toRow: number;
  /** Columns covered, inclusive. Defaults to all. */
  fromCol?: number;
  toCol?: number;
};

export type FlowDiagram = {
  type: 'flow';
  title: string;
  /** Screen-reader description of what the diagram shows. */
  description: string;
  lanes?: FlowLane[];
  boundaries?: FlowBoundary[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  legend?: { kind: NodeKind | 'dashed' | 'line'; label: string }[];
  caption?: string;
};

export type MatrixCell = {
  state: 'own' | 'optional' | 'none';
  text: string;
  sub?: string;
  /** Shown on hover or focus. */
  detail?: string;
};

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
  /**
   * A design choice with more than one valid approach: each option, when it fits, and what it costs
   * (performance, cost, maintenance, governance, accuracy), then the default and why. Tradeoffs that
   * the docs do not state are written as practical guidance.
   */
  options?: {
    caption?: string;
    rows: { option: string; when: string; tradeoffs: string }[];
    recommendation: string;
  };
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
  /** Other guides to finish first, shown under the short version with why each one is needed. */
  prerequisites?: { slug: string; title: string; why: string }[];
  sections: WalkthroughSection[];
  related: { slug: string; title: string }[];
};
