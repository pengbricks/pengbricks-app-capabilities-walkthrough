import { describe, expect, it } from 'vitest';
import { categories } from '../data/guides.ts';
import { areaSlug, categoryFromSlug } from './deepLinks.ts';

describe('area deep links', () => {
  it('gives every area a unique slug that maps back to it', () => {
    const slugs = categories.map(areaSlug);
    expect(new Set(slugs).size).toBe(categories.length);
    for (const category of categories) expect(categoryFromSlug(areaSlug(category))).toBe(category);
  });

  it('uses readable slugs', () => {
    expect(areaSlug('CI/CD & Version Control Guides')).toBe('ci-cd-and-version-control');
    expect(areaSlug('Governance/Monitoring')).toBe('governance-monitoring');
    expect(areaSlug('Data Engineering Guides')).toBe('data-engineering');
    expect(categoryFromSlug('nope')).toBeNull();
  });
});
