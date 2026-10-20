import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@databricks/appkit-ui/react';
import { ArrowUpRight, Loader2, Power, PowerOff, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadGateway, setGateway, type GatewayState } from '../lib/artifacts.ts';

const POLL_MS = 10000;

/** Turns a guide's ingestion gateway, the one part on classic compute, on and off. */
export function GatewayControl({ slug }: { slug: string }) {
  const [gateway, setGatewayState] = useState<GatewayState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGateway(slug)
      .then(setGatewayState)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Gateway status is unavailable'));
  }, [slug]);

  // Poll while the cluster is starting or stopping, so the badge settles on its own.
  useEffect(() => {
    if (!gateway?.transitioning) return;
    const timer = window.setTimeout(() => {
      loadGateway(slug)
        .then(setGatewayState)
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Gateway status is unavailable'));
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [slug, gateway]);

  async function toggle(action: 'start' | 'stop') {
    setPending(true);
    setError(null);
    try {
      setGatewayState(await setGateway(slug, action));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Gateway ${action} failed`);
    } finally {
      setPending(false);
    }
  }

  const label = gateway ? describe(gateway) : 'checking';

  return (
    <Card className="mt-10 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="size-5" />
          Ingestion gateway cluster
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          The gateway is the only part of this guide on classic compute, and it bills while it runs. Turn it on before
          the demo; the cluster takes a few minutes to start. Turn it off after. If it stays off longer than the
          source&apos;s CDC or Change Tracking retention, the affected tables need a full refresh.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={gateway?.state === 'RUNNING' ? 'secondary' : 'outline'} className="gap-1">
            {(!gateway || gateway.transitioning) && !error ? <Loader2 className="size-3 animate-spin" /> : null}
            {label}
          </Badge>
          {gateway && (
            <a
              href={gateway.pipelineUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-sm underline-offset-2 hover:underline"
            >
              Open {gateway.name}
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void toggle('start')} disabled={pending || !gateway || gateway.on}>
            {pending && !gateway?.on ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
            Turn on
          </Button>
          <Button
            variant="outline"
            onClick={() => void toggle('stop')}
            disabled={pending || !gateway || !gateway.on || gateway.state === 'STOPPING'}
          >
            {pending && gateway?.on ? <Loader2 className="size-4 animate-spin" /> : <PowerOff className="size-4" />}
            Turn off
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function describe(gateway: GatewayState): string {
  if (gateway.state === 'RUNNING') return 'on';
  if (gateway.state === 'STOPPING') return 'turning off';
  if (gateway.on) return `starting (${(gateway.updateState ?? gateway.state).toLowerCase().replace(/_/g, ' ')})`;
  return gateway.state === 'FAILED' ? 'failed' : 'off';
}
