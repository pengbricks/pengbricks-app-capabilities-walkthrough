import type { Walkthrough } from './types.ts';

// Every <guide-slug>.ts file in this folder exports `walkthrough`; files are picked up automatically.
const modules = import.meta.glob<{ walkthrough: Walkthrough }>(['./*.ts', '!./index.ts', '!./types.ts', '!./*.test.ts'], {
  eager: true,
});

export const walkthroughs: Walkthrough[] = Object.values(modules)
  .map((module) => module.walkthrough)
  .sort((a, b) => a.slug.localeCompare(b.slug));

const bySlug = new Map(walkthroughs.map((walkthrough) => [walkthrough.slug, walkthrough]));

export function getWalkthrough(slug: string | undefined): Walkthrough | undefined {
  return slug ? bySlug.get(slug) : undefined;
}
