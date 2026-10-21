import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'Do I need a personal access token to sign in?',
    answer:
      'No. Use OAuth user-to-machine (U2M). The extension stores it as a profile in your Databricks CLI config file, and the CLI, SDKs, and Databricks Connect reuse the same sign-in. A personal access token is a legacy option.',
    links: [
      { label: 'Set up authorization', url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/authentication' },
    ],
  },
  {
    question: 'Does the extension work with SQL warehouses or serverless compute?',
    answer:
      'It works with serverless and with clusters, and serverless is the recommended default. SQL warehouses are not supported. The docs require a workspace with at least one cluster to follow every feature.',
    links: [
      {
        label: 'Install the Databricks IDE extension',
        url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/install',
      },
    ],
  },
  {
    question: 'When should I debug with Databricks Connect and when should I run as a job?',
    answer:
      'Debug with Databricks Connect while you write the logic, because Python runs locally with breakpoints and Spark work runs remotely. Then run it as a workflow or bundle job before you open a pull request, since Connect hides differences in libraries, parameters, and permissions that a job run exposes.',
    links: [{ label: 'Run a file or notebook', url: 'https://docs.databricks.com/aws/en/dev-tools/vscode-ext/run' }],
  },
  {
    question: 'Why does my code pass locally and fail on the cluster?',
    answer:
      'Usually a Python or package version gap. Run Set up Python environment so the extension builds a .venv that matches the chosen compute, and pin databricks-connect to the runtime version (for example 17.3.*) in pyproject.toml. Re-run the setup whenever you switch compute.',
    links: [
      {
        label: 'Install Databricks Connect for Python',
        url: 'https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/install',
      },
    ],
  },
  {
    question: 'Can I edit files in the synced workspace folder?',
    answer:
      'No. Sync is one way, from your machine to the workspace, and works only in development mode. Changes made in that folder never come back to your project, so make real changes in Git and deploy with the bundle.',
  },
  {
    question: 'Is Genie Code available inside VS Code or Cursor?',
    answer:
      'The docs do not list VS Code or Cursor as a Genie Code surface, so do not plan around it there. In the editor, the extension has an AI tools section (Beta) that installs Databricks skills for your coding agents. Genie Code itself runs in the workspace.',
    links: [{ label: 'Genie Code', url: 'https://docs.databricks.com/aws/en/genie-code/' }],
  },
];
