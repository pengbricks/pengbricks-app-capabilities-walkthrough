// Questions people ask about a guide, answered from the guide itself.
// Each guide's questions live in faqs/<guide-slug>.ts and export `faqs`.

export type FaqLink = { label: string; url: string };

export type Faq = {
  question: string;
  answer: string;
  // Docs pages, or another guide as /guides/<slug> or /walkthroughs/<slug>.
  links?: FaqLink[];
};
