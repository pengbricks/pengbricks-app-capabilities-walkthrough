import { describe, expect, it } from 'vitest';
import { getSrpDemo, srpDemos } from './srpDemos.ts';

describe('SRP demo specifications', () => {
  it('defines eight unique standalone demo modules', () => {
    const slugs = srpDemos.map((demo) => demo.slug);

    expect(srpDemos).toHaveLength(8);
    expect(new Set(slugs).size).toBe(srpDemos.length);
  });

  it('keeps run status pending until real evidence is connected', () => {
    expect(srpDemos.every((demo) => demo.runState === 'Pending')).toBe(true);
  });

  it('includes capabilities, steps, acceptance artifacts, and source references', () => {
    expect(
      srpDemos.every(
        (demo) =>
          demo.capabilities.length >= 4 &&
          demo.sequence.length >= 4 &&
          demo.acceptance.length >= 3 &&
          demo.references.length >= 2
      )
    ).toBe(true);
    expect(getSrpDemo('quality-and-quarantine')?.codeState).toBe('Partial');
  });
});
