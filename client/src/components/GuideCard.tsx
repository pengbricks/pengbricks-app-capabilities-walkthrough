import { Card, CardContent, CardFooter, CardHeader } from '@databricks/appkit-ui/react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Guide } from '../data/guides.ts';

export function GuideCard({ guide, number }: { guide: Guide; number: number }) {
  return (
    <Card className="group relative flex h-full flex-col rounded-lg shadow-none transition-colors hover:border-foreground">
      <CardHeader className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-muted-foreground">{String(number).padStart(2, '0')}</span>
          <span className="text-xs text-muted-foreground">{guide.category}</span>
        </div>
        <h3 className="text-xl font-semibold leading-snug tracking-tight">{guide.title}</h3>
      </CardHeader>
      <CardContent className="flex-1 px-5 pb-5">
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{guide.acceptanceCriteria}</p>
      </CardContent>
      <CardFooter className="mx-5 flex items-center gap-3 border-t px-0 py-4 text-sm">
        <span className="size-2 rounded-full border border-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">Run not linked</span>
        <span className="ml-auto text-xs text-muted-foreground">{guide.evidence.length} artifacts</span>
        <Link
          to={`/guides/${guide.slug}`}
          className="after:absolute after:inset-0"
          aria-label={`Open ${guide.title} guide`}
        >
          <ArrowRight className="brand-mark size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
