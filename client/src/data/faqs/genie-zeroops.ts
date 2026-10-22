import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Can I use Genie ZeroOps in production today?',
    answer:
      'Plan on no. The June 16, 2026 announcement said it was entering private preview, and no later public source changed that as of October 22, 2026. Ask your account team for access, and check the docs for the current stage before you commit dates.',
    links: [{ label: 'Introducing Genie ZeroOps', url: 'https://www.databricks.com/blog/introducing-genie-zeroops' }],
  },
  {
    kind: 'decision',
    question: 'Should ZeroOps replace our job alerts and data quality monitoring?',
    answer:
      'No. Keep job notifications for paging, SQL alerts for business thresholds, and data quality monitoring for table health. ZeroOps reads those signals and adds a root cause and a tested fix proposal. Revisit this only after the preview is documented and your incident review shows detection is not the bottleneck.',
    links: [
      { label: 'Job notifications', url: 'https://docs.databricks.com/aws/en/jobs/notifications' },
      { label: 'Data quality monitoring', url: 'https://docs.databricks.com/aws/en/data-quality-monitoring/' },
    ],
  },
  {
    kind: 'decision',
    question: 'Which workloads should we try first?',
    answer:
      'Non-critical scheduled jobs and pipelines that have an owner, a Git repo, and repeatable failures. Add a few monitored tables to test silent-failure detection. Hold tier-one pipelines until you have a record of accepted and rejected fixes.',
    links: [{ label: 'Scope options', url: '/walkthroughs/genie-zeroops' }],
  },
  {
    kind: 'tradeoff',
    question: 'Is it safe for the agent to test fixes against production data?',
    answer:
      'Databricks says the proposed fix runs against shallow clones of production data in an isolated sandbox with scoped permissions and network isolation, and that the agent can only access data your credentials allow. Per the Delta clone docs a shallow clone points at the source files, so check how row filters, column masks, and restricted tables behave before you include them.',
    links: [{ label: 'Delta clone', url: 'https://docs.databricks.com/aws/en/delta/clone' }],
  },
  {
    kind: 'decision',
    question: 'Should fixes go through pull requests or inbox approval?',
    answer:
      'Use pull requests for anything stored in Git so the fix passes review and CI. Use inbox approval for data repairs that have no source file, and log them in a ticket. The public sources do not confirm that ZeroOps opens pull requests, so ask before you design around it.',
    links: [{ label: 'GitHub-based CI/CD', url: '/walkthroughs/github-cicd' }],
  },
  {
    kind: 'tradeoff',
    question: 'What does human approval cost us?',
    answer:
      'It adds review time, which is the point. Databricks says nothing applies to production without approval and that the tested change is the one applied. A fast approver gets quicker recovery, and a strict one gets stronger control. Assign approvers by workload risk.',
    links: [{ label: 'Introducing Genie ZeroOps', url: 'https://www.databricks.com/blog/introducing-genie-zeroops' }],
  },
  {
    kind: 'decision',
    question: 'Who should approve a ZeroOps fix?',
    answer:
      'The workload owner by default, with a second reviewer through pull request rules for shared or regulated tables, and a change group for tier-one assets. The public sources do not describe approval roles, so confirm what the preview supports.',
    links: [{ label: 'Operational support', url: '/walkthroughs/operational-support' }],
  },
  {
    question: 'Why is my ZeroOps inbox empty?',
    answer:
      'The inbox stays empty until a monitored job fails. Add a job you own with Configure, or ask in Genie Code chat to monitor it. Then make it fail, for example by mistyping a column name. The insight appears about 1 to 2 minutes later. If you still see nothing, check that ZeroOps is enabled in the workspace.',
    links: [{ label: 'Run it', url: '/walkthroughs/genie-zeroops' }],
  },
  {
    question: 'Where is the Configure button?',
    answer:
      'Configure shows only outside full-screen mode. Exit full screen in Genie Code. ZeroOps has no separate URL. Open the inbox from the ZeroOps banner on Jobs & Pipelines, or from full-screen Genie Code.',
    links: [{ label: 'Run it', url: '/walkthroughs/genie-zeroops' }],
  },
  {
    kind: 'decision',
    question: 'Which failure should I use to demo ZeroOps?',
    answer:
      'Use a plain job failure, such as a mistyped column name. It is the most dependable trigger in the preview. Schema drift and data spikes are less dependable, so try them only after the failure path works.',
    links: [{ label: 'Trigger options', url: '/walkthroughs/genie-zeroops' }],
  },
  {
    question: 'What should I ask my account team?',
    answer:
      'Ask about release stage and regions, billing for sandbox and training compute, the identity and permissions the sandbox uses, whether it opens pull requests, approval roles and audit logging, scope controls, and data handling. The walkthrough lists the full set.',
    links: [{ label: 'Rollout and questions', url: '/walkthroughs/genie-zeroops' }],
  },
];
