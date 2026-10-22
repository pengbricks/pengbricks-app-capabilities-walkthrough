// FAQ topics that span guides. Each topic's questions live in faqs/<slug>.ts, like a guide's.

export type FaqTopic = { slug: string; title: string; summary: string };

export const faqTopics: readonly FaqTopic[] = [];
