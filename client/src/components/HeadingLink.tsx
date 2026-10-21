import { Check, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router';

// A small link next to a heading: it points at the heading's anchor and copies the full URL.
// Inside a wrapper iframe it also posts { type: 'child-copy-link', path } so the wrapper can copy its
// own outer URL instead; that copy lands after this one, so it wins when the wrapper handles it.
export function HeadingLink({ id, label }: { id: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { pathname, search } = useLocation();
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
        const done = () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        };
        void navigator.clipboard?.writeText(url.toString()).then(done, done);
        if (window.parent !== window) {
          const params = new URLSearchParams(search);
          params.delete('embed');
          const query = params.toString();
          window.parent.postMessage({ type: 'child-copy-link', path: `${pathname}${query ? `?${query}` : ''}#${id}` }, '*');
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
    </a>
  );
}
