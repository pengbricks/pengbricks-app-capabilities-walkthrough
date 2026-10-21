import { categories, guides, type Guide, type GuideCategory } from '../guides.ts';
import type { Faq } from './types.ts';

// Every faqs/<guide-slug>.ts exports `faqs`. Types, this file, and tests are not content.
const modules = import.meta.glob<{ faqs?: Faq[] }>(['./*.ts', '!./types.ts', '!./index.ts', '!./*.test.ts'], {
  eager: true,
});

export const faqsBySlug: Readonly<Record<string, readonly Faq[]>> = Object.fromEntries(
  Object.entries(modules).flatMap(([path, mod]) => {
    const slug = path.replace(/^\.\//, '').replace(/\.ts$/, '');
    return mod.faqs ? [[slug, mod.faqs]] : [];
  })
);

export function faqsFor(slug: string | undefined): readonly Faq[] {
  return (slug && faqsBySlug[slug]) || [];
}

/** Stable anchor for a question; n is 1-based. */
export function faqId(slug: string, index: number): string {
  return `${slug}-${index + 1}`;
}

export type FaqGuideGroup = { guide: Guide; faqs: readonly Faq[] };
export type FaqAreaGroup = { area: GuideCategory; guides: FaqGuideGroup[] };

/** Areas in home-page order; guides easiest first (stable, so ties keep catalog order). Guides without FAQs are left out. */
export const faqGroups: readonly FaqAreaGroup[] = categories
  .map((area) => ({
    area,
    guides: guides
      .filter((guide) => guide.category === area)
      .sort((a, b) => a.difficulty - b.difficulty)
      .map((guide) => ({ guide, faqs: faqsFor(guide.slug) }))
      .filter((group) => group.faqs.length > 0),
  }))
  .filter((group) => group.guides.length > 0);
