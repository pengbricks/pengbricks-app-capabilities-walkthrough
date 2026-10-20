import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'user-experience',
  area: 'AI Guides',
  title: 'Assistant user experience',
  intro:
    'A Genie Agent earns trust one answer at a time. This page covers how to roll one out so business users keep using it: curate the agent with instructions, sample questions, and trusted assets; measure quality with benchmarks; run a pilot; read feedback; size access and compute; and put the agent where people already work.',
  shortVersion: [
    {
      title: 'Start small and curate with SQL.',
      body: 'Begin with a handful of well-documented tables or a metric view. Teach the agent with SQL expressions, example queries, and trusted assets before you write text instructions.',
    },
    {
      title: 'Measure with benchmarks, not impressions.',
      body: 'Save the questions people ask, with the SQL that answers them, as benchmarks. Add two to four phrasings of each, and rerun after every change to the agent.',
    },
    {
      title: 'Pilot with a small cohort, then train.',
      body: 'Pick a few business users who ask real questions. Give them a short guide: how to read the SQL, how to rephrase, and how to give feedback.',
    },
    {
      title: 'Feedback is a queue, not a training signal.',
      body: 'Feedback does not change the agent by itself. An owner reviews flagged answers weekly and turns each fix into an instruction, example query, or trusted asset.',
    },
    {
      title: 'Data access follows the user.',
      body: 'Genie runs on a Pro or serverless SQL warehouse but evaluates each question with the asker’s own Unity Catalog permissions. Size the warehouse for concurrent users.',
    },
    {
      title: 'Meet people where they work.',
      body: 'Share the agent in Genie One, and use Slack or Microsoft Teams, an embedded page, or the Conversation API when your users live elsewhere.',
    },
  ],
  sections: [
    {
      id: 'rollout',
      heading: 'Adopt in stages',
      prose:
        'Treat adoption as a loop. Each stage produces something the next one needs, and the monitoring stage feeds back into curation.',
      diagram: {
        type: 'flow',
        title: 'From first agent to steady use',
        description:
          'Curate the agent, score it with benchmarks, run a pilot with a small cohort, expand to more users and channels, and monitor feedback and usage. Monitoring findings return to the curate stage.',
        nodes: [
          { id: 'curate', label: 'Curate', sub: 'data, SQL, instructions', col: 0, row: 0 },
          { id: 'bench', label: 'Benchmark', sub: 'score accuracy', col: 1, row: 0, kind: 'highlight' },
          { id: 'pilot', label: 'Pilot', sub: 'small cohort + training', col: 2, row: 0 },
          { id: 'expand', label: 'Expand', sub: 'Genie One, Slack, Teams', col: 3, row: 0, kind: 'surface' },
          { id: 'monitor', label: 'Monitor', sub: 'feedback and usage', col: 3, row: 1 },
        ],
        edges: [
          { from: 'curate', to: 'bench' },
          { from: 'bench', to: 'pilot' },
          { from: 'pilot', to: 'expand' },
          { from: 'expand', to: 'monitor' },
          { from: 'monitor', to: 'curate', label: 'fixes', dashed: true },
        ],
        legend: [
          { kind: 'highlight', label: 'Quality gate' },
          { kind: 'surface', label: 'Where users ask' },
        ],
      },
    },
    {
      id: 'curate',
      heading: 'Curate: instructions, sample questions, trusted assets',
      prose:
        'Genie behaves like a new analyst: it needs context. Give it structured context first and plain text last. Keep the agent narrow, ideally five or fewer tables, and a metric view when the model needs joins or governed measures.',
      table: {
        caption: 'What to give the agent, in priority order',
        columns: ['Input', 'Use it for'],
        rows: [
          ['Unity Catalog descriptions and metric views', 'Table and column meaning. Review AI-generated comments before you keep them.'],
          ['SQL expressions', 'Reusable measures, filters, and dimensions such as revenue or active customers'],
          ['Example SQL queries', 'Hard or ambiguous questions. Title each with the most natural phrasing of the question.'],
          [
            'Trusted assets',
            'Parameterized example queries and Unity Catalog SQL functions whose logic you verified. Genie answers from them directly.',
          ],
          ['Sample questions', 'Starter prompts on the landing page that show users what the agent is for'],
          ['Text instructions', 'Last resort: tone, rounding, or when to ask a clarifying question'],
        ],
      },
      points: [
        {
          strong: 'Write instructions that name a trigger and an action.',
          text: 'Say "when users ask about sales without a time range or channel, ask which they want", not "ask clarifying questions". Keep instructions consistent: if text says round to two digits, example queries must too.',
        },
        {
          strong: 'Use trusted assets for the answers that must be exact.',
          text: 'A parameterized query or a SQL function returns the same logic every time. Use them for regulated figures, board metrics, and questions that Genie answers inconsistently from free text.',
        },
        {
          strong: 'Have a domain expert own it.',
          text: 'Someone who knows the data and writes SQL should author the agent, so the instructions reflect how the business defines its terms.',
        },
      ],
      links: [
        {
          label: 'Curate an effective Genie Agent',
          url: 'https://docs.databricks.com/aws/en/genie-agents/best-practices',
          note: 'Instruction types, clarification prompts, and starting small.',
        },
        {
          label: 'Set up a Genie Agent',
          url: 'https://docs.databricks.com/aws/en/genie-agents/set-up',
          note: 'Data limits, compute, and required permissions.',
        },
      ],
    },
    {
      id: 'benchmarks',
      heading: 'Measure quality with benchmarks',
      prose:
        'Benchmarks are test questions with a gold SQL answer. Genie runs each as a new conversation, compares its result with yours, and reports accuracy. Benchmarks are for evaluation only: Genie does not learn from them.',
      points: [
        {
          strong: 'Build the set from real questions.',
          text: 'Start with what the pilot cohort asks. Add two to four phrasings of each question, all pointing at the same gold SQL, since users ask the same thing differently.',
        },
        {
          strong: 'Rerun after every change.',
          text: 'Run the set after you edit instructions, add a table, or change a metric view, and keep the score history. A drop after a change tells you which edit to revert.',
        },
        {
          strong: 'Set a bar before you expand.',
          text: 'Agree an accuracy threshold with the business owner for the pilot and a higher one for wide release. Fix misses with an example query or SQL expression, not a longer instruction list.',
        },
        {
          strong: 'Automate checks from outside the UI.',
          text: 'The Conversation API starts a conversation, posts follow-ups in it, and returns the SQL and result, so a job can ask the same questions on a schedule and compare rows.',
        },
      ],
      links: [
        {
          label: 'Test and monitor a Genie Agent',
          url: 'https://docs.databricks.com/aws/en/genie/benchmarks',
          note: 'Benchmarks, chat and agent mode, and response feedback.',
        },
        {
          label: 'Genie Conversation API',
          url: 'https://docs.databricks.com/aws/en/genie/conversation-api',
        },
      ],
    },
    {
      id: 'feedback',
      heading: 'Review feedback, including thumbs-down',
      prose:
        'Each answer asks "Is this correct?". Users can confirm it, flag it with a reason and retry, or request a review. Feedback alone does not change the agent, so someone has to read it.',
      points: [
        {
          strong: 'Assign an owner and a cadence.',
          text: 'The owner reviews flagged answers and thumbs-down feedback on the Monitor tab each week during the pilot, then less often. Reviewers need CAN MANAGE on the agent.',
        },
        {
          strong: 'Turn each fix into reusable context.',
          text: 'If Genie misread a term, add a SQL expression or synonym. If it chose the wrong logic, add an example query. If it must be exact, make it a trusted asset. Then add the question to the benchmarks.',
        },
        {
          strong: 'Look for patterns, not single answers.',
          text: 'The Monitor tab shows weekly message volume, active users, and feedback. Analyze Agent Usage summarizes common topics and recurring issues so you can see what users want that the agent lacks.',
        },
        {
          strong: 'Close the loop with users.',
          text: 'Users who request a review can see the outcome. Tell the cohort what changed, so they keep giving feedback.',
        },
      ],
      links: [
        {
          label: 'Monitor a Genie Agent',
          url: 'https://docs.databricks.com/aws/en/genie-agents/monitor',
          note: 'Weekly digest, usage trends, and reviewing conversations.',
        },
      ],
    },
    {
      id: 'pilot',
      heading: 'Run a pilot and train users',
      prose:
        'A pilot of five to ten users who need the answers is enough to find most gaps. Give them a short, concrete guide instead of a demo.',
      steps: [
        {
          title: 'Pick the cohort',
          body: 'Choose people who ask the agent’s questions in their daily work, across the roles that will use it. Tell them their job is to help refine the agent.',
        },
        {
          title: 'Teach four habits',
          body: 'Open the generated SQL and check the filters, dates, and measures behind a number. Name the measure and period in the question. Keep follow-ups in one conversation and start a new chat for a new topic. Give feedback on every answer.',
        },
        {
          title: 'Log issues and training needs',
          body: 'Keep a short register: the question, what went wrong, and whether the fix is in the agent (context) or in the user (training). It tells you what to add to the benchmarks and the guide.',
        },
        {
          title: 'Exit on evidence',
          body: 'Expand when benchmark accuracy meets the bar, the pilot cohort repeats use without help, and open feedback is falling.',
        },
      ],
    },
    {
      id: 'access',
      heading: 'Access and warehouse sizing',
      prose:
        'Share the agent with groups, not individuals, and let Unity Catalog decide what each person sees.',
      points: [
        {
          strong: 'Permissions follow the asker.',
          text: 'The agent uses the warehouse you pick to run queries, but data access is evaluated with each user’s own Unity Catalog permissions. Row filters and column masks apply. Users need access to the workspace, a SQL entitlement, and the underlying data.',
        },
        {
          strong: 'Give authors and users different roles.',
          text: 'CAN EDIT lets someone change the agent and run benchmarks. CAN MANAGE adds monitoring and sharing. Business users need only the run permission.',
        },
        {
          strong: 'Use a Pro or serverless SQL warehouse.',
          text: 'Genie requires one. Prefer serverless, which starts fast and scales for concurrent users. Start with a small size, watch query queue time and latency in query history during the pilot, and resize before you expand.',
        },
        {
          strong: 'Keep the data model small.',
          text: 'An agent holds up to 50 tables, views, or metric views. Pre-join and aggregate in views or a metric view: they cut query cost and improve accuracy.',
        },
      ],
      links: [
        {
          label: 'Genie Agent requirements and permissions',
          url: 'https://docs.databricks.com/aws/en/genie-agents/set-up',
        },
      ],
    },
    {
      id: 'distribution',
      heading: 'Distribute where people work',
      prose:
        'Adoption depends on friction. Start with the built-in surfaces and add channels as the cohort grows.',
      table: {
        columns: ['Channel', 'Use it for'],
        rows: [
          ['Genie One', 'The business-user home: browse and ask published agents. Add tags, a description, and common questions so people find the right agent.'],
          [
            'Slack and Microsoft Teams',
            'Asking from chat. The Teams app is in Beta and Slack features are in preview at the time of writing; check the release notes before you commit.',
          ],
          ['Embedded page or app', 'A Genie chat inside a Databricks App or an internal portal'],
          ['Genie One MCP server', 'Let other agents call Genie as a tool through Unity Gateway (GA)'],
          ['Conversation API', 'Custom front ends and scheduled quality checks'],
        ],
      },
      links: [
        {
          label: 'Genie One',
          url: 'https://docs.databricks.com/aws/en/genie-one/',
        },
        {
          label: 'Embed a Genie Agent',
          url: 'https://docs.databricks.com/aws/en/genie-agents/embed',
        },
      ],
    },
    {
      id: 'as-code',
      heading: 'Version the agent as code',
      prose:
        'Genie Agents have a Declarative Automation Bundles resource, so the agent’s tables, instructions, sample questions, and example queries can live in Git and promote from dev to production like any other resource. Create the agent in the UI while you iterate, then move the final definition into a bundle. The Conversation API remains useful for tests that run against a deployed agent.',
      links: [
        {
          label: 'Bundle resources',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/resources',
          note: 'The genie_spaces resource.',
        },
      ],
    },
  ],
  related: [
    { slug: 'ontology', title: 'Business terms and synonyms' },
    { slug: 'agent-framework-support', title: 'Agents, MCP, and model gateway' },
  ],
};
