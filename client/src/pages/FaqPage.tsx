import { Button, Card, CardContent, Input } from '@databricks/appkit-ui/react';
import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FaqItem } from '../components/FaqList.tsx';
import { HeadingLink } from '../components/HeadingLink.tsx';
import { faqGroups } from '../data/faqs/index.ts';
import type { Faq } from '../data/faqs/types.ts';
import { areaSlug } from '../lib/deepLinks.ts';

const matches = (faq: Faq, needle: string) =>
  `${faq.question} ${faq.answer} ${(faq.links ?? []).map((link) => link.label).join(' ')}`
    .toLowerCase()
    .includes(needle);

export function FaqPage() {
  // The search lives in the URL (?q=), like the home page filters.
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const needle = query.trim().toLowerCase();
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const total = useMemo(
    () => faqGroups.reduce((n, area) => n + area.guides.reduce((m, g) => m + g.faqs.length, 0), 0),
    []
  );
  const groups = useMemo(
    () =>
      faqGroups
        .map((area) => ({
          ...area,
          guides: area.guides
            .map((group) => ({
              ...group,
              // Keep each question's original index so its anchor id stays the same while filtering.
              items: group.faqs
                .map((faq, index) => ({ faq, index }))
                .filter(({ faq }) => !needle || matches(faq, needle)),
            }))
            .filter((group) => group.items.length > 0),
        }))
        .filter((area) => area.guides.length > 0),
    [needle]
  );
  const shown = groups.reduce((n, area) => n + area.guides.reduce((m, g) => m + g.items.length, 0), 0);

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 lg:px-8 lg:py-14">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Questions</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Questions people ask while working through the guides, answered from the guides themselves. Each group links
          to its guide, and each question has its own link.
        </p>
        <label htmlFor="faq-search" className="mt-6 block text-sm font-semibold">
          Search questions
        </label>
        <div className="relative mt-1.5 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="faq-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A word from the question or answer"
            className="h-11 pl-9"
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          Showing {shown} of {total} questions
        </p>
      </header>

      {groups.length === 0 ? (
        <Card className="mt-10 border-dashed shadow-none">
          <CardContent className="flex min-h-40 flex-col items-center justify-center text-center">
            <h2 className="font-semibold">No questions found</h2>
            <p className="mt-1 text-sm text-muted-foreground">Try a different word or clear the search.</p>
            {query && (
              <Button variant="outline" className="mt-5" onClick={() => setQuery('')}>
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        groups.map((area) => {
          const areaId = `faq-area-${areaSlug(area.area)}`;
          return (
            <section key={area.area} className="mt-10" aria-labelledby={areaId}>
              <h2 id={areaId} className="group scroll-mt-20 text-2xl font-bold tracking-tight">
                {area.area}
                <HeadingLink id={areaId} label={area.area} />
              </h2>
              {area.guides.map(({ guide, items }) => {
                const guideId = `faq-guide-${guide.slug}`;
                return (
                  <section key={guide.slug} className="faq-group" aria-labelledby={guideId}>
                    <h3 id={guideId} className="scroll-mt-20 text-lg font-semibold">
                      <Link to={`/guides/${guide.slug}`} className="underline-offset-4 hover:underline">
                        {guide.title}
                      </Link>
                    </h3>
                    <div className="faq-list">
                      {items.map(({ faq, index }) => (
                        <FaqItem key={index} slug={guide.slug} index={index} faq={faq} forceOpen={needle.length > 0} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </section>
          );
        })
      )}
    </div>
  );
}
