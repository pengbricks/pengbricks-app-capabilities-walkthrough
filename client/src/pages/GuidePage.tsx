import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator } from '@databricks/appkit-ui/react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Database,
  FileCode2,
  FileText,
  Loader2,
  Map as MapIcon,
  Play,
  PlayCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { getGuide } from '../data/guides.ts';
import {
  latestSuccessfulRun,
  runStatus,
  startQuickRun,
  useGuideArtifacts,
  type CodeHighlight,
  type GuideArtifacts,
  type GuideJob,
} from '../lib/artifacts.ts';

export function GuidePage() {
  const { slug } = useParams();
  const guide = getGuide(slug);
  const { data: artifacts, error, planned, reload } = useGuideArtifacts(guide?.slug);

  if (!guide) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="text-sm text-muted-foreground">Guide not found</p>
        <h1 className="mt-2 text-3xl font-semibold">This capability is not in the catalog.</h1>
        <Button className="mt-6" asChild>
          <Link to="/">Return home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8 lg:py-12">
      <Button variant="ghost" size="sm" className="-ml-3 mb-7" asChild>
        <Link to="/#guide-library">
          <ArrowLeft className="size-4" />
          All guides
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="min-w-0">
          <Badge variant="secondary">{guide.category}</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{guide.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{guide.summary}</p>

          <Separator className="my-10" />

          <section>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Guide intent</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">What this guide demonstrates</h2>
            <p className="mt-4 max-w-3xl text-base leading-7">{guide.acceptanceCriteria}</p>
          </section>

          <section className="mt-10">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Guide artifacts</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">What the run produces</h2>
            <div className="mt-5 grid gap-3">
              {guide.evidence.map((item, index) => (
                <div key={item} className="flex gap-4 rounded-xl border bg-card p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </span>
                  <p className="self-center text-sm font-medium">{item}</p>
                </div>
              ))}
            </div>
          </section>

          {artifacts && artifacts.highlights.length > 0 && (
            <section className="mt-10">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Reference code</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Key functions</h2>
              <div className="mt-5 grid gap-5">
                {artifacts.highlights.map((highlight) => (
                  <CodeExcerpt key={`${highlight.path}:${highlight.symbol ?? ''}`} highlight={highlight} />
                ))}
              </div>
            </section>
          )}

          {artifacts && artifacts.docs.length > 0 && (
            <section className="mt-10">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Documentation</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Databricks documentation</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {artifacts.docs.map((doc) => (
                  <ArtifactAnchor key={doc.url} icon={BookOpen} title={doc.label} url={doc.url} />
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Artifacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {planned && (
                <p className="text-sm text-muted-foreground">
                  Reference code and an actual run are planned for this guide.
                </p>
              )}
              {!artifacts && !error && !planned && <p className="text-sm text-muted-foreground">Loading artifacts…</p>}
              {error && <p className="text-sm text-muted-foreground">{error}</p>}
              {artifacts && (
                <>
                  <ArtifactAnchor
                    icon={FileText}
                    title="One-pager and demo steps"
                    description="Guide walkthrough"
                    url={artifacts.onePagerUrl}
                  />
                  <ArtifactAnchor
                    icon={FileCode2}
                    title="Reference code"
                    description="Deployable bundle on GitHub"
                    url={artifacts.bundleUrl}
                  />
                  {artifacts.walkthroughs.map((item) => (
                    <ArtifactAnchor key={item.url} icon={MapIcon} title={item.label} description="Walkthrough with diagrams" url={item.url} />
                  ))}
                  {artifacts.code.map((item) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate pl-7 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {item.label}
                    </a>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          {artifacts && <RunsCard slug={guide.slug} artifacts={artifacts} onChange={() => void reload()} />}
        </aside>
      </div>
    </div>
  );
}

function RunsCard({ slug, artifacts, onChange }: { slug: string; artifacts: GuideArtifacts; onChange: () => void }) {
  const hasJobs = artifacts.jobs.length > 0;
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          Actual runs
          {artifacts.live && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Database className="size-3" />
              {artifacts.tracking === 'lakebase' ? 'Tracked in Lakebase' : 'Jobs API'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {artifacts.live && hasJobs
          ? artifacts.jobs.map((job) => <JobRow key={job.key} slug={slug} job={job} onChange={onChange} />)
          : null}

        {(!artifacts.live || !hasJobs) && artifacts.recordedRuns.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Recorded reference runs</p>
            {artifacts.recordedRuns.map((run) => (
              <ArtifactAnchor
                key={run.url}
                icon={PlayCircle}
                title={run.label}
                description={`${run.workspace} · ${new Date(run.recordedAt).toLocaleDateString()}`}
                url={run.url}
              />
            ))}
          </div>
        )}

        {artifacts.liveError && <p className="text-xs text-muted-foreground">{artifacts.liveError}</p>}

        {artifacts.history.length > 0 && (
          <div>
            <Separator className="my-3" />
            <p className="mb-2 text-xs text-muted-foreground">Run history</p>
            <ul className="space-y-1.5">
              {artifacts.history.slice(0, 8).map((row) => (
                <li key={row.run_id} className="flex items-center justify-between gap-2 text-xs">
                  <a href={row.run_url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    {row.started_at ? new Date(row.started_at).toLocaleString() : `Run ${row.run_id}`}
                  </a>
                  <span className="flex shrink-0 gap-1">
                    {row.triggered_via === 'quick-run' && <Badge variant="outline">Quick run</Badge>}
                    <StatusBadge status={row.result_state ?? row.life_cycle_state ?? 'UNKNOWN'} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobRow({ slug, job, onChange }: { slug: string; job: GuideJob; onChange: () => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const latest = job.runs[0];
  const successful = latestSuccessfulRun(job);

  async function quickRun() {
    setPending(true);
    setMessage(null);
    try {
      const run = await startQuickRun(slug, job.key);
      setMessage(`Started run ${run.runId}`);
      onChange();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Quick run failed');
    } finally {
      setPending(false);
    }
  }

  if (!job.deployed) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        {job.label} is not deployed in this workspace yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <a href={job.jobUrl} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
          {job.label}
        </a>
        <Button size="sm" variant="outline" onClick={() => void quickRun()} disabled={pending} aria-label={`Quick run ${job.label}`}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Quick run
        </Button>
      </div>
      {successful && (
        <a
          href={successful.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-1 text-xs underline-offset-2 hover:underline"
        >
          <PlayCircle className="size-3.5" />
          Latest successful run
          <ArrowUpRight className="size-3" />
        </a>
      )}
      {latest && latest !== successful && (
        <a href={latest.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 text-xs hover:underline">
          Latest run <StatusBadge status={runStatus(latest)} />
        </a>
      )}
      {!latest && <p className="mt-2 text-xs text-muted-foreground">No runs yet.</p>}
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === 'SUCCESS' ? 'Succeeded' : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return <Badge variant={status === 'SUCCESS' ? 'secondary' : 'outline'}>{label}</Badge>;
}

function CodeExcerpt({ highlight }: { highlight: CodeHighlight }) {
  return (
    <figure className="overflow-hidden rounded-xl border bg-card">
      <figcaption className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{highlight.label}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {highlight.path}
            {highlight.symbol ? ` · ${highlight.symbol}` : ''}
          </p>
        </div>
        <a
          href={highlight.url}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 text-xs hover:underline"
          aria-label={`View ${highlight.label} on GitHub`}
        >
          GitHub
          <ArrowUpRight className="size-3" />
        </a>
      </figcaption>
      <pre className="max-h-96 overflow-auto bg-muted/40 p-4 text-xs leading-5">
        <code>{highlight.code}</code>
      </pre>
    </figure>
  );
}

function ArtifactAnchor({
  icon: Icon,
  title,
  description,
  url,
}: {
  icon: typeof FileCode2;
  title: string;
  description?: string;
  url: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <Icon className="size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <ArrowUpRight className="size-4 shrink-0" />
    </a>
  );
}
