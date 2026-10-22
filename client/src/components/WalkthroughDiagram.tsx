import { createPortal } from 'react-dom';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { DiagramDomain, FlowDiagram, FlowNode, MatrixCell, MatrixDiagram } from '../data/walkthroughs/types.ts';
import { connectionsFor, placeTooltip, viewBoxToContainer, type Connection, type Rect } from './diagramTooltip.ts';
import {
  box,
  CHAR_W,
  COL_W,
  BOTTOM,
  GATE,
  gateLabelArea,
  laneRect,
  layoutFor,
  PAD,
  planText,
  ROW_H,
  SIDE,
  textWidth,
  wrapText,
  type GatePlacement,
  type Layout,
} from './diagramLayout.ts';

// Text that would overflow its node is condensed to fit rather than spilling over the outline.
function fit(text: string, perChar: number, max: number) {
  return textWidth(text, perChar) > max ? { textLength: max, lengthAdjust: 'spacingAndGlyphs' as const } : {};
}

const DOMAIN_COLOR: Record<DiagramDomain, string> = {
  data: '#1B5162',
  governance: '#00A972',
  ai: '#98102A',
  orchestration: '#FFAB00',
  apps: '#4359FF',
  neutral: '#618794',
};
const DOMAIN_NAME: Record<DiagramDomain, string> = {
  data: 'Data',
  governance: 'Governance',
  ai: 'AI',
  orchestration: 'Orchestration',
  apps: 'Apps',
  neutral: 'Supporting',
};
const STATE_NAME: Record<MatrixCell['state'], string> = { own: 'Owns it', optional: 'Optional', none: 'Not involved' };

const ACCENT = 4;
const ICON_SIZE = 28;
const TEXT_X = 56; // text starts this far from the card's left edge when the node has an icon
const RADIUS = 10;
const iconSrc = (name: string) => `${import.meta.env.BASE_URL}diagram-icons/${name}.png`;

function cardPath(b: { left: number; top: number }, kind: FlowNode['kind']) {
  if (kind === 'store') {
    return `M${b.left} ${b.top + 8}h64l8 -8h${COL_W - 80}a8 8 0 0 1 8 8v${ROW_H - 16}a8 8 0 0 1-8 8H${b.left + 8}a8 8 0 0 1-8-8z`;
  }
  const r = RADIUS;
  return `M${b.left + r} ${b.top}h${COL_W - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${ROW_H - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${COL_W - 2 * r}a${r} ${r} 0 0 1-${r}-${r}v-${ROW_H - 2 * r}a${r} ${r} 0 0 1 ${r}-${r}z`;
}

type Bind = {
  tabIndex: 0;
  'data-d-node': '';
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  'aria-describedby'?: string;
};

function Ring({
  x,
  y,
  w,
  h,
  r,
  diamond,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  diamond?: boolean;
}) {
  const pad = 4;
  const a = w / 2 + pad;
  const d = diamond ? `M${x + w / 2} ${y - pad}l${a} ${a}-${a} ${a}-${a}-${a}z` : undefined;
  return (
    <g className="d-ring" aria-hidden="true">
      {diamond ? (
        <>
          <path className="d-ring-halo" d={d} />
          <path className="d-ring-line" d={d} />
        </>
      ) : (
        <>
          <rect className="d-ring-halo" x={x - pad} y={y - pad} width={w + 2 * pad} height={h + 2 * pad} rx={r + pad} />
          <rect className="d-ring-line" x={x - pad} y={y - pad} width={w + 2 * pad} height={h + 2 * pad} rx={r + pad} />
        </>
      )}
    </g>
  );
}

