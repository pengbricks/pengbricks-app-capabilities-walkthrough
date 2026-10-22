import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    kind: 'decision',
    question: 'Should I replace my existing rule checks with AI Functions?',
    answer:
      'No. Keep rules for anything with a precise definition, such as nulls, ranges, formats, and known codes. They are free, exact, and easy to audit. Add AI Functions for the rows a rule marks unknown. That keeps the model bill tied to the hard rows.',
    links: [{ label: 'When AI beats rules', url: '/walkthroughs/ai-functions-data-quality' }],
  },
  {
    kind: 'decision',
    question: 'ai_similarity or vector search for finding duplicates?',
    answer:
      'Use ai_similarity on blocked pairs for a table of a few thousand to a few hundred thousand candidate pairs, because it is one SQL function with no index. Move to an AI Search index and vector_search when the table is large or you match new records against a reference set repeatedly. The vector_search SQL function is Public Preview.',
    links: [
      { label: 'ai_similarity', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_similarity' },
      {
        label: 'vector_search',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_search',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What does blocking cost me when I look for near-duplicates?',
    answer:
      'Recall. Blocking compares only rows that share a key, such as the first letters of a normalized name, which keeps the number of model calls manageable. A duplicate whose key differs is never compared. Choose a key that typos rarely touch, and measure recall against labelled pairs.',
  },
  {
    kind: 'decision',
    question: 'Which function detects sensitive values in free text?',
    answer:
      'Use patterns for fixed formats such as email, phone, and ID numbers, then ai_mask for names and places in prose. Compare the masked output with the input, and a changed note held something sensitive. Data Classification in Unity Catalog finds which columns are sensitive, and it does not read the words inside a free-text value.',
    links: [
      { label: 'ai_mask', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_mask' },
      {
        label: 'Data Classification',
        url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-classification',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'What happens to a row the model is unsure about?',
    answer:
      'It becomes a review verdict, which is a third state beside pass and fail. Decide per check what review means: a person looks, the record is held, or the row is accepted. If more than about a quarter of rows land there, fix the labels or the prompt, because a person is doing the work the model was meant to do.',
  },
  {
    kind: 'decision',
    question: 'How do I get a reliable pass or fail out of ai_query?',
    answer:
      'Pass responseFormat with a JSON schema that has an enum for the verdict and a string for the reason, and set failOnError to false. The result is a struct with response and errorMessage, and you parse response as JSON. Treat anything unparseable as review. responseFormat needs Databricks Runtime 15.4 LTS or above and a chat model.',
    links: [
      { label: 'ai_query', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query' },
      {
        label: 'Structured outputs',
        url: 'https://docs.databricks.com/aws/en/machine-learning/model-serving/structured-outputs',
      },
    ],
  },
  {
    question: 'How big should the labelled sample be?',
    answer:
      'A few hundred rows per check gives a rough precision and recall for a problem that shows up in a fair share of rows. A rare problem needs more, because you need enough real failures to score recall. Label rows from the residue the model sees, and draw them at random so the sample matches production.',
  },
  {
    kind: 'tradeoff',
    question: 'Is it worth running ai_fix_grammar as a cleaning step?',
    answer:
      'Only for text a person reads, such as comments and descriptions. It is Public Preview, tuned for English, and it changes values, so a corrected name or code is a different value. Write the result to a new column and keep the original.',
    links: [
      {
        label: 'ai_fix_grammar',
        url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_fix_grammar',
      },
    ],
  },
  {
    kind: 'tradeoff',
    question: 'Task function or ai_query for a quality check?',
    answer:
      'A task function needs no prompt and no model choice, and Databricks maintains the model, so output can change when it is upgraded. ai_query lets you pick the model and shape the output, and you own the prompt and the parsing. Start with the task function and move to ai_query when no function fits the check.',
    links: [{ label: 'AI Functions in SQL', url: '/walkthroughs/ai-functions' }],
  },
  {
    question: 'Where do I read what the AI checks cost?',
    answer:
      'In system.billing.usage. ai_classify and ai_extract show under billing_origin_product AI_FUNCTIONS. ai_similarity, ai_mask, ai_fix_grammar, and similar functions show under MODEL_SERVING with the BATCH_INFERENCE offering type. The docs do not say where ai_query lands, so check your own usage rows. Rows can arrive hours after the work, so run the query again later and divide billed DBUs by the rows you sent for a cost per thousand rows.',
    links: [
      {
        label: 'AI Functions overview',
        url: 'https://docs.databricks.com/aws/en/large-language-models/ai-functions',
      },
    ],
  },
];
