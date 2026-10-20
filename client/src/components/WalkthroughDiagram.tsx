import type { FlowDiagram, FlowNode, MatrixDiagram } from '../data/walkthroughs/types.ts';
import {
  box,
  CHAR_W,
  COL_W,
  BOTTOM,
  GATE,
  gateLabelArea,
  layoutFor,
  PAD,
  placeGateLabel,
  ROW_H,
  route,
  SIDE,
  textWidth,
  type GatePlacement,
  type Layout,
} from './diagramLayout.ts';


// Text that would overflow its node is condensed to fit rather than spilling over the outline.
function fit(text: string, perChar: number, max: number) {
  return textWidth(text, perChar) > max ? { textLength: max, lengthAdjust: 'spacingAndGlyphs' as const } : {};
}

function NodeShape({ node, L, placement }: { node: FlowNode; L: Layout; placement?: GatePlacement }) {
  const b = box(node, L);
  const labelClass = `t t-c t-strong${node.mono ? ' t-mono' : ''}`;
  if (node.kind === 'gate') {
    const at = gateLabelArea(node, L, placement ?? 'above');
    return (
      <g>
        <path className="d-gate" d={`M${b.cx} ${b.top}l${GATE} ${GATE}-${GATE} ${GATE}-${GATE}-${GATE}z`} />
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
  const shapeClass = node.kind === 'highlight' ? 'd-box d-prod' : node.kind === 'surface' ? 'd-surface-box' : 'd-box';
  const labelY = node.sub ? b.cy - 4 : b.cy + 5;
  const inner = COL_W - PAD * 2;
  return (
    <g>
      {node.kind === 'store' ? (
        <path
          className="d-box"
          d={`M${b.left} ${b.top + 8}h64l8 -8h${COL_W - 80}a8 8 0 0 1 8 8v${ROW_H - 16}a8 8 0 0 1-8 8H${b.left + 8}a8 8 0 0 1-8-8z`}
        />
      ) : (
        <rect className={shapeClass} x={b.left} y={b.top} width={COL_W} height={ROW_H} rx={8} />
      )}
      <text className={labelClass} x={b.cx} y={labelY} {...fit(node.label, node.mono ? CHAR_W.labelMono : CHAR_W.label, inner)}>
        {node.label}
      </text>
      {node.sub && (
        <text className="t-m t-c" x={b.cx} y={b.cy + 16} {...fit(node.sub, CHAR_W.sub, inner)}>
          {node.sub}
        </text>
      )}
    </g>
  );
}

export function FlowDiagramView({ diagram, id }: { diagram: FlowDiagram; id: string }) {
  const L = layoutFor(diagram);
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const occupied = new Set(diagram.nodes.map((node) => `${node.col},${node.row}`));
  const cols = Math.max(...diagram.nodes.map((node) => node.col)) + 1;
  const rows = Math.max(...diagram.nodes.map((node) => node.row)) + 1;
  const width = L.colX(cols - 1) + COL_W + SIDE;
  const height = L.rowY(rows - 1) + ROW_H + BOTTOM;
  const marker = `${id}-arrow`;
  const paths = diagram.edges.flatMap((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    return from && to ? [route(from, to, L, occupied).d] : [];
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="d-svg"
      style={{ minWidth: Math.min(width, 980) }}
      role="img"
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
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path className="d-arrowhead" d="M0 0L10 5L0 10z" />
        </marker>
      </defs>
      {diagram.lanes?.map((lane) => {
        const top = L.rowY(lane.fromRow) - 36;
        const bottom = L.rowY(lane.toRow) + ROW_H + 18;
        return <rect key={lane.label} className="d-lane" x={8} y={top} width={width - 16} height={bottom - top} rx={8} />;
      })}
      {diagram.edges.map((edge) => {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        if (!from || !to) return null;
        const { d } = route(from, to, L, occupied);
        return (
          <path
            key={`${edge.from}-${edge.to}`}
            className={edge.dashed ? 'd-dash' : 'd-line'}
            d={d}
            markerEnd={edge.dashed ? undefined : `url(#${marker})`}
          />
        );
      })}
      {diagram.nodes.map((node) => (
        <NodeShape
          key={node.id}
          node={node}
          L={L}
          placement={node.kind === 'gate' ? placeGateLabel(node, L, paths) : undefined}
        />
      ))}
      {/* Labels go last, with a halo, so no line runs through their text. */}
      {diagram.lanes?.map((lane) => (
        <text key={`${lane.label}-label`} className="t-label t-halo-lane" x={20} y={L.rowY(lane.fromRow) - 18}>
          {lane.label.toUpperCase()}
        </text>
      ))}
      {diagram.edges.map((edge) => {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        if (!edge.label || !from || !to) return null;
        const { label, anchor = 'middle' } = route(from, to, L, occupied);
        return (
          <text
            key={`${edge.from}-${edge.to}-label`}
            className="t-m t-halo"
            textAnchor={anchor}
            x={label[0]}
            y={label[1]}
          >
            {edge.label}
          </text>
        );
      })}
    </svg>
  );
}

const M_LABEL_W = 210;
const M_COL_W = 176;
const M_PAD = 12;
const M_ROW_H = 60;

export function MatrixDiagramView({ diagram, id }: { diagram: MatrixDiagram; id: string }) {
  const width = M_LABEL_W + diagram.columns.length * (M_COL_W + 8) + 16;
  const height = 60 + diagram.rows.length * (M_ROW_H + 8) + 16;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="d-svg d-svg-md"
      style={{ maxWidth: width, minWidth: Math.min(width, 640) }}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{diagram.title}</title>
      <desc id={`${id}-desc`}>{diagram.description}</desc>
      <text className="t-label" x={16} y={36}>
        {diagram.corner.toUpperCase()}
      </text>
      {diagram.columns.map((column, c) => (
        <text key={column} className="t t-c t-strong" x={M_LABEL_W + c * (M_COL_W + 8) + M_COL_W / 2} y={36}>
          {column}
        </text>
      ))}
      {diagram.rows.map((row, r) => {
        const y = 56 + r * (M_ROW_H + 8);
        return (
          <g key={row.label}>
            <text className="t t-strong" x={16} y={y + (row.sub ? 26 : 35)}>
              {row.label}
            </text>
            {row.sub && (
              <text className="t-m t-mono" x={16} y={y + 44}>
                {row.sub}
              </text>
            )}
            {row.cells.map((cell, c) => {
              const x = M_LABEL_W + c * (M_COL_W + 8);
              const cls =
                cell.state === 'own' ? 'd-cell-own' : cell.state === 'optional' ? 'd-cell-optional' : 'd-cell-none';
              const text = cell.state === 'own' ? 't-inv t-c' : cell.state === 'optional' ? 't t-c' : 't-m t-c';
              const sub = cell.state === 'own' ? 't-inv-m t-c' : 't-m t-c';
              return (
                <g key={`${row.label}-${diagram.columns[c]}`}>
                  <rect className={cls} x={x} y={y} width={M_COL_W} height={M_ROW_H} rx={6} />
                  <text
                    className={text}
                    x={x + M_COL_W / 2}
                    y={y + (cell.sub ? 26 : 35)}
                    {...fit(cell.text, cell.state === 'none' ? CHAR_W.sub : CHAR_W.label, M_COL_W - M_PAD * 2)}
                  >
                    {cell.text}
                  </text>
                  {cell.sub && (
                    <text className={sub} x={x + M_COL_W / 2} y={y + 44} {...fit(cell.sub, CHAR_W.sub, M_COL_W - M_PAD * 2)}>
                      {cell.sub}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
