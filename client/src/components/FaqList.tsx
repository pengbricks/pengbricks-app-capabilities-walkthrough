import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { faqId } from '../data/faqs/index.ts';
import type { Faq, FaqKind } from '../data/faqs/types.ts';

const kindLabel: Record<FaqKind, string> = { decision: 'Decision', tradeoff: 'Tradeoff' };

// One question as a disclosure. It opens when the URL hash points at it (or when forceOpen is set,
// for search results), and ScrollToHash handles the scrolling.
export function FaqItem({
  slug,
  index,
  faq,
  forceOpen = false,
}: {
  slug: string;
  index: number;
  faq: Faq;
  forceOpen?: boolean;
}) {
  const id = faqId(slug, index);
  const ref = useRef<HTMLDetailsElement>(null);
  const { hash } = useLocation();
  useEffect(() => {
    if (ref.current && hash === `#${id}`) ref.current.open = true;
  }, [hash, id]);
  useEffect(() => {
    if (ref.current && forceOpen) ref.current.open = true;
  }, [forceOpen]);
  return (
    <details ref={ref} id={id} className="faq-item">
      <summary>
        {faq.kind && <span className={`faq-kind faq-kind-${faq.kind}`}>{kindLabel[faq.kind]}</span>}
        {faq.question}
      </summary>
      <div className="faq-answer">
        <p>{faq.answer}</p>
        {faq.links && faq.links.length > 0 && (
          <ul className="faq-links">
            {faq.links.map((link) => (
              <li key={link.url}>
                {link.url.startsWith('/') ? (
                  <Link to={link.url}>{link.label}</Link>
                ) : (
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
