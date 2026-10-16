import { Button, Card, CardContent, Input } from '@databricks/appkit-ui/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GuideCard } from '../components/GuideCard.tsx';
import { categories, guides } from '../data/guides.ts';

const allCategories = 'All guides';

const categoryBlurbs = {
  'CI/CD & Version Control Guides': 'Author, test, version, and promote the same release with automation and approval.',
  'Governance/Monitoring': 'Make runs, lineage, quality, cost, access, and operational ownership observable.',
  'AI Guides': 'Build governed user and agent experiences with transparent tools, identity, and model routing.',
  'ML Guides': 'Prepare features, train, track, release, serve, and monitor models reproducibly.',
  Ingestion: 'Onboard sources through reusable batch, streaming, quality, and medallion patterns.',
  'General Guides': 'Demonstrate open formats, integrations, migration, and cross-platform patterns.',
  'Data Engineering Guides': 'Transform, capture changes, load targets, orchestrate jobs, and watch for drift.',
  'Analyst Guides': 'Explore, upload, prepare, chart, and export governed data with or without code.',
} satisfies Record<(typeof categories)[number], string>;

export function HomePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(allCategories);

  const filteredGuides = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return guides.filter((guide) => {
      const categoryMatches = category === allCategories || guide.category === category;
      const queryMatches =
        normalizedQuery.length === 0 ||
        `${guide.title} ${guide.summary} ${guide.acceptanceCriteria}`.toLowerCase().includes(normalizedQuery);
      return categoryMatches && queryMatches;
    });
  }, [category, query]);

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8 lg:py-14">
      <section className="border-b pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Platform guides</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
          Databricks capability walkthrough
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          One page per guide: what to demonstrate, which Databricks capabilities apply, and the reference implementation
          behind it.
        </p>
      </section>

      <section id="guide-library" className="scroll-mt-20 pt-10 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <label htmlFor="guide-search" className="text-sm font-semibold">
            Search guides
          </label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="guide-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, criterion, or capability"
              className="h-11 pl-9"
            />
          </div>

          <nav className="mt-5" aria-label="Filter guides by area">
            <ul className="flex flex-col gap-0.5">
              {[allCategories, ...categories].map((item) => {
                const count =
                  item === allCategories ? guides.length : guides.filter((guide) => guide.category === item).length;
                const active = category === item;
                return (
                  <li key={item}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategory(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      {item}
                      <span className="tabular-nums opacity-70">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="mt-6 lg:mt-0">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Showing {filteredGuides.length} of {guides.length} guides
          </p>

          {filteredGuides.length > 0 ? (
            categories.map((area) => {
              const areaGuides = filteredGuides.filter((guide) => guide.category === area);
              if (areaGuides.length === 0) return null;
              const sectionId = `area-${area.replaceAll(' ', '-').replaceAll('/', '-').toLowerCase()}`;

              return (
                <section key={area} className="mt-10" aria-labelledby={sectionId}>
                  <div className="mb-4">
                    <h2 id={sectionId} className="text-2xl font-bold tracking-tight">
                      {area}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{categoryBlurbs[area]}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {areaGuides.map((guide) => (
                      <GuideCard key={guide.slug} guide={guide} />
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <Card className="mt-10 border-dashed shadow-none">
              <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
                <Search className="size-8 text-muted-foreground" />
                <h2 className="mt-4 font-semibold">No guides found</h2>
                <p className="mt-1 text-sm text-muted-foreground">Try a product name or clear the current filters.</p>
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setQuery('');
                    setCategory(allCategories);
                  }}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
