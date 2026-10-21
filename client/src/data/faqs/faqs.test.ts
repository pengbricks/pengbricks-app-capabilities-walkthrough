import { describe, expect, it } from 'vitest';
import { guides } from '../guides.ts';
import { faqsBySlug } from './index.ts';

const slugs = new Set(guides.map((guide) => guide.slug));
const isValidUrl = (url: string) => {
  if (url.startsWith('https://')) return true;
  const match = /^\/(walkthroughs|guides)\/([a-z0-9-]+)$/.exec(url);
  return match !== null && slugs.has(match[2]);
};

describe('guide FAQs', () => {
  it('only has files named for real guide slugs', () => {
    expect(Object.keys(faqsBySlug).filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it('gives every guide at least 3 questions', () => {
    const short = guides.filter((guide) => (faqsBySlug[guide.slug]?.length ?? 0) < 3).map((guide) => guide.slug);
    expect(short).toEqual([]);
  });

  describe.each(Object.entries(faqsBySlug))('%s', (_slug, faqs) => {
    it('has questions ending in ? and non-empty answers', () => {
      for (const faq of faqs) {
        expect(faq.question.trim(), faq.question).not.toBe('');
        expect(faq.question.trim().endsWith('?'), faq.question).toBe(true);
        expect(faq.answer.trim(), faq.question).not.toBe('');
      }
    });

    it('uses only https, /walkthroughs/<slug>, or /guides/<slug> links', () => {
      const bad = faqs.flatMap((faq) => faq.links ?? []).filter((link) => !isValidUrl(link.url) || !link.label.trim());
      expect(bad).toEqual([]);
    });

    it('has no duplicate questions', () => {
      const questions = faqs.map((faq) => faq.question.trim().toLowerCase());
      expect(questions.length).toBe(new Set(questions).size);
    });
  });
});
