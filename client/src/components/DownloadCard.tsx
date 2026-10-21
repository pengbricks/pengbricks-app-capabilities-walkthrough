import { Button, Card, CardContent } from '@databricks/appkit-ui/react';
import { Check, Copy, Download, Github, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { downloadUrl, type GuideDownload } from '../lib/artifacts.ts';

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Offers the guide's starter bundle: from its public Git repository when it has one, else as a zip built into the app. */
export function DownloadCard({ slug, download }: { slug: string; download: GuideDownload }) {
  const [copied, setCopied] = useState(false);
  const fromGit = Boolean(download.repoUrl);
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <PackageOpen className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Starter bundle</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {fromGit
                  ? 'Everything you need to run this guide on your own. Clone the repository to pull updates later, or download it as a zip. It needs only a catalog you can create a schema in.'
                  : 'Everything you need to run this guide on your own. Unzip it, push it to your Git repo, and follow the steps below. It needs only a catalog you can create a schema in.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {download.repoUrl && (
              <Button variant="outline" asChild>
                <a href={download.repoUrl} target="_blank" rel="noreferrer">
                  <Github className="size-4" />
                  View on GitHub
                </a>
              </Button>
            )}
            <Button asChild>
              <a href={download.url ?? downloadUrl(slug)} download={fromGit ? undefined : download.filename}>
                <Download className="size-4" />
                Download the starter bundle
                <span className="font-normal opacity-80">
                  {download.filename}
                  {download.sizeBytes ? `, ${formatSize(download.sizeBytes)}` : ''}
                </span>
              </a>
            </Button>
          </div>
        </div>
        {download.clone && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">{download.clone}</code>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Copy the clone command"
              onClick={() => {
                void navigator.clipboard?.writeText(download.clone ?? '').then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
