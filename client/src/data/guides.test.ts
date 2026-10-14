import { describe, expect, it } from 'vitest';
import { categories, getGuide, guides } from './guides.ts';

describe('guide catalog', () => {
  it('defines a unique one-pager route for every guide', () => {
    const slugs = guides.map((guide) => guide.slug);

    expect(guides).toHaveLength(25);
    expect(new Set(slugs).size).toBe(guides.length);
    expect(guides.every((guide) => guide.evidence.length >= 3)).toBe(true);
  });

  it('uses only supported capability domains', () => {
    expect(guides.every((guide) => categories.includes(guide.category))).toBe(true);
  });

  it('resolves a guide by slug', () => {
    expect(getGuide('configuration-vs-code')?.title).toBe('Configuration-driven ingestion');
  });

  it('groups ingestion framework guides together', () => {
    expect(getGuide('configuration-vs-code')?.category).toBe('Ingestion');
    expect(getGuide('reusability-templatization')?.category).toBe('Ingestion');
    expect(getGuide('batch-real-time-ingestion')?.category).toBe('Ingestion');
    expect(getGuide('data-ingestion-feature-preparation')?.category).toBe('Ingestion');
  });
});
