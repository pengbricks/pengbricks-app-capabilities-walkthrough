import { Button, Card, CardContent, Input } from '@databricks/appkit-ui/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DifficultyStars } from '../components/DifficultyStars.tsx';
import { GuideCard } from '../components/GuideCard.tsx';
import { categories, difficulties, guides, type Difficulty, type Guide } from '../data/guides.ts';
import { learningPath, learningStep } from '../data/learningPath.ts';

const allCategories = 'All guides';

const categoryBlurbs = {
  Foundations:
    'Start here: how the lakehouse separates storage and compute, how Unity Catalog names and governs data, and the medallion layers.',
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
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  // The view lives in the URL (?view=path) so a link can open straight into the learning path.
  const [params, setParams] = useSearchParams();
  const pathView = params.get('view') === 'path';
  const setPathView = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set('view', 'path');
    else next.delete('view');
    setParams(next, { replace: true });
  };

  const filteredGuides = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return guides.filter((guide) => {
      const categoryMatches = category === allCategories || guide.category === category;
      const difficultyMatches = difficulty === null || guide.difficulty === difficulty;
      const queryMatches =
        normalizedQuery.length === 0 ||
        `${guide.title} ${guide.summary} ${guide.acceptanceCriteria}`.toLowerCase().includes(normalizedQuery);
      return categoryMatches && difficultyMatches && queryMatches;
    });
  }, [category, difficulty, query]);

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-10 lg:px-8 lg:py-14">

      <section id="guide-library" className="scroll-mt-20 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
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

          <nav className="mt-6" aria-label="Filter guides by difficulty">
            <p className="px-3 text-sm font-semibold">Difficulty</p>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {difficulties.map((level) => {
                const active = difficulty === level;
                return (
                  <li key={level}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDifficulty(active ? null : level)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-muted font-medium ring-1 ring-foreground/20' : 'hover:bg-muted'}`}
                    >
                      <DifficultyStars value={level} />
                      <span className="tabular-nums opacity-70">
                        {guides.filter((guide) => guide.difficulty === level).length}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="mt-6 lg:mt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {filteredGuides.length} of {guides.length} guides
            </p>
            <div role="group" aria-label="Order guides" className="inline-flex rounded-full border p-0.5 text-sm">
              {[
                { on: false, label: 'By area' },
                { on: true, label: 'Learning path' },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={pathView === option.on}
                  onClick={() => setPathView(option.on)}
                  className={`rounded-full px-3.5 py-1.5 transition-colors ${pathView === option.on ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {filteredGuides.length > 0 && pathView ? (
            <PathView guides={filteredGuides} />
          ) : filteredGuides.length > 0 ? (
            categories.map((area) => {
              // Easiest first within each area; sort is stable, so equal ratings keep catalog order.
              const areaGuides = filteredGuides
                .filter((guide) => guide.category === area)
                .sort((a, b) => a.difficulty - b.difficulty);
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
                    setDifficulty(null);
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

// Guides in learning order, grouped by stage. Filters still apply; a stage with no matches is hidden.
function PathView({ guides: visible }: { guides: Guide[] }) {
  const bySlug = new Map(visible.map((guide) => [guide.slug, guide]));
  return (
    <>
      {learningPath.map((stage, index) => {
        const stageGuides = stage.slugs.flatMap((slug) => bySlug.get(slug) ?? []);
        if (stageGuides.length === 0) return null;
        const sectionId = `stage-${index + 1}`;
        return (
          <section key={stage.title} className="mt-10" aria-labelledby={sectionId}>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Stage {index + 1}</p>
              <h2 id={sectionId} className="mt-1 text-2xl font-bold tracking-tight">
                {stage.title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{stage.summary}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {stageGuides.map((guide) => (
                <GuideCard key={guide.slug} guide={guide} step={learningStep.get(guide.slug)} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
