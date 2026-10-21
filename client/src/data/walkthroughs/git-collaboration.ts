import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'git-collaboration',
  area: 'CI/CD & Version Control Guides',
  title: 'Collaborating on Databricks projects with Git',
  intro:
    'Your Git provider holds the code. Each person works on a branch, in their own Git folder in the workspace or in an IDE. Shared and production code reaches the workspace through pull requests, CI, and a bundle deploy. Nobody edits a shared or production copy by hand. This page covers how to connect Git, the daily Git folder workflow, the team conventions that keep main healthy, and the mistakes that break collaboration.',
  businessValue: {
    summary:
      'Teams keep one reviewed version of every pipeline, notebook, and job in Git. Leaders get a record of who changed what and a production environment that nobody edits by hand.',
    outcomes: [
      {
        title: 'Auditable change history',
        body:
          'Every change to shared code is a commit on a branch with a pull request, so you can show who changed what, who approved it, and when.',
      },
      {
        title: 'Safer production',
        body:
          'Production deploys from CI through a bundle, not from a folder people edit. A merge to main is the only route for a change to reach shared workspaces.',
      },
      {
        title: 'Work survives people and folders',
        body:
          'Anything committed and pushed outlives a deleted workspace folder or a departed employee. Work that exists only in the workspace is at risk.',
      },
      {
        title: 'Automation without personal accounts',
        body:
          'Jobs and CI run as service principals with their own Git credential, so production does not depend on one person staying employed or keeping a token current.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'The Git repository is the source of truth.',
      body: 'A Git folder is a working copy in the workspace, like a clone on a laptop. Anything you want to keep is committed and pushed. Anything only in the workspace is at risk.',
    },
    {
      title: 'One person, one Git folder, one branch.',
      body: 'Each developer clones the repository into their own folder under their user area and works on a short-lived branch. A shared Git folder lets one person switch the branch under everyone else.',
    },
    {
      title: 'Connect with the Databricks GitHub app, and use service principals for automation.',
      body: 'For hosted GitHub, link your account through the Databricks GitHub app. Use a personal access token only where the app is not available. Jobs and CI run as a service principal with its own Git credential.',
    },
    {
      title: 'Merge through a pull request, deploy through CI.',
      body: 'A pull request runs tests and bundle validate. A merge to main deploys with a bundle. Production is never a folder that people edit.',
    },
    {
      title: 'Keep notebooks diff-friendly and clean.',
      body: 'Choose one notebook format per repository, leave outputs out of commits, keep secrets and data out of the repo, and add a .gitignore on day one.',
    },
  ],
  sections: [
    {
      id: 'model',
      heading: 'The model: Git in the middle',
      prose:
        'Every surface you edit in is a client of the same remote repository. The workspace Git folder and the IDE are two clones. CI is the only thing that deploys shared and production code.',
      diagram: {
        type: 'flow',
        title: 'From a personal Git folder to production',
        description:
          'A developer works in a personal Git folder in the workspace or in an IDE and pushes a feature branch to the Git provider. A pull request is reviewed by code owners and must pass CI checks, which run tests and bundle validate. Merging to the protected main branch triggers CI to deploy with a bundle under a service principal, which creates or updates production jobs and pipelines.',
        nodes: [
          { id: 'gf', label: 'Your Git folder', sub: 'workspace, your branch', col: 0, row: 0, kind: 'surface' },
          { id: 'ide', label: 'Your IDE', sub: 'local clone', col: 0, row: 1, kind: 'surface' },
          { id: 'remote', label: 'Git provider', sub: 'feature branch', col: 1, row: 0, kind: 'store' },
          { id: 'pr', label: 'Pull request', sub: 'review, code owners', col: 2, row: 0 },
          { id: 'ci', label: 'CI checks', sub: 'tests, bundle validate', col: 3, row: 0, kind: 'gate' },
          { id: 'main', label: 'Protected main', sub: 'merge after checks', col: 3, row: 1 },
          { id: 'deploy', label: 'Bundle deploy', sub: 'service principal', col: 2, row: 1, kind: 'highlight' },
          { id: 'prod', label: 'Prod jobs, pipelines', sub: 'no hand edits', col: 1, row: 1 },
        ],
        edges: [
          { from: 'gf', to: 'remote', label: 'commit, push' },
          { from: 'ide', to: 'remote', label: 'push', dashed: true },
          { from: 'remote', to: 'pr' },
          { from: 'pr', to: 'ci' },
          { from: 'ci', to: 'main', label: 'pass, merge' },
          { from: 'main', to: 'deploy' },
          { from: 'deploy', to: 'prod' },
        ],
        legend: [
          { kind: 'surface', label: 'Where you edit' },
          { kind: 'gate', label: 'Blocks the merge' },
          { kind: 'highlight', label: 'The only path to prod' },
        ],
      },
    },
    {
      id: 'connect',
      heading: 'Connect Git: providers and credentials',
      prose:
        'Git folders work with the major cloud and self-managed providers. The credential you choose decides who the provider sees and what breaks when a person leaves.',
      table: {
        caption: 'Supported providers',
        columns: ['Type', 'Providers'],
        rows: [
          [
            'Cloud',
            'GitHub, GitHub Enterprise Cloud, Bitbucket Cloud, GitLab and GitLab Enterprise Edition, Azure DevOps (Azure Repos), AWS CodeCommit',
          ],
          [
            'Self-managed',
            'GitHub Enterprise Server, Bitbucket Server and Data Center, GitLab Self-Managed, Azure DevOps Server',
          ],
        ],
      },
      points: [
        {
          strong: 'Hosted GitHub: use the Databricks GitHub app.',
          text: 'Link it under Settings > Linked accounts > Add Git credential. The app uses OAuth 2.0, renews tokens automatically, and limits access to the repositories you choose. GitHub Enterprise Server cannot link an account this way, so it uses a personal access token. Enterprise Managed Users can use the app for organization repositories only.',
        },
        {
          strong: 'Other providers: a token is the default, and OAuth where offered.',
          text: 'The Linked accounts page offers OAuth linking for some providers and a personal access token for the rest. Azure DevOps does not accept Microsoft Entra ID tokens for Git folders, so it uses an Azure DevOps personal access token. Scope any token to the repositories and permissions you need and set an expiry.',
        },
        {
          strong: 'Automation: a service principal with its own Git credential.',
          text: 'Jobs, CI pipelines, and anything else that should not depend on a person run as a service principal. Add the credential on the service principal\'s Git integration tab or with the CLI. Back it with a dedicated bot or machine account.',
        },
        {
          strong: 'Set your commit identity.',
          text: 'Enter your real email on the credential so commits show up under your profile. The GitHub app sets this for you.',
        },
        {
          strong: 'Private Git servers: the Git server proxy.',
          text: 'A Git server that is private, on-premises, or behind a firewall needs the Git server proxy, which routes Git commands through a compute resource in your workspace. Serverless Private Git, in Public Preview, does the same through serverless compute and PrivateLink and runs only when a Git request arrives. Cloud-hosted providers on the public internet need neither.',
        },
        {
          strong: 'Admin controls.',
          text: 'Admins can set a Git URL allowlist to limit which repositories users can clone, commit to, or push to, and can encrypt stored Git credentials with customer-managed keys. Git folders use HTTPS only, not SSH, and do not support GPG commit signing.',
        },
      ],
      options: {
        caption: 'Which Git credential to use',
        rows: [
          {
            option: 'Databricks GitHub app (OAuth)',
            when: 'People using hosted GitHub or GitHub Enterprise Cloud.',
            tradeoffs: 'It uses OAuth 2.0, renews tokens automatically, and limits access to the repositories you choose. GitHub Enterprise Server cannot link this way, and Enterprise Managed Users can use it for organization repositories only.',
          },
          {
            option: 'Personal access token',
            when: 'Providers without OAuth linking, such as Azure DevOps, and GitHub Enterprise Server.',
            tradeoffs: 'Works with any provider reached over HTTPS. The token belongs to one person, expires, and has to be rotated by hand. Scope it to the repositories and permissions you need and set an expiry. Azure DevOps does not accept Microsoft Entra ID tokens for Git folders.',
          },
          {
            option: 'Service principal with its own Git credential',
            when: 'Jobs, CI pipelines, and anything that should not depend on a person.',
            tradeoffs: 'Automation keeps working when a person leaves, and commits show a machine identity. It is still a stored token on a dedicated bot or machine account, so give it an owner and an expiry.',
          },
        ],
        recommendation: 'Link the GitHub app for people on hosted GitHub, use a scoped token elsewhere, and run every job and pipeline as a service principal with its own credential.',
      },
      links: [
        {
          label: 'Connect your Git provider to Databricks',
          url: 'https://docs.databricks.com/aws/en/repos/get-access-tokens-from-git-provider',
          note: 'GitHub app, personal access tokens, and each provider.',
        },
        {
          label: 'Configure Git integration for Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/repos-setup',
          note: 'Credentials, commit identity, allowlists, and network setup.',
        },
        {
          label: 'Authorize a service principal to access Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/automate-with-sp',
          note: 'UI and CLI steps for automation credentials.',
        },
        {
          label: 'Git server proxy for Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/git-proxy',
          note: 'Connect to a private Git server.',
        },
      ],
    },
    {
      id: 'daily',
      heading: 'Day to day in a Git folder',
      prose:
        'The Git dialog covers the daily loop. Open it from the branch button beside a notebook name, or click Git beside the folder name.',
      steps: [
        {
          title: 'Clone',
          body: 'In the workspace sidebar, go to Workspace, then Create > Git folder. Enter the repository URL and provider. Put the folder under your own user area. You need CAN MANAGE on the parent folder.',
        },
        {
          title: 'Create a branch',
          body: 'Click Create Branch in the Git dialog, name it, and pick the base branch, usually main. Branch before you edit. If you cannot commit to the default branch, this is the only path anyway.',
        },
        {
          title: 'Switch branches carefully',
          body: 'Uncommitted changes carry over if they do not conflict. Switching to a branch that lacks a notebook deletes that asset from the folder, and switching back recreates it with a new ID and URL. Check that shared or bookmarked assets exist on the target branch first.',
        },
        {
          title: 'Commit and push',
          body: 'Write a commit message and click Commit & Push. The UI commits and pushes in one action. Open the pull request in your Git provider.',
        },
        {
          title: 'Pull and integrate',
          body: 'Click Pull to bring in remote changes. To update your branch from main, merge main into it. Merge does not rewrite history. Rebase gives a linear history but forces a push, which the docs warn can cause trouble for others on the same branch, so keep it for branches only you use.',
        },
        {
          title: 'Resolve conflicts in the UI',
          body: 'The Git folders UI lists conflicting files. Edit the markers by hand and choose Mark As Resolved, or take all current or all incoming changes. Then choose Continue Merge or Continue Rebase, or Abort to undo everything.',
        },
      ],
      points: [
        {
          strong: 'Pulls that change a notebook clear its state.',
          text: 'Cell outputs, comments, version history, and widgets reset when a pull changes the source. Commit, push, and creating a branch do not.',
        },
        {
          strong: 'Size limits to plan around.',
          text: 'Working branches are limited to 1 GB. Each Git operation supports up to 2 GB of memory and 4 GB of disk writes. Databricks recommends keeping workspace assets and files under 20,000, and the UI will not display files over 10 MB. Adding a large file to .gitignore later does not shrink the history.',
        },
        {
          strong: 'Monorepos: use sparse checkout, or split.',
          text: 'Databricks recommends against Git folders backed by large monorepos. If you must, enable Sparse checkout mode when you clone and list the directories you need as cone patterns. You cannot turn sparse checkout off for that folder afterwards, and new folders you create must fall inside the cone patterns or the commit fails. Git CLI access, in Public Preview, also handles repositories over the standard limits and adds stash, interactive rebase, submodules, and Git LFS.',
        },
      ],
      links: [
        {
          label: 'Create and manage Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/git-operations-with-repos',
          note: 'Clone, branch, commit, merge, rebase, conflicts, sparse checkout.',
        },
        {
          label: 'Git folder limits and reference',
          url: 'https://docs.databricks.com/aws/en/repos/limits',
          note: 'Size limits and behavior that differs from a local clone.',
        },
      ],
    },
    {
      id: 'team',
      heading: 'Team workflow',
      prose:
        'The Git folder UI supports any branching model. Trunk-based development with short-lived branches fits Databricks work best, because bundles deploy from one branch and long-lived branches drift.',
      points: [
        {
          strong: 'Trunk-based, with short branches.',
          text: 'Branch from main, make one change, open a pull request, and merge within days. Merge small changes often so conflicts stay small.',
        },
        {
          strong: 'Protect main in your Git provider.',
          text: 'Require a pull request, at least one approval, and passing status checks before a merge. Block direct pushes and force pushes. These are provider settings, for example GitHub branch protection or rulesets, not Databricks settings.',
        },
        {
          strong: 'Use CODEOWNERS for shared paths.',
          text: 'Assign owners to databricks.yml, resources, CI workflows, and shared packages so changes to deploy-critical files always get the right review. Pair it with the required-review rule.',
        },
        {
          strong: 'Pick squash or merge commits once.',
          text: 'Squash merge gives one commit per pull request on main, which is easy to read and revert. Regular merge keeps each commit. Either works with Git folders. Squash is a good default for a short-lived branch, and it means you should delete the branch after merging rather than keep working on it.',
        },
        {
          strong: 'Delete branches in the provider.',
          text: 'You cannot delete a branch from a Git folder. A local copy can linger for up to 30 days after the remote branch is deleted.',
        },
      ],
      options: {
        caption: 'How to merge a pull request',
        rows: [
          {
            option: 'Squash merge',
            when: 'Short-lived branches where one pull request is one logical change.',
            tradeoffs: 'One commit per pull request on main, which is easy to read and revert. Branch history is gone, so delete the branch after merging instead of working on it further.',
          },
          {
            option: 'Merge commit',
            when: 'Each commit on the branch means something and you want to keep it.',
            tradeoffs: 'History stays complete and no rewrite happens. The log on main gets longer and includes merge commits.',
          },
          {
            option: 'Rebase and merge',
            when: 'A linear history on a branch only you use.',
            tradeoffs: 'The history is linear. Rebase rewrites commits and forces a push, which the Databricks docs warn can cause trouble for others on the same branch.',
          },
        ],
        recommendation: 'Squash merge is a good default for short-lived branches. Pick one strategy per repository and set it in your Git provider, because Databricks does not enforce it.',
      },
      links: [
        {
          label: 'Create and manage Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/git-operations-with-repos',
          note: 'Merge, rebase, and conflict handling in the Git dialog.',
        },
      ],
    },
    {
      id: 'notebooks',
      heading: 'Notebooks under version control',
      prose:
        'Notebooks are code, so treat them like code: reviewable diffs, no generated output, no secrets.',
      points: [
        {
          strong: 'Pick one notebook format per repository.',
          text: 'New notebooks are .ipynb by default, and the docs recommend it. It keeps widgets, environment, and visualization definitions, and GitHub and GitLab render rich diffs for it. Source format (.py, .sql, and so on, with a # Databricks notebook source header) is plain text that diffs line by line in any review tool. Each user can change the default in Settings > Developer. Choose the one your reviewers can read.',
        },
        {
          strong: 'Source-format notebooks never commit outputs.',
          text: 'Outputs are not included in commits for .py, .sql, .scala, and .r notebooks. The tradeoff is that source format does not store dashboards or visualizations.',
        },
        {
          strong: '.ipynb outputs are off by default.',
          text: 'A workspace admin must allow output commits in Settings > Workspace admin > Development, in the Repos section. Even then, the .databricks/commit_outputs file in the repository controls which notebooks include outputs. Leave it off unless you have a reason, because outputs can hold query results with real data.',
        },
        {
          strong: 'Keep secrets, PII, and data out of the repo.',
          text: 'Read secrets from a secret scope or the environment at run time. Do not paste tokens into cells, or commit sample extracts, CSVs of real records, or output cells. Removing a committed secret means rewriting history and rotating the secret.',
        },
        {
          strong: 'Add a .gitignore.',
          text: 'Git folders honor .gitignore, but it only affects untracked files.',
        },
      ],
      examples: [
        {
          label: 'A starting .gitignore for a bundle repository',
          language: 'text',
          code: `# Local environments and build output
.venv/
__pycache__/
*.pyc
dist/
*.egg-info/

# Local environment and secrets
.env
*.pem

# Data and exports
*.csv
*.parquet
data/
.ipynb_checkpoints/`,
          notes: [
            'The Databricks extension for VS Code adds a .databricks/ entry to .gitignore for its local state. If you opt into .ipynb output commits, make sure .databricks/commit_outputs is not ignored.',
          ],
        },
      ],
      links: [
        {
          label: 'Manage Databricks notebook format',
          url: 'https://docs.databricks.com/aws/en/notebooks/notebook-format',
          note: 'Formats, the default, and the output commit settings.',
        },
        {
          label: 'Supported asset types in Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/supported-artifact-types',
          note: 'What a Git folder can version.',
        },
      ],
    },
    {
      id: 'inworkspace',
      heading: 'Collaboration in the workspace vs Git branches',
      prose:
        'Notebooks in the workspace support real-time co-editing and comments. Git branches isolate work. They solve different problems.',
      table: {
        caption: 'When each one fits',
        columns: ['Mechanism', 'Fits'],
        rows: [
          [
            'Real-time co-editing',
            'Pairing on a notebook, a live debugging session, or a workshop. Several people edit the same cell and see each other\'s changes.',
          ],
          [
            'Comments',
            'Questions and review notes on a cell. Mention a person with @, or mention Genie Code for help inside the thread. Share the notebook with CAN READ or higher.',
          ],
          [
            'Git branches',
            'Any change that will ship. Each person has their own folder and branch, and the pull request is the review record.',
          ],
        ],
      },
      points: [
        {
          strong: 'Co-edit to figure it out, branch to ship it.',
          text: 'Use live editing in a shared exploration or sandbox folder. Move the result into a repository branch before it counts as work.',
        },
        {
          strong: 'Do not co-edit inside a Git folder.',
          text: 'A shared Git folder has one branch state and one set of uncommitted changes. If people need to work together on a change, use one branch, each in their own Git folder, and pull from each other.',
        },
      ],
      links: [
        {
          label: 'Collaborate using Databricks notebooks',
          url: 'https://docs.databricks.com/aws/en/notebooks/notebooks-collaborate',
          note: 'Sharing, real-time editing, permissions, and comments.',
        },
      ],
    },
    {
      id: 'cicd',
      heading: 'How it connects to CI/CD',
      prose:
        'Git folders are for development. Databricks says so in its own docs: for CI/CD and production deployments, use Declarative Automation Bundles with versioned artifacts and workload identity federation.',
      steps: [
        {
          title: 'On every pull request',
          body: 'Run lint, pytest, and databricks bundle validate against the dev target. Make these required status checks on main.',
          code: `ruff check . && ruff format --check .
pytest tests
databricks bundle validate --target dev`,
        },
        {
          title: 'On merge to main',
          body: 'CI deploys the bundle to dev, then promotes the same commit to test and prod behind approvals. CI signs in as a service principal, ideally with workload identity federation instead of a stored secret.',
        },
        {
          title: 'Optional: work on the bundle from a Git folder',
          body: 'A Git folder whose root has a databricks.yml is recognized as a bundle. You can edit, commit, switch targets, deploy, and run from the workspace UI, with serverless compute enabled. Bundles inherit the permissions of their Git folder. This suits a developer without a local setup; CI is still what ships to production.',
        },
        {
          title: 'Run jobs from Git, not from a workspace path',
          body: 'If a job needs notebooks from a repository outside a bundle, set the job source to your Git provider. A job that reads a workspace Git folder can start in the middle of a pull and run notebooks from two different commits.',
        },
        {
          title: 'Only if you deploy code without bundles',
          body: 'Create a production Git folder for a deployment branch, give people Can Run only, give the service principal edit access, and update the folder from CI when a pull request merges. Prefer bundles; this is the fallback.',
        },
      ],
      links: [
        {
          label: 'CI/CD with Databricks Git folders',
          url: 'https://docs.databricks.com/aws/en/repos/ci-cd',
          note: 'User, merge, and admin flows, and production Git folders.',
        },
        {
          label: 'Collaborate on bundles in the workspace',
          url: 'https://docs.databricks.com/aws/en/dev-tools/bundles/workspace',
          note: 'Edit, deploy, and run a bundle from a Git folder.',
        },
        {
          label: 'GitHub Actions with Databricks',
          url: 'https://docs.databricks.com/aws/en/dev-tools/ci-cd/github',
          note: 'CI sign-in with workload identity federation.',
        },
      ],
    },
    {
      id: 'pitfalls',
      heading: 'Pitfalls',
      points: [
        {
          strong: 'Several people sharing one Git folder.',
          text: 'Switching the branch changes it for everyone with access, and uncommitted work mixes. Give each person a folder. To share a setup, use Share > Copy link to create Git folder, and your collaborator clones their own.',
        },
        {
          strong: 'Long-lived branches.',
          text: 'They drift from main, produce large conflicts, and hide changes from CI. Merge in days. For unfinished work, merge it behind a feature flag.',
        },
        {
          strong: 'Committing notebook outputs.',
          text: 'Outputs bloat diffs and can leak data into history. Keep the admin setting off, or scope commit_outputs tightly.',
        },
        {
          strong: 'A production Git folder that people edit.',
          text: 'A hand edit makes production differ from main, and the next automated update either overwrites it or fails. Restrict the folder to run-only for people, and let only the service principal update it. Better, deploy with bundles and have no production Git folder.',
        },
        {
          strong: 'Git credentials tied to a person who leaves.',
          text: 'When the account is deactivated or the token expires, jobs and automation that used it break. Run jobs and CI as a service principal with its own Git credential, back shared role credentials with a bot or machine account, and give those tokens an owner and a rotation date.',
        },
        {
          strong: 'Editing the same file in several places.',
          text: 'A Git folder, an IDE clone, and the extension\'s sync folder are separate copies. Treat the Git provider as the only place they meet.',
        },
      ],
    },
  ],
  related: [
    { slug: 'github-cicd', title: 'GitHub-based CI/CD' },
    { slug: 'dab-starter', title: 'Running a Declarative Automation Bundle' },
    { slug: 'environment-workspaces-catalogs', title: 'Workspaces and catalogs across dev, test, stage, and prod' },
    { slug: 'ide-developer-experience', title: 'Developer workflow in the IDE' },
    { slug: 'vscode-databricks', title: 'Working with Databricks in VS Code' },
  ],
};
