import { describe, expect, it } from 'vitest';
import { categories, difficulties, getGuide, guides } from './guides.ts';

describe('guide catalog', () => {
  it('defines a unique one-pager route for every guide', () => {
    const slugs = guides.map((guide) => guide.slug);

    expect(guides).toHaveLength(54);
    expect(new Set(slugs).size).toBe(guides.length);
    expect(guides.every((guide) => guide.evidence.length >= 3)).toBe(true);
  });

  it('uses only supported capability domains', () => {
    expect(guides.every((guide) => categories.includes(guide.category))).toBe(true);
  });

  it('rates every guide from 1 to 5 and starts each foundations topic at 1', () => {
    expect(guides.every((guide) => difficulties.includes(guide.difficulty))).toBe(true);
    for (const slug of ['how-databricks-works', 'unity-catalog-basics', 'medallion-architecture']) {
      expect(getGuide(slug)?.difficulty).toBe(1);
    }
    for (const level of difficulties) expect(guides.some((guide) => guide.difficulty === level)).toBe(true);
  });

  it('resolves a guide by slug', () => {
    expect(getGuide('configuration-vs-code')?.title).toBe('Metadata-driven ingestion');
  });

  it('groups ingestion framework guides together', () => {
    expect(getGuide('configuration-vs-code')?.category).toBe('Ingestion');
    expect(getGuide('reusability-templatization')?.category).toBe('Ingestion');
    expect(getGuide('batch-real-time-ingestion')?.category).toBe('Ingestion');
    expect(getGuide('data-ingestion-feature-preparation')?.category).toBe('Ingestion');
  });
});
