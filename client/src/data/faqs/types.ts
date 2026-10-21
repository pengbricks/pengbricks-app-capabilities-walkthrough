// Questions people ask about a guide, answered from the guide itself.
// Each guide's questions live in faqs/<guide-slug>.ts and export `faqs`. A topic that spans guides
// (listed in topics.ts) uses the same shape in faqs/<topic-slug>.ts.

export type FaqLink = { label: string; url: string };

// decision: which option to choose and when. tradeoff: what an option costs or gives up.
export type FaqKind = 'decision' | 'tradeoff';

export type Faq = {
  kind?: FaqKind;
  question: string;
  answer: string;
  // Docs pages, or another guide as /guides/<slug> or /walkthroughs/<slug>.
  links?: FaqLink[];
};
