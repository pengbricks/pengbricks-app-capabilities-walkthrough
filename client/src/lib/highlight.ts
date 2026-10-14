// Small syntax highlighter for the guide code excerpts (Python, SQL, YAML, JSON).
// It only needs to separate comments, strings, keywords, keys, numbers, and function names.

export type TokenType = 'comment' | 'string' | 'keyword' | 'key' | 'function' | 'number' | 'plain';
export type Token = { type: TokenType; text: string };

const PYTHON_KEYWORDS = new Set(
  'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(
    ' '
  )
);

const SQL_KEYWORDS = new Set(
  'select from where group by order having as and or not in is null case when then else end join left right inner outer on using with create replace refresh or table view materialized streaming stream constraint expect violation drop row comment insert into update set delete merge matched values limit distinct asc desc over partition qualify alter add column restore version of describe history grant to cast interval true false if exists all union'.split(
    ' '
  )
);

type Rule = { type: TokenType; pattern: RegExp };

const IDENT = '[A-Za-z_][A-Za-z0-9_]*';

const RULES: Record<string, Rule[]> = {
  py: [
    { type: 'comment', pattern: /#[^\n]*/y },
    { type: 'string', pattern: /[rbfuRBFU]{0,2}("""[\s\S]*?"""|'''[\s\S]*?''')/y },
    { type: 'string', pattern: /[rbfuRBFU]{0,2}("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/y },
    { type: 'number', pattern: /\b\d+(?:\.\d+)?\b/y },
  ],
  sql: [
    { type: 'comment', pattern: /--[^\n]*/y },
    { type: 'string', pattern: /'(?:''|[^'])*'/y },
    { type: 'string', pattern: /`[^`]*`/y },
    { type: 'number', pattern: /\b\d+(?:\.\d+)?\b/y },
  ],
  yml: [
    { type: 'comment', pattern: /(?<=^|\s)#[^\n]*/my },
    { type: 'string', pattern: /"(?:\\.|[^"\\\n])*"|'(?:''|[^'\n])*'/y },
    { type: 'key', pattern: /(?<=^\s*(?:-\s+)?)[A-Za-z_][\w.-]*(?=\s*:)/my },
    { type: 'function', pattern: /\$\{[^}]+\}|\{\{[^}]+\}\}/y },
    { type: 'number', pattern: /\b\d+(?:\.\d+)?\b/y },
  ],
  json: [
    { type: 'key', pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/y },
    { type: 'string', pattern: /"(?:\\.|[^"\\])*"/y },
    { type: 'number', pattern: /-?\b\d+(?:\.\d+)?\b/y },
  ],
};

function languageOf(language: string): string | undefined {
  const normalized = language.toLowerCase() === 'yaml' ? 'yml' : language.toLowerCase();
  return normalized in RULES ? normalized : undefined;
}

export function tokenize(code: string, language: string): Token[] {
  const lang = languageOf(language);
  if (!lang) return [{ type: 'plain', text: code }];
  const rules = RULES[lang];
  const identifier = new RegExp(IDENT, 'y');
  const tokens: Token[] = [];
  let plain = '';
  let index = 0;
  let previousWord = '';

  const flush = () => {
    if (plain) tokens.push({ type: 'plain', text: plain });
    plain = '';
  };

  while (index < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.pattern.lastIndex = index;
      const match = rule.pattern.exec(code);
      if (match && match[0].length > 0) {
        flush();
        tokens.push({ type: rule.type, text: match[0] });
        index += match[0].length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    identifier.lastIndex = index;
    const word = lang !== 'json' && lang !== 'yml' ? identifier.exec(code) : null;
    if (word && (index === 0 || !/[A-Za-z0-9_]/.test(code[index - 1]))) {
      const text = word[0];
      const rest = code.slice(index + text.length);
      const isCall = /^\s*\(/.test(rest);
      const isDefinition = lang === 'py' && (previousWord === 'def' || previousWord === 'class');
      const isKeyword = lang === 'py' ? PYTHON_KEYWORDS.has(text) : SQL_KEYWORDS.has(text.toLowerCase());
      flush();
      if (isDefinition || (isCall && !isKeyword)) tokens.push({ type: 'function', text });
      else if (isKeyword) tokens.push({ type: 'keyword', text });
      else tokens.push({ type: 'plain', text });
      previousWord = text;
      index += text.length;
      continue;
    }

    if (!/\s/.test(code[index])) previousWord = '';
    plain += code[index];
    index += 1;
  }
  flush();
  return tokens;
}

/** Descriptions for platform functions that appear in the excerpts. Reference-code functions use their docstrings. */
export const BUILTIN_FUNCTIONS: Record<string, string> = {
  sql: 'Run a Spark SQL statement and return a DataFrame.',
  saveAsTable: 'Write the DataFrame to a Unity Catalog table.',
  withColumn: 'Add or replace one column on a DataFrame.',
  selectExpr: 'Select columns using SQL expressions.',
  dropDuplicates: 'Keep one row per combination of the given columns.',
  createOrReplaceTempView: 'Register the DataFrame as a temporary view for SQL in this session.',
  filter: 'Keep rows that match a condition.',
  count: 'Count rows.',
  collect: 'Return all rows to the driver.',
  show: 'Print rows to the task output.',
  read_files: 'Read files from cloud storage or a volume. With STREAM, this is Auto Loader and reads only new files.',
  STREAM: 'Read the source incrementally as a stream.',
  current_timestamp: 'Timestamp at the start of query evaluation.',
  percentile_approx: 'Approximate percentile of a numeric column.',
  date_trunc: 'Truncate a timestamp to the given unit.',
  unix_millis: 'Milliseconds since the Unix epoch for a timestamp.',
  to_timestamp: 'Parse a string into a timestamp.',
  to_date: 'Convert a timestamp or string to a date.',
  date_format: 'Format a timestamp as a string.',
  date_sub: 'Subtract days from a date.',
  coalesce: 'First non-null argument.',
  row_number: 'Sequential row number within a window partition.',
  explode: 'One output row per array element.',
  sum: 'Sum of values.',
  round: 'Round to the given number of decimal places.',
  abs: 'Absolute value.',
  upper: 'Uppercase a string.',
  trim: 'Remove leading and trailing spaces.',
  lit: 'A literal value as a column.',
  expr: 'Parse a SQL expression into a column.',
  col: 'Reference a column by name.',
  size: 'Number of elements in an array.',
  IDENTIFIER: 'Use a parameter value as a table or column name safely.',
  assert_true: 'Fail the query with a message when the condition is false.',
  ai_query: 'Call a Model Serving endpoint from SQL.',
  named_struct: 'Build a struct from name and value pairs.',
  timestampdiff: 'Difference between two timestamps in the given unit.',
  get_run: 'Jobs API: details of one job run, including its tasks and attempts.',
  list_runs: 'Jobs API: recent runs of a job.',
  run_now: 'Jobs API: start a job run.',
  WorkspaceClient: 'Databricks SDK client; authenticates from the environment.',
  DataGenerator: 'dbldatagen: define synthetic columns and generate a DataFrame.',
  withIdOutput: 'dbldatagen: keep the generated id column in the output.',
  build: 'dbldatagen: generate the DataFrame from the column definitions.',
  parse: 'sqlglot: parse SQL text into syntax trees for a dialect.',
  partitionBy: 'Window: group rows into partitions.',
  orderBy: 'Order rows.',
};

export function describeFunction(name: string, local: Record<string, string>): string | undefined {
  return local[name] ?? BUILTIN_FUNCTIONS[name];
}
