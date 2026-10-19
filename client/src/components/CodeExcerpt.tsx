import { ArrowUpRight } from 'lucide-react';
import type { CodeHighlight } from '../lib/artifacts.ts';
import { CodeBlock } from './CodeBlock.tsx';

/** One excerpt of reference code: label, path, notes, the highlighted code, and a GitHub link. */
export function CodeExcerpt({ highlight }: { highlight: CodeHighlight }) {
  return (
    <figure className="overflow-hidden rounded-xl border bg-card">
      <figcaption className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{highlight.label}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {highlight.path}
            {highlight.symbol ? ` · ${highlight.symbol}` : ''}
          </p>
        </div>
        <a
          href={highlight.url}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 text-xs hover:underline"
          aria-label={`View ${highlight.label} on GitHub`}
        >
          GitHub
          <ArrowUpRight className="size-3" />
        </a>
      </figcaption>
      {highlight.notes.length > 0 && (
        <ul className="list-disc space-y-1 border-b px-4 py-3 pl-8 text-xs leading-5 text-muted-foreground">
          {highlight.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      <CodeBlock code={highlight.code} language={highlight.language} functions={highlight.functions} />
    </figure>
  );
}
