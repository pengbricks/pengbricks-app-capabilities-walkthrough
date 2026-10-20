import { Button, Card, CardContent } from '@databricks/appkit-ui/react';
import { Download, PackageOpen } from 'lucide-react';
import { downloadUrl, type GuideDownload } from '../lib/artifacts.ts';

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Offers the guide's bundle as a zip, built into the app at build time. */
export function DownloadCard({ slug, download }: { slug: string; download: GuideDownload }) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <PackageOpen className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Starter bundle</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Everything you need to run this guide on your own. Unzip it, push it to your Git repo, and follow the steps
              below. It needs only a catalog you can create a schema in.
            </p>
          </div>
        </div>
        <Button asChild>
          <a href={downloadUrl(slug)} download={download.filename}>
            <Download className="size-4" />
            Download the starter bundle
            <span className="font-normal opacity-80">
              {download.filename}, {formatSize(download.sizeBytes)}
            </span>
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
