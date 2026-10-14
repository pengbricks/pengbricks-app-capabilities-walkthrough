import { Card, CardContent, CardFooter, CardHeader } from '@databricks/appkit-ui/react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Guide } from '../data/guides.ts';
import guideUpdates from '../data/guideUpdates.json';

export function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Card className="group relative flex h-full flex-col rounded-lg shadow-none transition-colors hover:border-foreground">
      <CardHeader className="p-5">
        <h3 className="text-xl font-semibold leading-snug tracking-tight">{guide.title}</h3>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-5">
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{guide.acceptanceCriteria}</p>
      </CardContent>
      <CardFooter className="mx-5 flex items-center gap-3 border-t px-0 py-4 text-sm">
        <span className="text-xs text-muted-foreground">Last updated {formatUpdated(guide.slug)}</span>
        <Link
          to={`/guides/${guide.slug}`}
          className="ml-auto after:absolute after:inset-0"
          aria-label={`Open ${guide.title} guide`}
        >
          <ArrowRight className="brand-mark size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}

const updates: Record<string, string> = guideUpdates;

function formatUpdated(slug: string): string {
  const date = updates[slug] ?? updates['*'];
  if (!date) return 'unknown';
  // Dates are calendar days from Git; format them in UTC so they never shift a day.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
