import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator } from '@databricks/appkit-ui/react';
import { ArrowLeft, ArrowUpRight, CheckCircle2, FileCode2, FileText, PlayCircle, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { getGuide } from '../data/guides.ts';

export function GuidePage() {
  const { slug } = useParams();
  const guide = getGuide(slug);

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

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <article>
          <Badge variant="secondary">{guide.category}</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{guide.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{guide.summary}</p>

          <Separator className="my-10" />

          <section>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Guide intent</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">What this guide must demonstrate</h2>
            <p className="mt-4 max-w-3xl text-base leading-7">{guide.acceptanceCriteria}</p>
          </section>

          <section className="mt-10">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Required artifacts</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Guide artifacts</h2>
            <div className="mt-5 grid gap-3">
              {guide.evidence.map((item, index) => (
                <div key={item} className="flex gap-4 rounded-xl border bg-card p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{item}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Capture the artifact, environment, owner, timestamp, and result.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Card className="mt-10 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" />
                One-page conclusion
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
              <ConclusionField label="Finding" value="Record the observed behavior and evidence-backed outcome." />
              <ConclusionField label="Decision" value="State accepted, accepted with conditions, or not accepted." />
              <ConclusionField
                label="Gaps and risks"
                value="Document limitations, previews, regions, and unresolved dependencies."
              />
              <ConclusionField label="Owner and next step" value="Assign the follow-up action and target date." />
            </CardContent>
          </Card>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Evidence links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <EvidenceLink
                icon={FileCode2}
                title="Reference code"
                description="Versioned implementation"
                url={guide.codeUrl}
              />
              <EvidenceLink icon={PlayCircle} title="Actual run" description="Execution and trace" url={guide.runUrl} />
              <Separator className="my-5" />
              <div className="flex gap-3 rounded-lg bg-muted/60 p-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Links remain visibly pending until a real repository artifact and successful Databricks run are
                  connected.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ConclusionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-muted-foreground" />
        {label}
      </p>
      <p className="mt-2 leading-6 text-muted-foreground">{value}</p>
    </div>
  );
}

function EvidenceLink({
  icon: Icon,
  title,
  description,
  url,
}: {
  icon: typeof FileCode2;
  title: string;
  description: string;
  url?: string;
}) {
  if (!url) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 opacity-70">
        <Icon className="size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">Pending</Badge>
      </div>
    );
  }

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
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowUpRight className="size-4" />
    </a>
  );
}
