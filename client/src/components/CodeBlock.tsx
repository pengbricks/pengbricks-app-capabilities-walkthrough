import { describeFunction, tokenize } from '../lib/highlight.ts';

export function CodeBlock({
  code,
  language,
  functions,
}: {
  code: string;
  language: string;
  functions: Record<string, string>;
}) {
  return (
    <pre className="code-block max-h-96 overflow-auto bg-muted/40 p-4 text-xs leading-5">
      <HighlightedCode code={code} language={language} functions={functions} />
    </pre>
  );
}

/** Color-coded tokens for a code string; callers supply the surrounding <pre>. */
export function HighlightedCode({
  code,
  language,
  functions = {},
}: {
  code: string;
  language: string;
  functions?: Record<string, string>;
}) {
  const tokens = withOffsets(tokenize(code, language));
  return (
    <code>
      {tokens.map((token) => {
        if (token.type === 'plain') return token.text;
        const description = token.type === 'function' ? describeFunction(token.text, functions) : undefined;
        return (
          <span
            key={token.start}
            className={`tok-${token.type}${description ? ' tok-described' : ''}`}
            title={description}
          >
            {token.text}
          </span>
        );
      })}
    </code>
  );
}

function withOffsets<T extends { text: string }>(tokens: T[]): (T & { start: number })[] {
  const result: (T & { start: number })[] = [];
  let offset = 0;
  for (const token of tokens) {
    result.push({ ...token, start: offset });
    offset += token.text.length;
  }
  return result;
}