function NodeShape({
  node,
  L,
  placement,
  bind,
  state,
  clipId,
}: {
  node: FlowNode;
  L: Layout;
  placement?: GatePlacement;
  bind: Bind;
  state: '' | 'is-on' | 'is-dim';
  clipId: string;
}) {
  const b = box(node, L);
  const aria = node.sub ? `${node.label}, ${node.sub}` : node.label;
  if (node.kind === 'gate') {
    const at = gateLabelArea(node, L, placement ?? 'above');
    const d = `M${b.cx} ${b.top}l${GATE} ${GATE}-${GATE} ${GATE}-${GATE}-${GATE}z`;
    return (
      <g className={`d-node ${state}`} role="group" aria-label={aria} {...bind}>
        <Ring x={b.left} y={b.top} w={GATE * 2} h={GATE * 2} r={0} diamond />
        <path className="d-gate" d={d} />
        <text className="t-m t-halo" textAnchor={at.anchor} x={at.x} y={at.y}>
          {node.label}
        </text>
        {node.sub && (
          <text className="t-m t-halo" textAnchor={at.anchor} x={at.x} y={at.y + 14}>
            {node.sub}
          </text>
        )}
      </g>
    );
  }
  const highlight = node.kind === 'highlight';
  const shapeClass = highlight ? 'd-box d-prod' : node.kind === 'surface' ? 'd-surface-box' : 'd-box';
  const accent = DOMAIN_COLOR[node.domain ?? 'neutral'];
  const hasIcon = Boolean(node.icon);
  const tx = hasIcon ? b.left + TEXT_X : b.cx + ACCENT / 2;
  const inner = hasIcon ? COL_W - TEXT_X - 14 : COL_W - PAD * 2 - ACCENT;
  const anchorClass = hasIcon ? '' : ' t-c';
  const labelY = node.sub ? b.cy - 4 : b.cy + 5;
  const labelClass = `${highlight ? 't-inv' : 't t-strong'}${node.mono ? ' t-mono' : ''}${anchorClass}`;
  const subClass = `${highlight ? 't-inv-m' : 't-m t-sub'}${anchorClass}`;
  const d = cardPath(b, node.kind);
  return (
    <g className={`d-node ${state}`} role="group" aria-label={aria} {...bind}>
      <Ring x={b.left} y={b.top} w={COL_W} h={ROW_H} r={RADIUS} />
      <path className={shapeClass} d={d} />
      {!highlight && (
        <>
          <clipPath id={clipId}>
            <path d={d} />
          </clipPath>
          <rect x={b.left} y={b.top} width={ACCENT} height={ROW_H} fill={accent} clipPath={`url(#${clipId})`} />
        </>
      )}
      {node.icon && highlight && (
        <rect className="d-icon-chip" x={b.left + 10} y={b.cy - 19} width={38} height={38} rx={8} />
      )}
      {node.icon && (
        <image
          href={iconSrc(node.icon)}
          x={b.left + (highlight ? 15 : 16)}
          y={b.cy - ICON_SIZE / 2}
          width={ICON_SIZE}
          height={ICON_SIZE}
          aria-hidden="true"
        />
      )}
      <text
        className={labelClass}
        x={tx}
        y={labelY}
        {...fit(node.label, node.mono ? CHAR_W.labelMono : CHAR_W.label, inner)}
      >
        {node.label}
      </text>
      {node.sub && (
        <text className={subClass} x={tx} y={b.cy + 16} {...fit(node.sub, CHAR_W.sub, inner)}>
          {node.sub}
        </text>
      )}
    </g>
  );
}

// ---- Tooltip plumbing ----

type Tip = { id: string; anchor: Rect; card: ReactNode };

/** Tracks which item is hovered or focused, and closes on Escape or a tap elsewhere. */
function useActive() {
  const uid = useId();
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const active = hover ?? focus;
  const tipId = `${uid}-tip`;
  const bind = useCallback(
    (id: string): Bind => ({
      tabIndex: 0,
      'data-d-node': '',
      onPointerEnter: () => setHover(id),
      onPointerLeave: () => setHover((cur) => (cur === id ? null : cur)),
      onFocus: () => setFocus(id),
      onBlur: () => setFocus((cur) => (cur === id ? null : cur)),
      'aria-describedby': active === id ? tipId : undefined,
    }),
    [active, tipId]
  );
  const close = useCallback(() => {
    setHover(null);
    setFocus(null);
  }, []);
  useEffect(() => {
    if (!active) return;
    const onDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-d-node]')) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [active, close]);
  return { active, bind, close, tipId };
}

function Stage({
  minWidth,
  viewBox,
  tip,
  tipId,
  onEscape,
  children,
}: {
  minWidth: number;
  viewBox: { width: number; height: number };
  tip: Tip | null;
  tipId: string;
  onEscape: () => void;
  children: (svgRef: React.RefObject<SVGSVGElement | null>) => ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  // The card lives in the enclosing <figure>, so the scroll box cannot clip it and fullscreen still shows it.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    stage.current = el;
    setHost(el?.closest('figure') ?? null);
  }, []);
  const svg = useRef<SVGSVGElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ id: string; left: number; top: number } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onResize = () => setTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    if (!tip || !host || !svg.current || !card.current) return;
    const s = host.getBoundingClientRect();
    const v = svg.current.getBoundingClientRect();
    const anchor = viewBoxToContainer(
      tip.anchor,
      viewBox,
      { left: v.left, top: v.top, width: v.width, height: v.height },
      s
    );
    const placed = placeTooltip(
      anchor,
      { width: card.current.offsetWidth, height: card.current.offsetHeight },
      { width: s.width, height: s.height }
    );
    setPos((prev) =>
      prev && prev.id === tip.id && prev.left === placed.left && prev.top === placed.top
        ? prev
        : { id: tip.id, left: placed.left, top: placed.top }
    );
  }, [tip, host, viewBox, tick]);

  return (
    <div
      ref={stageRef}
      className="d-stage"
      style={{ minWidth }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && tip) onEscape();
      }}
    >
      {children(svg)}
      {tip &&
        host &&
        createPortal(
          <div
            ref={card}
            id={tipId}
            role="tooltip"
            className="d-tip"
            style={
              pos && pos.id === tip.id ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }
            }
          >
            {tip.card}
          </div>,
          host
        )}
    </div>
  );
}

