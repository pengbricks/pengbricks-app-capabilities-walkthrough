import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'user-experience',
  area: 'AI Guides',
  title: 'Assistant user experience',
  intro:
    'A scripted user works through a Genie space the way a new analyst would: find out what data is there, ask a question, refine it, ask something vague, and rate the answers. The job drives the Genie Conversation API and writes one row per task to ux_session_log, with the outcome, any issue, and the training need.',
  shortVersion: [
    {
      title: 'The script is data.',
      body: 'Six tasks live in the use-case spec: discovery, a question, a refinement, an ambiguous question, and two feedback ratings.',
    },
    {
      title: 'Follow-ups share a conversation.',
      body: 'Discovery, the question, and the refinement share one conversation, so the follow-up keeps its context. The vague question starts a new one.',
    },
    {
      title: 'Feedback goes through the API.',
      body: 'Thumbs up and thumbs down are a POST on the message. The job rates each answer by comparing its rows with an expected query.',
    },
    {
      title: 'Issues come from rules, not opinion.',
      body: 'A task logs an issue when it fails, returns no SQL, differs from the expected rows, runs slowly, or guesses at a vague request.',
    },
    {
      title: 'The reference run found one issue.',
      body: 'Genie asked which metric "best customers" meant, because the space has no customer-level dimension. That is a training and modelling note, not an error.',
    },
  ],
  sections: [
    {
      id: 'session',
      heading: 'The scripted session',
      prose:
        'The job creates a Genie space over the sales_metrics metric view, then runs the tasks in order. Each message waits for the answer, with a pause to stay under the API rate limit.',
      diagram: {
        type: 'flow',
        title: 'One user session through the API',
        description:
          'run_user_session creates the assistant space, then sends the discovery prompt, the question, and the refinement in one conversation, and the ambiguous prompt in a second. Feedback is posted on the question and the refinement. Every task is written to ux_session_log.',
        lanes: [
          { label: 'Conversation 1', fromRow: 0, toRow: 0 },
          { label: 'Conversation 2', fromRow: 1, toRow: 1 },
        ],
        nodes: [
          { id: 'disc', label: 'Discovery', sub: 'what data is here?', col: 0, row: 0 },
          { id: 'q', label: 'Question', sub: 'revenue by region, Q3', col: 1, row: 0 },
          { id: 'ref', label: 'Refinement', sub: 'also split by segment', col: 2, row: 0 },
          { id: 'fb', label: 'Feedback', sub: 'thumbs on both answers', col: 3, row: 0, kind: 'highlight' },
          { id: 'amb', label: 'Ambiguous question', sub: 'who are best customers?', col: 0, row: 1 },
          { id: 'log', label: 'ux_session_log', mono: true, sub: 'outcome, issue, training', col: 3, row: 1, kind: 'store' },
        ],
        edges: [
          { from: 'disc', to: 'q' },
          { from: 'q', to: 'ref', label: 'same conversation' },
          { from: 'ref', to: 'fb' },
          { from: 'fb', to: 'log' },
          { from: 'amb', to: 'log' },
        ],
        legend: [
          { kind: 'highlight', label: 'Feedback API call' },
          { kind: 'store', label: 'Unity Catalog table' },
        ],
      },
    },
    {
      id: 'outcomes',
      heading: 'What each task logged',
      prose:
        'Outcome comes from the message status and a row comparison with the expected query. Latencies are from the reference run.',
      diagram: {
        type: 'matrix',
        title: 'Task outcomes in the reference run',
        description:
          'Discovery was answered in 6.7 seconds with the metric view description. The question and the refinement both matched the expected rows, in 15.9 and 15.8 seconds. The ambiguous question was answered with a clarifying question in 6.5 seconds. Both feedback calls were accepted.',
        corner: 'Task ↓ · Result →',
        columns: ['Outcome', 'Seconds', 'Issue logged'],
        rows: [
          {
            label: 'Discovery',
            cells: [
              { state: 'own', text: 'Answered' },
              { state: 'own', text: '6.7' },
              { state: 'none', text: 'None' },
            ],
          },
          {
            label: 'Question',
            cells: [
              { state: 'own', text: 'Matches expected' },
              { state: 'own', text: '15.9' },
              { state: 'none', text: 'None' },
            ],
          },
          {
            label: 'Refinement',
            cells: [
              { state: 'own', text: 'Matches expected' },
              { state: 'own', text: '15.8' },
              { state: 'none', text: 'None' },
            ],
          },
          {
            label: 'Ambiguous question',
            cells: [
              { state: 'optional', text: 'Clarifying question' },
              { state: 'own', text: '6.5' },
              { state: 'optional', text: 'Asked, did not answer' },
            ],
          },
          {
            label: 'Feedback x2',
            cells: [
              { state: 'own', text: 'Both accepted' },
              { state: 'none', text: 'n/a' },
              { state: 'none', text: 'None' },
            ],
          },
        ],
        legend: [
          { state: 'own', label: 'As expected' },
          { state: 'optional', label: 'Needs follow-up' },
          { state: 'none', label: 'Nothing to log' },
        ],
      },
    },
    {
      id: 'issues',
      heading: 'Issues and training needs',
      prose:
        'Every row carries a training need from the spec, so the log doubles as a short onboarding checklist for the people who will use the space.',
      table: {
        columns: ['Task', 'Training need logged'],
        rows: [
          ['Discovery', 'Show new users the sample questions and the data list on the space home page.'],
          ['Question', 'Teach users to open Show code and check the filters, dates, and measures behind a number.'],
          ['Refinement', 'Follow-ups keep context only inside one conversation; start a new chat for a new topic.'],
          ['Ambiguous question', 'Name the measure and period, such as top customers by revenue in Q3 2026.'],
        ],
      },
      points: [
        {
          strong: 'The ambiguous task found a modelling gap.',
          text: 'The metric view has segment, region, and channel but no customer name. Genie said so and offered those dimensions.',
        },
      ],
    },
    {
      id: 'replay',
      heading: 'Replay it',
      steps: [
        {
          title: 'Read the log',
          body: 'One row per task, newest run last. Filter on the run_id of the job run.',
          code: 'SELECT step_id, outcome, latency_s, issue, training_need\nFROM <catalog>.<schema>.ux_session_log\nORDER BY logged_at, step;',
        },
        {
          title: 'Open the space',
          body: 'genie_spaces holds the space URL. The conversations from the run appear in the space history.',
        },
        {
          title: 'Change the script',
          body: 'Edit ux_script in use_cases/general.yml, add a step with its own expected query, and rerun the job.',
        },
      ],
    },
  ],
  related: [
    { slug: 'ontology', title: 'Business terms and synonyms' },
  ],
};
