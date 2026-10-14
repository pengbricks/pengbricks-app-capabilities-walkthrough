import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Progress,
} from '@databricks/appkit-ui/react';
import { ArrowRight, Boxes, Database, GitBranch, Layers3, Route, ShieldAlert, Workflow } from 'lucide-react';
import { Link } from 'react-router';
import { SrpStatus } from '../components/SrpStatus.tsx';
import { srpDemos } from '../data/srpDemos.ts';

const architecture = [
  { title: 'Provider adapters', detail: 'Configurable sources and mappings', icon: Route },
  { title: 'Landing / Bronze', detail: 'Volumes · Auto Loader · Streaming tables', icon: Database },
  { title: 'Validation + quarantine', detail: 'Expectations · rescued data · replay', icon: ShieldAlert },
  { title: 'Silver / Gold', detail: 'Canonical model · materialized views', icon: Layers3 },
  { title: 'Operational evidence', detail: 'Jobs · event log · system tables', icon: Workflow },
];

export function SrpOverviewPage() {
  const locatedCount = srpDemos.filter((demo) => demo.codeState === 'Located' || demo.codeState === 'Partial').length;
  const verifiedRuns = srpDemos.filter((demo) => demo.runState === 'Ready').length;

  return (
    <div>
      <section className="hero-grid border-b">
        <div className="mx-auto max-w-[1440px] px-5 py-14 lg:px-8 lg:py-18">
          <Badge variant="secondary">Standalone reference walkthrough</Badge>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                SRP capability walkthrough
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                A provider-neutral path from configurable sources through reusable validation, medallion processing,
                orchestration, governance, and operational artifacts.
              </p>
            </div>
            <Card className="shadow-none">
              <CardContent className="grid grid-cols-3 gap-4 p-5 text-center">
                <Metric value={srpDemos.length.toString()} label="Demo specs" />
                <Metric value={locatedCount.toString()} label="Code located" />
                <Metric value={verifiedRuns.toString()} label="Verified runs" />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] space-y-12 px-5 py-10 lg:px-8 lg:py-14">
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>Specification workspace</AlertTitle>
          <AlertDescription>
            A reference example is not evidence of a successful run. Run status remains pending until a real Databricks
            resource, environment, release SHA, and terminal result are connected.
          </AlertDescription>
        </Alert>

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Reference architecture</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">One shared framework, thin provider edges</h2>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/guides/configuration-vs-code">Guide standard</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {architecture.map(({ title, detail, icon: Icon }, index) => (
              <Card key={title} className="relative shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Route className="size-5" />
                  Provider-specific
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <BoundaryItem text="Connection and source format" />
                <BoundaryItem text="Source schema and mappings" />
                <BoundaryItem text="Provider normalization adapter" />
                <BoundaryItem text="Feed thresholds and ownership" />
              </CardContent>
            </Card>
            <Card className="border-primary/20 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Boxes className="size-5" />
                  Shared and reused
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <BoundaryItem text="Validation and quarantine" />
                <BoundaryItem text="Audit and evidence capture" />
                <BoundaryItem text="Orchestration and retries" />
                <BoundaryItem text="Error model and notifications" />
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <div>
            <p className="text-sm font-medium text-primary">Guide modules</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Eight reusable artifact patterns</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              The current walkthrough stays dataset-neutral. Future tenants can attach custom datasets and provider
              mappings without changing the shared framework contract.
            </p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {srpDemos.map((demo) => (
              <Card
                key={demo.slug}
                className="group flex h-full flex-col shadow-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
              >
                <CardHeader>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <SrpStatus label="Spec" state={demo.specState} />
                    <SrpStatus label="Code" state={demo.codeState} />
                    <SrpStatus label="Run" state={demo.runState} />
                  </div>
                  <p className="text-xs text-muted-foreground">Maps to {demo.mappedGuide}</p>
                  <CardTitle className="text-lg leading-snug">{demo.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm leading-6 text-muted-foreground">{demo.summary}</p>
                  <div className="mt-5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Evidence completeness</span>
                      <span>Spec only</span>
                    </div>
                    <Progress value={33} className="mt-2" aria-label={`${demo.title} evidence completeness`} />
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4">
                  <Button variant="ghost" size="sm" className="-ml-3" asChild>
                    <Link to={`/demos/srp/${demo.slug}`}>
                      Open specification
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <Card className="overflow-hidden shadow-none">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                <GitBranch className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Evidence contract</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Every verified run artifact must record environment, owner, release SHA, resource IDs, timestamps, terminal
                  status, immutable code, and the actual Databricks run URL.
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/demos/srp/audit-and-monitoring">Review audit design</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BoundaryItem({ text }: { text: string }) {
  return <div className="rounded-lg border bg-background px-3 py-2.5">{text}</div>;
}
