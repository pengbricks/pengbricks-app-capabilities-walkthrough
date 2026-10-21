import { Check, Link2 } from 'lucide-react';
import { useState } from 'react';

// A small link next to a heading: it points at the heading's anchor and copies the full URL.
export function HeadingLink({ id, label }: { id: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <a
      href={`#${id}`}
      aria-label={`Copy link to ${label}`}
      title="Copy link"
      className="heading-link ml-2 inline-flex align-middle text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
      onClick={(event) => {
        event.preventDefault();
        const url = new URL(window.location.href);
        url.hash = id;
        window.history.replaceState(null, '', url);
        void navigator.clipboard?.writeText(url.toString()).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
    </a>
  );
}
