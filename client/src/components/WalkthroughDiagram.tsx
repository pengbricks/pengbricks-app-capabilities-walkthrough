import type { FlowDiagram, FlowNode, MatrixDiagram } from '../data/walkthroughs/types.ts';

// Grid layout for flow diagrams: nodes sit in columns and rows; edges route between ports.
const COL_W = 196;
const COL_GAP = 56;
const ROW_H = 64;
const ROW_GAP = 56;
const TOP = 48;
const SIDE = 24;
const GATE = 22; // half-diagonal of an approval gate

const colX = (col: number) => SIDE + col * (COL_W + COL_GAP);
const rowY = (row: number) => TOP + row * (ROW_H + ROW_GAP);

type Box = { left: number; right: number; top: number; bottom: number; cx: number; cy: number };

function box(node: FlowNode): Box {
  const x = colX(node.col);
  const y = rowY(node.row);
  if (node.kind === 'gate') {
    const cx = x + COL_W / 2;
    const cy = y + GATE;
    return { left: cx - GATE, right: cx + GATE, top: cy - GATE, bottom: cy + GATE, cx, cy };
  }
  return { left: x, right: x + COL_W, top: y, bottom: y + ROW_H, cx: x + COL_W / 2, cy: y + ROW_H / 2 };
}

function edgePath(a: Box, b: Box): { d: string; mid: [number, number] } {
  if (Math.abs(a.cx - b.cx) < 1) {
    const down = b.cy > a.cy;
    const y1 = down ? a.bottom : a.top;
    const y2 = down ? b.top - 2 : b.bottom + 2;
    return { d: `M${a.cx} ${y1}V${y2}`, mid: [a.cx + 6, (y1 + y2) / 2] };
  }
  const forward = b.cx > a.cx;
  const x1 = forward ? a.right : a.left;
  const x2 = forward ? b.left - 2 : b.right + 2;
  if (Math.abs(a.cy - b.cy) < 1) return { d: `M${x1} ${a.cy}H${x2}`, mid: [(x1 + x2) / 2, a.cy - 8] };
  const xm = (x1 + x2) / 2;
  return { d: `M${x1} ${a.cy}H${xm}V${b.cy}H${x2}`, mid: [xm + 6, (a.cy + b.cy) / 2] };
}

function NodeShape({ node }: { node: FlowNode }) {
  const b = box(node);
  const labelClass = `t t-c t-strong${node.mono ? ' t-mono' : ''}`;
  if (node.kind === 'gate') {
    return (
      <g>
        <path className="d-gate" d={`M${b.cx} ${b.top}l${GATE} ${GATE}-${GATE} ${GATE}-${GATE}-${GATE}z`} />
        <text className="t-m t-c" x={b.cx} y={node.sub ? b.top - 22 : b.top - 8}>
          {node.label}
        </text>
        {node.sub && (
          <text className="t-m t-c" x={b.cx} y={b.top - 8}>
            {node.sub}
          </text>
        )}
      </g>
    );
  }
  const shapeClass = node.kind === 'highlight' ? 'd-box d-prod' : node.kind === 'surface' ? 'd-surface-box' : 'd-box';
  const labelY = node.sub ? b.cy - 4 : b.cy + 5;
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
      <text className={labelClass} x={b.cx} y={labelY}>
        {node.label}
      </text>
      {node.sub && (
        <text className="t-m t-c t-mono" x={b.cx} y={b.cy + 16}>
          {node.sub}
        </text>
      )}
    </g>
  );
}

export function FlowDiagramView({ diagram, id }: { diagram: FlowDiagram; id: string }) {
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const cols = Math.max(...diagram.nodes.map((node) => node.col)) + 1;
  const rows = Math.max(...diagram.nodes.map((node) => node.row)) + 1;
  const width = colX(cols - 1) + COL_W + SIDE;
  const height = rowY(rows - 1) + ROW_H + 40;
  const marker = `${id}-arrow`;

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
        const top = rowY(lane.fromRow) - 36;
        const bottom = rowY(lane.toRow) + ROW_H + 18;
        return (
          <g key={lane.label}>
            <rect className="d-lane" x={8} y={top} width={width - 16} height={bottom - top} rx={8} />
            <text className="t-label" x={20} y={top + 18}>
              {lane.label.toUpperCase()}
            </text>
          </g>
        );
      })}
      {diagram.edges.map((edge) => {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        if (!from || !to) return null;
        const { d, mid } = edgePath(box(from), box(to));
        return (
          <g key={`${edge.from}-${edge.to}`}>
            <path
              className={edge.dashed ? 'd-dash' : 'd-line'}
              d={d}
              markerEnd={edge.dashed ? undefined : `url(#${marker})`}
            />
            {edge.label && (
              <text className="t-m" x={mid[0]} y={mid[1]}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}
      {diagram.nodes.map((node) => (
        <NodeShape key={node.id} node={node} />
      ))}
    </svg>
  );
}

const M_LABEL_W = 210;
const M_COL_W = 150;
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
                  <text className={text} x={x + M_COL_W / 2} y={y + (cell.sub ? 26 : 35)}>
                    {cell.text}
                  </text>
                  {cell.sub && (
                    <text className={sub} x={x + M_COL_W / 2} y={y + 44}>
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
