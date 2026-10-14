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
  const tokens = withOffsets(tokenize(code, language));
  return (
    <pre className="code-block max-h-96 overflow-auto bg-muted/40 p-4 text-xs leading-5">
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
    </pre>
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
