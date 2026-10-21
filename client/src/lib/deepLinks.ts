import { categories, type GuideCategory } from '../data/guides.ts';

// URL slugs for guide areas, so other apps can link to one area: /capability-guides/?area=ingestion
export function areaSlug(category: GuideCategory): string {
  return category
    .replace(/ Guides$/, '')
    .replace(/&/g, 'and')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function categoryFromSlug(slug: string | null): GuideCategory | null {
  if (!slug) return null;
  return categories.find((category) => areaSlug(category) === slug.toLowerCase()) ?? null;
}
