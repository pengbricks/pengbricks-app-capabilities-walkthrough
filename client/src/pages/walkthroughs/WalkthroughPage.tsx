import { Button } from '@databricks/appkit-ui/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CodeBlock, HighlightedCode } from '../../components/CodeBlock.tsx';
import { CodeExcerpt } from '../../components/CodeExcerpt.tsx';
import { FlowDiagramView, MatrixDiagramView } from '../../components/WalkthroughDiagram.tsx';
import { guessLanguage } from '../../lib/highlight.ts';
import { valueIcons } from '../../components/valueIcon.ts';
import { HeadingLink } from '../../components/HeadingLink.tsx';
import { getWalkthrough } from '../../data/walkthroughs/index.ts';
import { useGuideArtifacts, type CodeHighlight } from '../../lib/artifacts.ts';
import type {
  Diagram,
  FlowDiagram,
  MatrixDiagram,
  Walkthrough,
  WalkthroughSection,
} from '../../data/walkthroughs/types.ts';

export function WalkthroughPage() {
  const { slug } = useParams();
  const walkthrough = getWalkthrough(slug);
  const { data: artifacts } = useGuideArtifacts(walkthrough?.slug);

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

  const toc = [
    ...(walkthrough.businessValue ? [{ id: 'value', heading: 'Business value' }] : []),
    { id: 'short', heading: 'The short version' },
    ...walkthrough.sections,
  ];

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

        <WalkthroughBody walkthrough={walkthrough} excerpts={artifacts?.highlights ?? []} />

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

// Up to six short-version cards share one row; longer lists split into two even rows.
const shortColumns = (count: number) => (count <= 6 ? count : Math.ceil(count / 2));

// The walkthrough content without page chrome, so a guide page can lead with it.
export function WalkthroughBody({
  walkthrough,
  excerpts = [],
}: {
  walkthrough: Walkthrough;
  excerpts?: CodeHighlight[];
}) {
  const value = walkthrough.businessValue;
  const icons = value ? valueIcons(value.outcomes) : [];
  return (
    <>
      {value && (
        <section className="guide-section" id="value" aria-labelledby="h-value">
          <h2 id="h-value" className="group">
            Business value
            <HeadingLink id="value" label="Business value" />
          </h2>
          <p className="value-summary">{value.summary}</p>
          <ul className="value-list">
            {value.outcomes.map((item, index) => {
              const Icon = icons[index];
              return (
                <li key={item.title}>
                  <span className="value-icon" aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="guide-section" id="short" aria-labelledby="h-short">
        <h2 id="h-short" className="group">
          The short version
          <HeadingLink id="short" label="The short version" />
        </h2>
        <ol className="short-list" style={{ ['--short-count' as string]: shortColumns(walkthrough.shortVersion.length) }}>
          {walkthrough.shortVersion.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {walkthrough.sections.map((section) => (
        <Section key={section.id} section={section} excerpts={excerpts.filter((item) => item.section === section.id)} />
      ))}
    </>
  );
}

function Section({ section, excerpts }: { section: WalkthroughSection; excerpts: CodeHighlight[] }) {
  const headingId = `h-${section.id}`;
  return (
    <section className="guide-section" id={section.id} aria-labelledby={headingId}>
      <h2 id={headingId} className="group">
        {section.heading}
        <HeadingLink id={section.id} label={section.heading} />
      </h2>
      {section.prose && <p className="prose">{section.prose}</p>}
      {section.diagram && <DiagramFigure diagram={section.diagram} id={`d-${section.id}`} />}
      {section.steps && (
        <ol className="step-list">
          {section.steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {step.code && (
                <pre className="step-code code-block">
                  <HighlightedCode code={step.code} language={guessLanguage(step.code)} />
                </pre>
              )}
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
      {section.options && (
        <div className="options-block">
          {section.options.caption && <p className="options-caption">{section.options.caption}</p>}
          <div className="table-wrap" tabIndex={0} role="region" aria-label={section.options.caption ?? `${section.heading}: options`}>
            <table className="data-table options-table">
              <thead>
                <tr>
                  <th scope="col">Option</th>
                  <th scope="col">When to use it</th>
                  <th scope="col">Tradeoffs</th>
                </tr>
              </thead>
              <tbody>
                {section.options.rows.map((row) => (
                  <tr key={row.option}>
                    <td className="font-medium">{row.option}</td>
                    <td>{row.when}</td>
                    <td>{row.tradeoffs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="options-pick">
            <strong>Default:</strong> {section.options.recommendation}
          </p>
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
      {section.links && (
        <ul className="practice-list">
          {section.links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-4"
              >
                {link.label}
              </a>
              {link.note && ` ${link.note}`}
            </li>
          ))}
        </ul>
      )}
      {(excerpts.length > 0 || section.examples) && (
        <div className="section-code">
          {excerpts.map((highlight) => (
            <CodeExcerpt key={`${highlight.path}:${highlight.symbol ?? ''}:${highlight.label}`} highlight={highlight} />
          ))}
          {section.examples?.map((example) => (
            <figure key={example.label} className="overflow-hidden rounded-xl border bg-card">
              <figcaption className="flex-col items-start gap-0.5 border-b px-4 py-2.5">
                <p className="text-sm font-medium">{example.label}</p>
                <p className="text-xs text-muted-foreground">Example, not in the reference code</p>
              </figcaption>
              {example.notes && example.notes.length > 0 && (
                <ul className="list-disc space-y-1 border-b px-4 py-3 pl-8 text-xs leading-5 text-muted-foreground">
                  {example.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              <CodeBlock code={example.code} language={example.language} functions={{}} />
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function DiagramFigure({ diagram, id }: { diagram: Diagram; id: string }) {
  const figure = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const sync = () => setExpanded(document.fullscreenElement === figure.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement === figure.current) void document.exitFullscreen();
    else void figure.current?.requestFullscreen();
  };
  return (
    <figure ref={figure} className="diagram">
      {document.fullscreenEnabled && (
        <button type="button" className="diagram-expand" onClick={toggle}>
          {expanded ? 'Close' : 'Expand'}
        </button>
      )}
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
