import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'When should I use ai_query instead of a task function?',
    answer:
      'Use ai_query only when no task function fits, for example translating to a language ai_translate does not cover, extracting more than 256 fields, or calling a fine-tuned model through its endpoint. Task functions such as ai_classify and ai_extract need no prompt and no model choice.',
    links: [{ label: 'ai_query', url: 'https://docs.databricks.com/aws/en/large-language-models/ai-query' }],
  },
  {
    question: 'Can I call AI Functions from a dashboard query?',
    answer:
      'You can, but you should not. Every call is a billed model inference, so a dashboard refresh pays again each time. Run the function in a pipeline or job, write the result to a Delta table once, and query that table.',
  },
  {
    question: 'Does my data leave Databricks when I use AI Functions?',
    answer:
      'Task functions run on Databricks-hosted models, which are Designated Services that process data in your workspace Geo. ai_query sends rows to whatever endpoint you name, so an external model endpoint sends each row to that provider under its terms. Treat that as a data transfer.',
    links: [
      {
        label: 'Designated Services and cross-Geo processing',
        url: 'https://docs.databricks.com/aws/en/resources/designated-services',
      },
    ],
  },
  {
    question: 'Who is allowed to run AI Functions?',
    answer:
      'All users have EXECUTE on the system.ai schema by default. A metastore admin can revoke that and grant individual functions to groups, but function-level permissions are in Public Preview and are turned on through the account team. They do not cover ai_query, which is governed by permissions on the model endpoint.',
    links: [
      {
        label: 'AI Functions permissions',
        url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions-uc-permissions',
      },
    ],
  },
  {
    question: 'Which AI Functions are Beta, and what do I need to turn on?',
    answer:
      'ai_decide, ai_enrich, ai_prep_search, ai_search, ai_transcribe, ai_predict_class, ai_predict_value, ai_forecast, ai_detect_anomalies, and ai_top_drivers are Beta. A workspace admin must turn on the AI Decide preview for ai_decide and the Predictive AI Functions preview for the predict functions. Check the terms and support level before regulated data reaches a Beta function.',
  },
  {
    question: 'What compute do AI Functions need?',
    answer:
      'A serverless or Pro SQL warehouse, or Databricks Runtime 15.4 LTS and later. They do not run on classic SQL warehouses. Some functions need newer runtimes, such as ai_parse_document on Runtime 17.3 and later.',
  },
];
