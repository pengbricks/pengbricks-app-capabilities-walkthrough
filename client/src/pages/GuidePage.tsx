import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@databricks/appkit-ui/react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Database,
  FileCode2,
  FileText,
  FolderOpen,
  NotebookPen,
  Loader2,
  Map as MapIcon,
  Play,
  PlayCircle,
  Workflow,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AutoLoaderDrop } from '../components/AutoLoaderDrop.tsx';
import { CodeExcerpt } from '../components/CodeExcerpt.tsx';
import { DifficultyStars } from '../components/DifficultyStars.tsx';
import { getGuide } from '../data/guides.ts';
import designedWalkthroughs from '../data/walkthroughs/designed.json';
import { getWalkthrough } from '../data/walkthroughs/index.ts';
import { WalkthroughBody } from './walkthroughs/WalkthroughPage.tsx';
import {
  latestSuccessfulRun,
  runStatus,
  startQuickRun,
  useGuideArtifacts,
  type GuideArtifacts,
  type CodeHighlight,
  type GuideJob,
  type WorkspaceLinks,
} from '../lib/artifacts.ts';

export function GuidePage() {
  const { slug } = useParams();
  const guide = getGuide(slug);
  const { data: artifacts, error, planned, reload } = useGuideArtifacts(guide?.slug);
  const [searchParams, setSearchParams] = useSearchParams();

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

  const hasWalkthrough = Boolean(getWalkthrough(guide.slug)) || designed.has(guide.slug);
  const tabs = hasWalkthrough ? ['walkthrough', 'run', 'reference'] : ['run', 'reference'];
  const requested = searchParams.get('tab');
  const tab = requested && tabs.includes(requested) ? requested : tabs[0];
  const startHere = artifacts?.workspace?.startHere;

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-6 lg:px-8 lg:py-8">
      <Button variant="ghost" size="sm" className="-ml-3 mb-4" asChild>
        <Link to="/#guide-library">
          <ArrowLeft className="size-4" />
          All guides
        </Link>
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{guide.category}</Badge>
            <DifficultyStars value={guide.difficulty} />
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{guide.title}</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">{guide.summary}</p>
        </div>
        {startHere && (
          <Button variant="outline" asChild>
            <a href={startHere.url} target="_blank" rel="noreferrer">
              <NotebookPen className="size-4" />
              Open 00_start_here
              <ArrowUpRight className="size-3.5" />
            </a>
          </Button>
        )}
      </header>

      {/* The walkthrough gets the full width; runs and reference material sit in their own tabs. */}
      <Tabs
        value={tab}
        onValueChange={(value) => setSearchParams(value === tabs[0] ? {} : { tab: value }, { replace: true })}
        className="mt-6"
      >
        <TabsList>
          {hasWalkthrough && <TabsTrigger value="walkthrough">Walkthrough</TabsTrigger>}
          <TabsTrigger value="run">Run it</TabsTrigger>
          <TabsTrigger value="reference">Reference</TabsTrigger>
        </TabsList>

        {hasWalkthrough && (
          <TabsContent value="walkthrough" className="mt-6">
            <GuideWalkthrough slug={guide.slug} excerpts={artifacts?.highlights ?? []} />
          </TabsContent>
        )}

        <TabsContent value="run" className="mt-6 space-y-8">
          {artifacts && (artifacts.workspace || artifacts.jobs.length > 0 || artifacts.recordedRuns.length > 0) ? (
            <RunsCard slug={guide.slug} artifacts={artifacts} onChange={() => void reload()} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {error ??
                (planned
                  ? 'An actual run is planned for this guide.'
                  : artifacts
                    ? 'This guide has no job.'
                    : 'Loading runs…')}
            </p>
          )}
          {artifacts?.autoLoaderDrop && <AutoLoaderDrop slug={guide.slug} />}
        </TabsContent>

        <TabsContent value="reference" className="mt-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article className="min-w-0">
              <section>
                <h2 className="text-2xl font-semibold tracking-tight">What you&apos;ll see</h2>
                <p className="mt-4 max-w-3xl text-base leading-7">{guide.acceptanceCriteria}</p>
              </section>

              <section className="mt-10">
                <h2 className="text-2xl font-semibold tracking-tight">What the run produces</h2>
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
                  <h2 className="text-2xl font-semibold tracking-tight">Key functions</h2>
                  <div className="mt-5 grid gap-5">
                    {artifacts.highlights.map((highlight) => (
                      <CodeExcerpt key={`${highlight.path}:${highlight.symbol ?? ''}:${highlight.label}`} highlight={highlight} />
                    ))}
                  </div>
                </section>
              )}

              {artifacts && artifacts.tools.length > 0 && (
                <section className="mt-10">
                  <h2 className="text-2xl font-semibold tracking-tight">Extensions and tools</h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {artifacts.tools.map((tool) => (
                      <div key={tool.url} className="flex flex-col rounded-lg border p-4">
                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-sm font-medium hover:underline"
                        >
                          {tool.label}
                          <ArrowUpRight className="size-3.5" />
                        </a>
                        <p className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
                        <a
                          href={tool.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 text-xs underline-offset-2 hover:underline"
                        >
                          Documentation
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {artifacts && artifacts.docs.length > 0 && (
                <section className="mt-10">
                  <h2 className="text-2xl font-semibold tracking-tight">Databricks documentation</h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {artifacts.docs.map((doc) => (
                      <ArtifactAnchor key={doc.url} icon={BookOpen} title={doc.label} url={doc.url} />
                    ))}
                  </div>
                </section>
              )}
            </article>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card className="gap-4 py-5 shadow-none">
                <CardHeader className="px-5">
                  <CardTitle className="text-base">Reference code</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-5">
                  {planned && (
                    <p className="text-sm text-muted-foreground">
                      Reference code and an actual run are planned for this guide.
                    </p>
                  )}
                  {!artifacts && !error && !planned && (
                    <p className="text-sm text-muted-foreground">Loading artifacts…</p>
                  )}
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
                      {artifacts.code.map((item) => (
                        <a
                          key={item.url}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate pl-10 text-xs text-muted-foreground underline-offset-2 hover:underline"
                        >
                          {item.label}
                        </a>
                      ))}
                    </>
                  )}
                  <WalkthroughLinks slug={guide.slug} />
                </CardContent>
              </Card>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The guide leads with its visual walkthrough: the designed page when there is one, then the
// data-driven walkthrough, both rendered in place.
function GuideWalkthrough({ slug, excerpts }: { slug: string; excerpts: CodeHighlight[] }) {
  const data = getWalkthrough(slug);
  const hasDesigned = designed.has(slug);
  if (!data && !hasDesigned) return null;
  // Designed pages are static HTML, so their code excerpts follow the page instead of sitting in a section.
  const designedExcerpts = hasDesigned && !data ? excerpts.filter((item) => item.section) : [];
  return (
    <section aria-label="Visual walkthrough">
      {hasDesigned && <DesignedWalkthrough slug={slug} />}
      {data && (
        <div className="walkthrough walkthrough-inline">
          <WalkthroughBody walkthrough={data} excerpts={excerpts} />
        </div>
      )}
      {designedExcerpts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold tracking-tight">Set it up in code</h2>
          <div className="mt-5 grid gap-5">
            {designedExcerpts.map((highlight) => (
              <CodeExcerpt key={`${highlight.path}:${highlight.symbol ?? ''}:${highlight.label}`} highlight={highlight} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Designed walkthroughs are static pages next to the app; the frame grows to fit its content.
function DesignedWalkthrough({ slug }: { slug: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    let observer: ResizeObserver | undefined;
    const fit = () => {
      const doc = element.contentDocument;
      if (!doc?.body) return;
      // The guide page already shows the site bar, breadcrumbs, and title, so hide the page's own.
      if (!doc.getElementById('embedded-walkthrough')) {
        const style = doc.createElement('style');
        style.id = 'embedded-walkthrough';
        style.textContent =
          '.skip-link, .topbar, .crumbs, .guide-head > h1, .guide-head > .eyebrow { display: none !important; } main.main.guide { padding: 0 0 2rem !important; } .guide .page { max-width: none !important; } .guide-head { margin-top: 0 !important; padding-bottom: 1.5rem !important; } .guide-section { margin-top: 2.5rem !important; } .d-svg { max-width: 1100px; margin-inline: auto; } html { overflow: hidden; }';
        doc.head.appendChild(style);
      }
      element.style.height = `${doc.documentElement.scrollHeight}px`;
      observer?.disconnect();
      observer = new ResizeObserver(() => {
        element.style.height = `${doc.documentElement.scrollHeight}px`;
      });
      observer.observe(doc.body);
    };
    element.addEventListener('load', fit);
    fit();
    return () => {
      element.removeEventListener('load', fit);
      observer?.disconnect();
    };
  }, [slug]);
  return (
    <iframe
      ref={frame}
      title="Visual walkthrough"
      src={`${import.meta.env.BASE_URL}walkthroughs/${slug}.html`}
      className="w-full"
      allow="fullscreen"
      style={{ height: '80vh' }}
    />
  );
}

function RunsCard({ slug, artifacts, onChange }: { slug: string; artifacts: GuideArtifacts; onChange: () => void }) {
  const hasJobs = artifacts.jobs.length > 0 || Boolean(artifacts.workspace);
  // Deployments without the reference jobs (other workspaces) still link the recorded reference runs.
  const anyDeployed = artifacts.jobs.some((job) => job.deployed);
  return (
    <Card className="gap-4 py-5 shadow-none">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center justify-between text-base">
          {hasJobs ? 'In this workspace' : 'Workspace artifacts'}
          {artifacts.live && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Database className="size-3" />
              {artifacts.tracking === 'lakebase' ? 'Tracked in Lakebase' : 'Jobs API'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {artifacts.workspace && <WorkspaceLinksBlock links={artifacts.workspace} />}

        {artifacts.live && hasJobs && anyDeployed ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {artifacts.jobs.map((job) => (
              <JobRow key={job.key} slug={slug} job={job} onChange={onChange} />
            ))}
          </div>
        ) : null}

        {(!artifacts.live || !anyDeployed) && artifacts.recordedRuns.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Reference workspace</p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
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
          </div>
        )}

        {artifacts.liveError && <p className="text-xs text-muted-foreground">{artifacts.liveError}</p>}
        {artifacts.live && artifacts.trackingDetail && (
          <p className="text-xs text-muted-foreground">{artifacts.trackingDetail}</p>
        )}

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

// The deployed copy of the guide in this workspace: start with 00_start_here, or open the pipelines.
function WorkspaceLinksBlock({ links }: { links: WorkspaceLinks }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {links.startHere ? (
        <ArtifactAnchor
          icon={NotebookPen}
          title="Start here"
          description={`${links.folder.label} · 00_start_here`}
          url={links.startHere.url}
        />
      ) : null}
      <ArtifactAnchor
        icon={FolderOpen}
        title={links.folder.label}
        description="Notebooks, job and pipeline definitions in this workspace"
        url={links.folder.url}
      />
      {links.pipelines.map((item) => (
        <ArtifactAnchor
          key={item.url}
          icon={Workflow}
          title={item.label}
          description="Lakeflow Declarative Pipeline"
          url={item.url}
        />
      ))}
    </div>
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => void quickRun()}
          disabled={pending}
          aria-label={`Quick run ${job.label}`}
        >
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
        <a
          href={latest.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-2 text-xs hover:underline"
        >
          Latest run <StatusBadge status={runStatus(latest)} />
        </a>
      )}
      {!latest && <p className="mt-2 text-xs text-muted-foreground">No runs yet.</p>}
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === 'SUCCESS' ? 'Succeeded' : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return <Badge variant={status === 'SUCCESS' ? 'secondary' : 'outline'}>{label}</Badge>;
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

const designed = new Set<string>(designedWalkthroughs);

function WalkthroughLinks({ slug }: { slug: string }) {
  const hasDesigned = designed.has(slug);
  const data = getWalkthrough(slug);
  if (!hasDesigned && !data) return null;
  const className =
    'flex items-center gap-3 rounded-lg border border-foreground p-3 transition-colors hover:bg-muted/50';
  return (
    <>
      {hasDesigned && (
        // Designed walkthroughs are static pages served next to the app, so they open with a plain link.
        <a href={`${import.meta.env.BASE_URL}walkthroughs/${slug}.html`} className={className}>
          <MapIcon className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Visual walkthrough</p>
            <p className="text-xs text-muted-foreground">Diagrams and steps for this guide</p>
          </div>
          <ArrowUpRight className="size-4 shrink-0" />
        </a>
      )}
      {data && (
        <Link to={`/walkthroughs/${slug}`} className={className}>
          <MapIcon className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {hasDesigned ? 'Rules, quarantine, alerts, and audit' : 'Visual walkthrough'}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasDesigned ? 'Row-level flow and system table queries' : 'Diagrams and steps for this guide'}
            </p>
          </div>
          <ArrowUpRight className="size-4 shrink-0" />
        </Link>
      )}
    </>
  );
}
