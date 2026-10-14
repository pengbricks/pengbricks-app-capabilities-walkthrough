import { useCallback, useEffect, useState } from 'react';

export type ArtifactLink = { label: string; url: string };

export type CodeHighlight = {
  label: string;
  notes: string[];
  path: string;
  symbol: string | null;
  language: string;
  code: string;
  url: string;
};

export type JobRun = {
  runId: number;
  url: string;
  lifeCycleState: string | null;
  resultState: string | null;
  trigger: string | null;
  startTime: string | null;
};

export type GuideJob = {
  key: string;
  label: string;
  deployed: boolean;
  jobId?: number;
  jobUrl?: string;
  runs: JobRun[];
};

export type RecordedRun = { label: string; url: string; workspace: string; recordedAt: string };

export type HistoryRow = {
  run_id: number;
  job_key: string;
  run_url: string;
  life_cycle_state: string | null;
  result_state: string | null;
  triggered_via: string;
  started_at: string | null;
};

export type GuideArtifacts = {
  slug: string;
  onePagerUrl: string;
  bundleUrl: string;
  code: ArtifactLink[];
  docs: ArtifactLink[];
  walkthroughs: ArtifactLink[];
  autoLoaderDrop: boolean;
  highlights: CodeHighlight[];
  jobs: GuideJob[];
  recordedRuns: RecordedRun[];
  live: boolean;
  liveError?: string;
  tracking: 'lakebase' | 'jobs-api';
  trackingDetail?: string;
  history: HistoryRow[];
};

const API = '/api/capability-guides/artifacts';

export function runStatus(run: Pick<JobRun, 'lifeCycleState' | 'resultState'>): string {
  return run.resultState ?? run.lifeCycleState ?? 'UNKNOWN';
}

export function latestSuccessfulRun(job: GuideJob): JobRun | undefined {
  return job.runs.find((run) => run.resultState === 'SUCCESS');
}

export function useGuideArtifacts(slug: string | undefined) {
  const [data, setData] = useState<GuideArtifacts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planned, setPlanned] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const response = await fetch(`${API}/${slug}`);
      if (response.status === 404) {
        setPlanned(true);
        return;
      }
      if (!response.ok) throw new Error(`Artifacts request failed (${response.status})`);
      setData((await response.json()) as GuideArtifacts);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Artifacts are unavailable');
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, planned, reload: load };
}

export async function startQuickRun(slug: string, jobKey: string): Promise<JobRun> {
  const response = await fetch(`${API}/${slug}/quick-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobKey }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Quick run failed (${response.status})`);
  }
  return (await response.json()) as JobRun;
}

export type DropSample = { label: string; path: string; content: string };

export type DropResult = {
  path: string;
  records: number;
  pipelineUrl: string;
  updateId?: string;
  updateUrl?: string;
  note?: string;
};

export type FlowMetrics = {
  flow: string;
  rowsWritten: number | null;
  droppedRecords: number | null;
  expectations: { name: string; passed: number | null; failed: number | null }[];
};

export type DropStatus = { state: string; flows: FlowMetrics[] };

async function errorDetail(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { detail?: string };
  return body.detail ?? `${fallback} (${response.status})`;
}

export async function loadDropSamples(slug: string): Promise<DropSample[] | null> {
  const response = await fetch(`${API}/${slug}/drop`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await errorDetail(response, 'Samples are unavailable'));
  return ((await response.json()) as { samples: DropSample[] }).samples;
}

export async function dropDocument(slug: string, content: string): Promise<DropResult> {
  const response = await fetch(`${API}/${slug}/drop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error(await errorDetail(response, 'Drop failed'));
  return (await response.json()) as DropResult;
}

export async function dropStatus(slug: string, updateId: string): Promise<DropStatus> {
  const response = await fetch(`${API}/${slug}/drop/updates/${updateId}`);
  if (!response.ok) throw new Error(await errorDetail(response, 'Status is unavailable'));
  return (await response.json()) as DropStatus;
}
