import { Button } from '@databricks/appkit-ui/react';
import { Link, useParams } from 'react-router';
import { FlowDiagramView, MatrixDiagramView } from '../../components/WalkthroughDiagram.tsx';
import { getWalkthrough } from '../../data/walkthroughs/index.ts';
import type { Diagram, FlowDiagram, MatrixDiagram, WalkthroughSection } from '../../data/walkthroughs/types.ts';

export function WalkthroughPage() {
  const { slug } = useParams();
  const walkthrough = getWalkthrough(slug);

  if (!walkthrough) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="text-sm text-muted-foreground">Walkthrough not found</p>
        <Button className="mt-6" asChild>
          <Link to="/">Return home</Link>
        </Button>
      </div>
    );
  }

  const toc = [{ id: 'short', heading: 'The short version' }, ...walkthrough.sections];

  return (
    <div className="walkthrough">
      <article className="page">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Overview</Link>
          <Chevron />
          <span>{walkthrough.area}</span>
          <Chevron />
          <Link to={`/guides/${walkthrough.slug}`}>Guide</Link>
        </nav>

        <header className="guide-head">
          <p className="eyebrow">Walkthrough</p>
          <h1>{walkthrough.title}</h1>
          <p className="hero-sub">{walkthrough.intro}</p>
          <nav className="toc" aria-label="On this page">
            {toc.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {item.heading}
              </a>
            ))}
          </nav>
        </header>

        <section className="guide-section" id="short" aria-labelledby="h-short">
          <h2 id="h-short">The short version</h2>
          <ol className="short-list">
            {walkthrough.shortVersion.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {walkthrough.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        {walkthrough.related.length > 0 && (
          <nav className="pager" aria-label="Related guides">
            {walkthrough.related.map((item, index) => (
              <Link key={item.slug} className={index === 0 ? 'prev' : 'next'} to={`/guides/${item.slug}`}>
                <span className="eyebrow">Related guide</span>
                <span className="pager-title">{item.title}</span>
              </Link>
            ))}
          </nav>
        )}
      </article>
    </div>
  );
}

function Section({ section }: { section: WalkthroughSection }) {
  const headingId = `h-${section.id}`;
  return (
    <section className="guide-section" id={section.id} aria-labelledby={headingId}>
      <h2 id={headingId}>{section.heading}</h2>
      {section.prose && <p className="prose">{section.prose}</p>}
      {section.diagram && <DiagramFigure diagram={section.diagram} id={`d-${section.id}`} />}
      {section.steps && (
        <ol className="step-list">
          {section.steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {step.code && <pre className="step-code">{step.code}</pre>}
            </li>
          ))}
        </ol>
      )}
      {section.table && (
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby={headingId}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{section.table.columns[0]}</th>
                <th scope="col">{section.table.columns[1]}</th>
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map(([left, right]) => (
                <tr key={left}>
                  <td>{left}</td>
                  <td>{right}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.points && (
        <ul className="practice-list">
          {section.points.map((point) => (
            <li key={point.strong}>
              <strong>{point.strong}</strong> {point.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DiagramFigure({ diagram, id }: { diagram: Diagram; id: string }) {
  return (
    <figure className="diagram">
      <div className="diagram-scroll" tabIndex={0} role="group" aria-label={`${diagram.title}, scrollable`}>
        {diagram.type === 'flow' ? (
          <FlowDiagramView diagram={diagram} id={id} />
        ) : (
          <MatrixDiagramView diagram={diagram} id={id} />
        )}
      </div>
      <Legend diagram={diagram} />
    </figure>
  );
}

function Legend({ diagram }: { diagram: Diagram }) {
  const items = diagram.type === 'flow' ? flowLegend(diagram) : matrixLegend(diagram);
  if (items.length === 0 && !diagram.caption) return null;
  return (
    <figcaption>
      {items}
      {diagram.caption && <span>{diagram.caption}</span>}
    </figcaption>
  );
}

function flowLegend(diagram: FlowDiagram) {
  return (diagram.legend ?? []).map((item) => (
    <span key={item.label} className="legend-item">
      <svg viewBox="0 0 32 16" aria-hidden="true">
        {item.kind === 'dashed' && <line className="d-dash" x1="0" y1="8" x2="32" y2="8" />}
        {item.kind === 'line' && <line className="d-line" x1="0" y1="8" x2="32" y2="8" />}
        {item.kind === 'gate' && <path className="d-gate" d="M16 1l7 7-7 7-7-7z" />}
        {item.kind === 'highlight' && <rect className="d-box d-prod" x="9" y="1" width="14" height="14" rx="3" />}
        {(item.kind === 'box' || item.kind === 'store') && (
          <rect className="d-box" x="9" y="1" width="14" height="14" rx="3" />
        )}
        {item.kind === 'surface' && <rect className="d-surface-box" x="9" y="1" width="14" height="14" rx="3" />}
      </svg>
      <span>{item.label}</span>
    </span>
  ));
}

function matrixLegend(diagram: MatrixDiagram) {
  const cls = { own: 'd-cell-own', optional: 'd-cell-optional', none: 'd-cell-none' } as const;
  return (diagram.legend ?? []).map((item) => (
    <span key={item.label} className="legend-item">
      <svg viewBox="0 0 32 16" aria-hidden="true">
        <rect className={cls[item.state]} x="9" y="1" width="14" height="14" rx="3" />
      </svg>
      <span>{item.label}</span>
    </span>
  ));
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
