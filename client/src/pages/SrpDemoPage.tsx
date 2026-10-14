import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  Separator,
} from '@databricks/appkit-ui/react';
import { ArrowLeft, Circle, FileCode2, PlayCircle, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { SrpStatus } from '../components/SrpStatus.tsx';
import { getSrpDemo } from '../data/srpDemos.ts';

export function SrpDemoPage() {
  const { slug } = useParams();
  const demo = getSrpDemo(slug);

  if (!demo) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="text-sm text-muted-foreground">SRP module not found</p>
        <h1 className="mt-2 text-3xl font-semibold">This guide module is not in the walkthrough.</h1>
        <Button className="mt-6" asChild>
          <Link to="/demos/srp">Return to SRP walkthrough</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-8 lg:px-8 lg:py-12">
      <Button variant="ghost" size="sm" className="-ml-3 mb-7" asChild>
        <Link to="/demos/srp">
          <ArrowLeft className="size-4" />
          SRP walkthrough
        </Link>
      </Button>

      <div className="grid gap-9 lg:grid-cols-[1fr_320px]">
        <article>
          <div className="flex flex-wrap gap-2">
            <SrpStatus label="Spec" state={demo.specState} />
            <SrpStatus label="Code" state={demo.codeState} />
            <SrpStatus label="Run" state={demo.runState} />
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{demo.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{demo.summary}</p>
          <Button variant="link" className="mt-3 h-auto p-0" asChild>
            <Link to={`/guides/${demo.mappedGuideSlug}`}>Guide standard: {demo.mappedGuide}</Link>
          </Button>

          <Separator className="my-10" />

          <SectionLabel>What this must prove</SectionLabel>
          <p className="mt-3 max-w-4xl text-xl font-medium leading-8">{demo.mustProve}</p>

          <section className="mt-10 grid gap-4 md:grid-cols-2">
            <BoundaryCard title="Provider-specific" items={demo.providerSpecific} />
            <BoundaryCard title="Shared and reused" items={demo.sharedFramework} emphasized />
          </section>

          <section className="mt-12">
            <SectionLabel>Databricks capabilities</SectionLabel>
            <h2 className="mt-2 text-2xl font-semibold">Platform responsibility map</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {demo.capabilities.map((capability) => (
                <Card key={capability.name} className="shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold">{capability.name}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{capability.responsibility}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <SectionLabel>Demo sequence</SectionLabel>
            <h2 className="mt-2 text-2xl font-semibold">Operator walkthrough</h2>
            <div className="mt-5 space-y-3">
              {demo.sequence.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-xl border p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <SectionLabel>Acceptance checklist</SectionLabel>
            <h2 className="mt-2 text-2xl font-semibold">Observable outcome</h2>
            <Card className="mt-5 shadow-none">
              <CardContent className="divide-y p-0">
                {demo.acceptance.map((item) => (
                  <div key={item} className="flex gap-3 p-4">
                    <Circle className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm leading-6">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="mt-12">
            <SectionLabel>Public reference examples</SectionLabel>
            <h2 className="mt-2 text-2xl font-semibold">Portable inputs, not run evidence</h2>
            <div className="mt-5 space-y-3">
              {demo.references.map((reference) => (
                <Card key={reference.path} className="shadow-none">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <code className="break-all text-xs">{reference.path}</code>
                      <SrpStatus label="Source" state={reference.state} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{reference.finding}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Evidence ledger</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Completeness</span>
                <span>Specification only</span>
              </div>
              <Progress value={33} className="mt-2" aria-label="Evidence completeness" />
              <div className="mt-5 space-y-3">
                <EvidenceItem
                  icon={ShieldCheck}
                  title="Specification"
                  detail="Acceptance design is ready"
                  state="Ready"
                />
                <EvidenceItem
                  icon={FileCode2}
                  title="Immutable code"
                  detail="Public Git commit permalink required"
                  state={demo.codeState}
                />
                <EvidenceItem
                  icon={PlayCircle}
                  title="Actual run"
                  detail="No Databricks run is connected"
                  state="Pending"
                />
              </div>
              <Separator className="my-5" />
              <p className="text-xs leading-5 text-muted-foreground">
                Verification requires environment, owner, release SHA, resource and run IDs, timestamps, terminal
                success, and captured outputs.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</p>;
}

function BoundaryCard({
  title,
  items,
  emphasized = false,
}: {
  title: string;
  items: readonly string[];
  emphasized?: boolean;
}) {
  return (
    <Card className={emphasized ? 'border-primary/20 shadow-none' : 'shadow-none'}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-lg border bg-background px-3 py-2.5 text-sm">
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EvidenceItem({
  icon: Icon,
  title,
  detail,
  state,
}: {
  icon: typeof ShieldCheck;
  title: string;
  detail: string;
  state: 'Ready' | 'Located' | 'Partial' | 'Pending';
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
      <Icon className="size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={state === 'Ready' ? 'secondary' : 'outline'}>{state}</Badge>
    </div>
  );
}
