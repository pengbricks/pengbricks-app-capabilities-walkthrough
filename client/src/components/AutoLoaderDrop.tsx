import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@databricks/appkit-ui/react';
import { ArrowUpRight, FileUp, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  dropDocument,
  dropStatus,
  loadDropSamples,
  type DropResult,
  type DropSample,
  type DropStatus,
} from '../lib/artifacts.ts';

const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'CANCELED']);
const POLL_MS = 5000;

export function AutoLoaderDrop({ slug }: { slug: string }) {
  const [samples, setSamples] = useState<DropSample[] | null>(null);
  const [content, setContent] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DropResult | null>(null);
  const [status, setStatus] = useState<DropStatus | null>(null);

  useEffect(() => {
    loadDropSamples(slug)
      .then((loaded) => {
        setSamples(loaded);
        if (loaded?.[0]) setContent(prettify(loaded[0].content));
      })
      .catch(() => setSamples(null));
  }, [slug]);

  // Poll the pipeline update until it finishes, then show per-flow rows and expectation results.
  useEffect(() => {
    const updateId = result?.updateId;
    if (!updateId || (status && TERMINAL_STATES.has(status.state))) return;
    const timer = window.setTimeout(() => {
      dropStatus(slug, updateId)
        .then(setStatus)
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Status is unavailable'));
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [slug, result, status]);

  if (!samples) return null;

  async function drop() {
    setPending(true);
    setError(null);
    setResult(null);
    setStatus(null);
    try {
      setResult(await dropDocument(slug, content));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Drop failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-10 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="size-5" />
          Drop a document into Auto Loader
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          The document is written to the pipeline&apos;s landing volume and a pipeline update starts. Auto Loader
          ingests only the new file, and the expectations decide whether the event reaches the silver table.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {samples.map((sample) => (
            <Button key={sample.path} size="sm" variant="outline" onClick={() => setContent(prettify(sample.content))}>
              {sample.label}
            </Button>
          ))}
        </div>
        <label htmlFor="autoloader-document" className="sr-only">
          JSON document
        </label>
        <textarea
          id="autoloader-document"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-5"
        />
        <p className="text-xs text-muted-foreground">
          One JSON object or a list of up to 20. <code>event_ts</code> is set to the drop time when omitted.
        </p>
        <Button onClick={() => void drop()} disabled={pending || !content.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          Drop into Auto Loader
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="space-y-3 rounded-lg border p-4 text-sm">
            <p>
              Wrote {result.records} record{result.records === 1 ? '' : 's'} to{' '}
              <code className="break-all text-xs">{result.path}</code>
            </p>
            {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
            <div className="flex flex-wrap items-center gap-3">
              {result.updateUrl && <ExternalLink href={result.updateUrl} label="Watch the pipeline update" />}
              <ExternalLink href={result.pipelineUrl} label="Open the pipeline" />
              {result.updateId && (
                <Badge variant={status?.state === 'COMPLETED' ? 'secondary' : 'outline'} className="gap-1">
                  {!status || !TERMINAL_STATES.has(status.state) ? <Loader2 className="size-3 animate-spin" /> : null}
                  {status ? status.state.toLowerCase().replace(/_/g, ' ') : 'starting'}
                </Badge>
              )}
            </div>
            {status && status.flows.length > 0 && <FlowTable status={status} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FlowTable({ status }: { status: DropStatus }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-1 font-medium">Dataset</th>
          <th className="py-1 font-medium">Rows written</th>
          <th className="py-1 font-medium">Dropped</th>
          <th className="py-1 font-medium">Expectations (passed / failed)</th>
        </tr>
      </thead>
      <tbody>
        {status.flows.map((flow) => (
          <tr key={flow.flow} className="border-t">
            <td className="py-1.5 font-mono">{flow.flow}</td>
            <td className="py-1.5">{flow.rowsWritten ?? '–'}</td>
            <td className="py-1.5">{flow.droppedRecords ?? '–'}</td>
            <td className="py-1.5">
              {flow.expectations.length === 0
                ? '–'
                : flow.expectations.map((item) => `${item.name}: ${item.passed ?? 0} / ${item.failed ?? 0}`).join(', ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm underline-offset-2 hover:underline">
      {label}
      <ArrowUpRight className="size-3.5" />
    </a>
  );
}

function prettify(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}
