import { describe, expect, it } from 'vitest';
import { describeFunction, guessLanguage, tokenize } from './highlight.ts';

const typesOf = (code: string, language: string) =>
  tokenize(code, language)
    .filter((token) => token.type !== 'plain')
    .map((token) => [token.type, token.text]);

describe('tokenize', () => {
  it('marks R comments, assignment, keywords, and calls', () => {
    expect(typesOf('# summary\nlibrary(sparklyr)\nx <- TRUE', 'r')).toEqual([
      ['comment', '# summary'],
      ['keyword', 'library'],
      ['keyword', '<-'],
      ['keyword', 'TRUE'],
    ]);
  });

  it('marks shell commands, flags, and strings', () => {
    expect(typesOf('databricks bundle run job --target dev -p "my profile"', 'bash')).toEqual([
      ['function', 'databricks'],
      ['key', '--target'],
      ['key', '-p'],
      ['string', '"my profile"'],
    ]);
  });

  it('marks INI sections and keys, including .example files', () => {
    expect(typesOf('[Databricks]\nHost=example\n; note', 'example')).toEqual([
      ['keyword', '[Databricks]'],
      ['key', 'Host'],
      ['comment', '; note'],
    ]);
  });

  it('marks Python comments, strings, keywords, definitions, and calls', () => {
    const code = 'def run(x):\n    # validate first\n    return split_valid(x, "rules")';
    expect(typesOf(code, 'py')).toEqual([
      ['keyword', 'def'],
      ['function', 'run'],
      ['comment', '# validate first'],
      ['keyword', 'return'],
      ['function', 'split_valid'],
      ['string', '"rules"'],
    ]);
  });

  it('keeps a # inside a string out of comments', () => {
    expect(typesOf('x = "a # b"', 'py')).toEqual([['string', '"a # b"']]);
  });

  it('marks SQL comments, keywords, and function calls case-insensitively', () => {
    expect(typesOf("-- latency\nSELECT percentile_approx(x, 0.5) FROM t WHERE s = 'ok'", 'sql')).toEqual([
      ['comment', '-- latency'],
      ['keyword', 'SELECT'],
      ['function', 'percentile_approx'],
      ['number', '0.5'],
      ['keyword', 'FROM'],
      ['keyword', 'WHERE'],
      ['string', "'ok'"],
    ]);
  });

  it('marks YAML keys, comments, and substitutions', () => {
    expect(typesOf('# job\nmax_retries: 2\nschema: ${var.schema}', 'yml')).toEqual([
      ['comment', '# job'],
      ['key', 'max_retries'],
      ['number', '2'],
      ['key', 'schema'],
      ['function', '${var.schema}'],
    ]);
  });

  it('reassembles to the original text', () => {
    const code = 'def f():\n    return g("x")  # done\n';
    expect(
      tokenize(code, 'py')
        .map((token) => token.text)
        .join(''),
    ).toBe(code);
  });
});

describe('describeFunction', () => {
  it('prefers reference-code docstrings over built-in descriptions', () => {
    expect(describeFunction('sql', { sql: 'local' })).toBe('local');
    expect(describeFunction('read_files', {})).toContain('Auto Loader');
    expect(describeFunction('unknown', {})).toBeUndefined();
  });
});

describe('guessLanguage', () => {
  it('picks a language for snippets without a file extension', () => {
    expect(guessLanguage('SELECT * FROM t')).toBe('sql');
    expect(guessLanguage('databricks bundle deploy')).toBe('sh');
    expect(guessLanguage('{"a": 1}')).toBe('json');
    expect(guessLanguage('w.jobs.run_now(job_id)')).toBe('py');
  });
});