function ConnectionList({ title, items }: { title: string; items: Connection[] }) {
  if (items.length === 0) return null;
  return (
    <div className="d-tip-group">
      <p className="d-tip-eyebrow">{title}</p>
      <ul>
        {items.map((item) => (
          <li key={`${item.node.id}-${item.label ?? ''}-${item.dashed}`}>
            <span className="d-tip-node">{item.node.label}</span>
            {item.label && <span className="d-tip-edge">{item.label}</span>}
            {item.dashed && <span className="d-tip-flag">optional, async</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowCard({ node, diagram }: { node: FlowNode; diagram: FlowDiagram }) {
  const { from, to } = connectionsFor(diagram, node.id);
  const domain = node.domain ?? 'neutral';
  return (
    <>
      <p className="d-tip-eyebrow">
        <span className="d-tip-dot" style={{ background: DOMAIN_COLOR[domain] }} />
        {DOMAIN_NAME[domain]}
        {node.kind === 'gate' && ' · Approval gate'}
      </p>
      <p className="d-tip-title">{node.label}</p>
      {node.sub && <p className="d-tip-sub">{node.sub}</p>}
      {node.detail && <p className="d-tip-body">{node.detail}</p>}
      <ConnectionList title="Comes from" items={from} />
      <ConnectionList title="Goes to" items={to} />
    </>
  );
}

export function FlowDiagramView({ diagram, id }: { diagram: FlowDiagram; id: string }) {
  const L = layoutFor(diagram);
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const cols = Math.max(...diagram.nodes.map((node) => node.col)) + 1;
  const rows = Math.max(...diagram.nodes.map((node) => node.row)) + 1;
  const width = L.colX(cols - 1) + COL_W + SIDE;
  const height = L.rowY(rows - 1) + ROW_H + BOTTOM;
  const marker = `${id}-arrow`;
  const markerDash = `${id}-arrow-dash`;
  const plan = planText(diagram, L, width);
  const { active, bind, close, tipId } = useActive();
  const links = active ? connectionsFor(diagram, active) : null;
  const activeNode = active ? nodes.get(active) : undefined;
  const tip: Tip | null = activeNode
    ? (() => {
        const b = box(activeNode, L);
        return {
          id: activeNode.id,
          anchor: { left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top },
          card: <FlowCard node={activeNode} diagram={diagram} />,
        };
      })()
    : null;
  const edgeState = (index: number) => (links ? (links.edgeIndexes.has(index) ? 'is-on' : 'is-dim') : '');
  const nodeState = (nodeId: string) => (links ? (links.nodeIds.has(nodeId) ? 'is-on' : 'is-dim') : '');
  const minWidth = Math.min(width, 980);

  return (
    <Stage minWidth={minWidth} viewBox={{ width, height }} tip={tip} tipId={tipId} onEscape={close}>
      {(svgRef) => (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className={`d-svg${links ? ' has-active' : ''}`}
          style={{ minWidth }}
          role="group"
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title id={`${id}-title`}>{diagram.title}</title>
          <desc id={`${id}-desc`}>{diagram.description}</desc>
          <defs>
            <marker
              id={marker}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="11"
              markerHeight="11"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path className="d-arrowhead" d="M0 0L10 5L0 10z" />
            </marker>
            <marker
              id={markerDash}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="11"
              markerHeight="11"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path className="d-arrowhead-muted" d="M0 0L10 5L0 10z" />
            </marker>
          </defs>
          {diagram.lanes?.map((lane) => {
            const r = laneRect(lane, L, width);
            return (
              <rect
                key={lane.label}
                className="d-lane"
                x={r.left}
                y={r.top}
                width={r.right - r.left}
                height={r.bottom - r.top}
                rx={10}
              />
            );
          })}
          {diagram.edges.map((edge, index) => {
            const { d } = plan.routes[index];
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                className={`${edge.dashed ? 'd-dash' : 'd-line'} ${edgeState(index)}`}
                d={d}
                markerEnd={`url(#${edge.dashed ? markerDash : marker})`}
              />
            );
          })}
          {diagram.nodes.map((node) => (
            <NodeShape
              key={node.id}
              node={node}
              L={L}
              placement={plan.gateAreas.get(node.id)?.placement}
              bind={bind(node.id)}
              state={nodeState(node.id)}
              clipId={`${id}-clip-${node.id}`}
            />
          ))}
          {/* Labels go last, with a halo, so no line runs through their text. */}
          {diagram.lanes?.map((lane, i) => (
            <g key={`${lane.label}-label`}>
              <text className="t-label t-halo-lane" x={plan.laneX[i]} y={L.rowY(lane.fromRow) - 20}>
                {lane.label.toUpperCase()}
              </text>
              <rect className="d-rule" x={plan.laneX[i]} y={L.rowY(lane.fromRow) - 13} width={28} height={3} rx={1.5} />
            </g>
          ))}
          {diagram.edges.map((edge, index) => {
            const placed = plan.edgeLabels[index];
            if (!edge.label || !placed) return null;
            return (
              <text
                key={`${edge.from}-${edge.to}-label`}
                className={`t-edge t-halo ${edgeState(index)}`}
                textAnchor={placed.anchor}
                x={placed.x}
                y={placed.y}
              >
                {edge.label}
              </text>
            );
          })}
        </svg>
      )}
    </Stage>
  );
}

const M_LABEL_W = 250;
const M_LABEL_TEXT_W = M_LABEL_W - 16 - 16; // x offset 16, and a 16px gap before the first cell
const M_COL_W = 196;
const M_PAD = 12;
const M_MIN_H = 60;
const M_GAP = 8;
const M_TOP = 56;
// Closer to the real DM Sans / DM Mono advance widths than the layout estimates, so text wraps only when it must.
const M_CHAR = { label: 7.9, sub: 7.0 };
const LINE_H = { label: 17, sub: 15 };

type Block = { text: string[]; sub: string[]; height: number };

function block(text: string, sub: string | undefined, max: number): Block {
  const t = wrapText(text, M_CHAR.label, max);
  const u = sub ? wrapText(sub, M_CHAR.sub, max) : [];
  return { text: t, sub: u, height: t.length * LINE_H.label + u.length * LINE_H.sub + (u.length ? 2 : 0) };
}

/** Text lines for one block, vertically centered in a box of height h starting at top. */
function BlockText({
  b,
  x,
  top,
  h,
  textClass,
  subClass,
  max,
  anchorClass,
}: {
  b: Block;
  x: number;
  top: number;
  h: number;
  textClass: string;
  subClass: string;
  max: number;
  anchorClass: string;
}) {
  const start = top + (h - b.height) / 2;
  return (
    <>
      {b.text.map((line, i) => (
        <text
          key={`t${line}`}
          className={`${textClass}${anchorClass}`}
          x={x}
          y={start + 13 + i * LINE_H.label}
          {...fit(line, M_CHAR.label * 1.06, max)}
        >
          {line}
        </text>
      ))}
      {b.sub.map((line, i) => (
        <text
          key={`s${line}`}
          className={`${subClass}${anchorClass}`}
          x={x}
          y={start + b.text.length * LINE_H.label + 2 + 11 + i * LINE_H.sub}
          {...fit(line, M_CHAR.sub * 1.06, max)}
        >
          {line}
        </text>
      ))}
    </>
  );
}

export function MatrixDiagramView({ diagram, id }: { diagram: MatrixDiagram; id: string }) {
  const cellMax = M_COL_W - M_PAD * 2;
  const rows = diagram.rows.map((row) => {
    const label = block(row.label, row.sub, M_LABEL_TEXT_W);
    const cells = row.cells.map((cell) => block(cell.text, cell.sub, cellMax));
    const h = Math.max(M_MIN_H, label.height + 24, ...cells.map((c) => c.height + 24));
    return { label, cells, h };
  });
  const tops: number[] = [];
  let cursor = M_TOP;
  for (const row of rows) {
    tops.push(cursor);
    cursor += row.h + M_GAP;
  }
  const width = M_LABEL_W + diagram.columns.length * (M_COL_W + M_GAP) + 16;
  const height = cursor + 8;
  const { active, bind, close, tipId } = useActive();
  const legendLabel = (state: MatrixCell['state']) =>
    diagram.legend?.find((item) => item.state === state)?.label ?? STATE_NAME[state];
  let tip: Tip | null = null;
  if (active) {
    const [r, c] = active.split(':').map(Number);
    const row = diagram.rows[r];
    const cell = row?.cells[c];
    if (row && cell) {
      tip = {
        id: active,
        anchor: { left: M_LABEL_W + c * (M_COL_W + M_GAP), top: tops[r], width: M_COL_W, height: rows[r].h },
        card: (
          <>
            <p className="d-tip-eyebrow">
              <span className={`d-tip-swatch d-tip-swatch-${cell.state}`} />
              {legendLabel(cell.state)}
            </p>
            <p className="d-tip-title">
              {row.label} · {diagram.columns[c]}
            </p>
            <p className="d-tip-body d-tip-strong">{cell.text}</p>
            {cell.sub && <p className="d-tip-sub">{cell.sub}</p>}
            {cell.detail && <p className="d-tip-body">{cell.detail}</p>}
          </>
        ),
      };
    }
  }
  const minWidth = Math.min(width, 640);
  return (
    <Stage minWidth={minWidth} viewBox={{ width, height }} tip={tip} tipId={tipId} onEscape={close}>
      {(svgRef) => (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="d-svg d-svg-md"
          style={{ maxWidth: width, minWidth }}
          role="group"
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title id={`${id}-title`}>{diagram.title}</title>
          <desc id={`${id}-desc`}>{diagram.description}</desc>
          <text className="t-label" x={16} y={36}>
            {diagram.corner.toUpperCase()}
          </text>
          {diagram.columns.map((column, c) => (
            <text
              key={column}
              className="t t-c t-strong"
              x={M_LABEL_W + c * (M_COL_W + M_GAP) + M_COL_W / 2}
              y={36}
              {...fit(column, CHAR_W.label, M_COL_W)}
            >
              {column}
            </text>
          ))}
          {diagram.rows.map((row, r) => {
            const y = tops[r];
            const h = rows[r].h;
            return (
              <g key={row.label}>
                <BlockText
                  b={rows[r].label}
                  x={16}
                  top={y}
                  h={h}
                  textClass="t t-strong"
                  subClass="t-m t-sub"
                  max={M_LABEL_TEXT_W}
                  anchorClass=""
                />
                {row.cells.map((cell, c) => {
                  const x = M_LABEL_W + c * (M_COL_W + M_GAP);
                  const cls =
                    cell.state === 'own' ? 'd-cell-own' : cell.state === 'optional' ? 'd-cell-optional' : 'd-cell-none';
                  const text = cell.state === 'own' ? 't-inv' : 't';
                  const sub = cell.state === 'own' ? 't-inv-m' : 't-m t-sub';
                  return (
                    <g
                      key={`${row.label}-${diagram.columns[c]}`}
                      className="d-node"
                      role="group"
                      aria-label={`${row.label}, ${diagram.columns[c]}: ${legendLabel(cell.state)}. ${cell.text}`}
                      {...bind(`${r}:${c}`)}
                    >
                      <Ring x={x} y={y} w={M_COL_W} h={h} r={8} />
                      <rect className={cls} x={x} y={y} width={M_COL_W} height={h} rx={8} />
                      <BlockText
                        b={rows[r].cells[c]}
                        x={x + M_COL_W / 2}
                        top={y}
                        h={h}
                        textClass={text}
                        subClass={sub}
                        max={cellMax}
                        anchorClass=" t-c"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}
    </Stage>
  );
}
