import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'genie-code',
  area: 'AI Guides',
  title: 'Genie Code: from sample data to notebooks and dashboards',
  intro:
    'Genie Code is the Databricks AI agent for data and AI work. It plans, writes code, runs it and fixes errors in notebooks, the SQL editor, the Lakeflow Pipelines Editor and AI/BI dashboards. Follow one story live: generate a governed sample dataset, shape it into silver and gold tables with Lakeflow Designer, build an analysis notebook and a dashboard with Genie Code, then check every output. Each step has the exact prompt to type and what to verify before moving on.',
  businessValue: {
    summary:
      'Analysts and engineers go from raw tables to a tested notebook and a dashboard in one sitting, and every generated line runs under Unity Catalog permissions and gets reviewed before it ships.',
    outcomes: [
      {
        title: 'Faster first draft',
        body: 'Genie Code drafts the flow, the notebook and the dashboard from a prompt that names the tables, so people review code instead of starting from a blank page.',
      },
      {
        title: 'Governed by default',
        body: 'Generated code runs as the person who asked, with that person’s Unity Catalog permissions. It cannot read a table the user cannot read.',
      },
      {
        title: 'Repeatable prompts',
        body: 'A prompt library in Git turns a good conversation into something a teammate can rerun, review and improve.',
      },
      {
        title: 'Checked, not trusted',
        body: 'Each step ends with a count, a reconciliation or an assert, so a wrong join or a doubled row shows up before a stakeholder sees it.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Genie Code works where you already edit.',
      body: 'It runs in notebooks, the SQL editor, the Lakeflow Pipelines Editor and dashboards, and in a terminal with the Genie Code CLI (Beta, October 6, 2026). It is an agent by default, and you can ask for a plain chat answer.',
    },
    {
      title: 'Pick the tool by who maintains the result.',
      body: 'Use Lakeflow Designer when a business user owns the prep, Genie Code when an engineer or analyst wants to review and edit code, and hand-written code when the logic needs tests and shared libraries.',
    },
    {
      title: 'Write prompts like a ticket.',
      body: 'Name the tables, state the grain, name the output table, ask for an assert, and read the diff before you run it.',
    },
    {
      title: 'Accept generated code in tiers.',
      body: 'Read-only profiling can run after a skim. Anything that writes a table or changes a shared object gets a line-by-line review and a reconciliation check.',
    },
    {
      title: 'Keep the prompts in Git.',
      body: 'Genie Code output varies from run to run, so the prompt and the check are the reproducible parts. Check totals and grain, not wording.',
    },
    {
      title: 'Put shared rules in instructions and task knowledge in skills.',
      body: 'Instructions apply to every request and cap at 20,000 characters. A skill is a SKILL.md folder that loads when a request matches its description. Add an MCP tool only when notebook code cannot do the job. The docs describe no hooks feature.',
    },
    {
      title: 'Run it as an organization from Git.',
      body: 'Review skills in pull requests, deploy them to the shared workspace folder from CI, let admins approve MCP servers, and default to managed connectors. Develop in your own folder, then publish.',
    },
    {
      title: 'Check the setup first.',
      body: 'Agentic Genie Code needs partner-powered AI features on at the account and workspace level. Designer needs access to Visual data prep. Dashboards need a serverless SQL warehouse.',
    },
  ],
  prerequisites: [
    {
      slug: 'no-code-data-prep',
      title: 'No-code data preparation',
      why: 'Step 1 builds the flow in Lakeflow Designer. That guide covers operators, outputs and promoting a flow to production.',
    },
  ],
  sections: [
    {
      id: 'what-and-where',
      heading: 'What Genie Code is and where it runs',
      prose:
        'The documentation describes Genie Code as an autonomous agent that plans a solution, retrieves context, runs code, reads cell output and fixes errors. Surfaces and stages below come from the Databricks docs and release notes as of October 22, 2026. Names and stages change quickly, so confirm the stage in your workspace before you promise a feature to a customer.',
      table: {
        caption: 'Genie Code surfaces and what the docs and release notes say about each',
        columns: ['Surface', 'What it does and its stage'],
        rows: [
          [
            'Notebooks',
            'Chat and agent, autocomplete, Quick Fix, Diagnose Error and natural-language data filtering. The features page lists these as generally available.',
          ],
          ['SQL editor', 'Writes and fixes SQL in the editor. Same agent, adapted to SQL.'],
          [
            'AI/BI dashboards',
            'The docs say Genie Code can plan and generate production-ready dashboards and help with data analysis. Dashboards also offer AI-assisted authoring for individual visualizations.',
          ],
          [
            'Lakeflow Pipelines Editor',
            'Builds Lakeflow pipelines and automates ETL. The editor itself is generally available.',
          ],
          [
            'Lakeflow Designer',
            'Builds and edits visual data preps in natural language: Genie Code adds, configures and connects operators. Lakeflow Designer is generally available per the release notes.',
          ],
          [
            'Genie Code CLI',
            'A coding agent in your terminal, started with the genie command. It works on local files and uses the Databricks CLI to discover data and build pipelines, models and apps, with model access through Unity Gateway. Beta since October 6, 2026.',
          ],
          [
            'Lakeflow Jobs task, AI Runtime, scheduled tasks',
            'Genie Code tasks in Lakeflow Jobs became generally available on October 21, 2026. Genie Code for AI Runtime is Public Preview. Scheduled tasks run a prompt on a recurring schedule and are generally available (September 1, 2026).',
          ],
        ],
      },
      points: [
        {
          strong: 'Agent mode is the default.',
          text: 'The agent plans, runs code and uses cell output. Ask for a direct conversational answer when you want an explanation without actions. Agent mode is available by default on workspaces with the compliance security profile.',
        },
        {
          strong: 'Context comes from Unity Catalog.',
          text: 'Genie Code uses table and column names and descriptions. Add comments to tables and columns, and reference tables with @ followed by the table name.',
        },
      ],
      links: [
        { label: 'Genie Code', url: 'https://docs.databricks.com/aws/en/genie-code/' },
        { label: 'Genie Code features', url: 'https://docs.databricks.com/aws/en/genie-code/features-capabilities' },
        { label: 'Release notes', url: 'https://docs.databricks.com/aws/en/release-notes/' },
      ],
    },
    {
      id: 'preflight',
      heading: 'Preflight: a governed sample dataset',
      prose:
        'The story needs data that every attendee can regenerate. The first notebook writes three tables with a fixed seed into the shared schema, adds table comments, and prints row counts and the revenue the gold tables must match. Every name starts with gc_, so the check can find them and cleanup is a single pattern.',
      diagram: {
        type: 'flow',
        title: 'The story, end to end',
        description:
          'Sample tables feed a Lakeflow Designer flow that writes silver and gold tables. A Genie Code notebook reads the gold tables, and a Genie Code dashboard visualizes them. A check notebook compares everything with the sample. A prompt library in Git drives the three interactive steps.',
        nodes: [
          {
            id: 'sample',
            label: 'Sample data',
            sub: 'gc_orders, gc_customers',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Preflight notebook. Writes gc_customers, gc_products and gc_orders with a fixed seed and CREATE OR REPLACE, so every run gives the same rows.',
          },
          {
            id: 'flow',
            label: 'Designer flow',
            sub: 'silver and gold',
            col: 1,
            row: 0,
            kind: 'surface',
            icon: 'workflow',
            domain: 'orchestration',
            detail:
              'Lakeflow Designer visual data prep named gc_orders_flow. Filters, joins, derives and aggregates into gc_orders_silver, gc_sales_by_region_month and gc_customer_value.',
          },
          {
            id: 'notebook',
            label: 'Analysis notebook',
            sub: 'profile, tier, chart',
            col: 2,
            row: 0,
            kind: 'surface',
            icon: 'gear-data',
            domain: 'ai',
            detail:
              'Genie Code in agent mode builds gc_orders_analysis: profiling, a spend-tier transformation and a chart, each with an assert.',
          },
          {
            id: 'dash',
            label: 'Dashboard',
            sub: 'gc_sales_dashboard',
            col: 3,
            row: 0,
            kind: 'surface',
            icon: 'dashboard',
            domain: 'apps',
            detail:
              'Genie Code in the dashboard drafts datasets, a counter, two charts, a table and a region filter on the two gold tables.',
          },
          {
            id: 'check',
            label: 'Check outputs',
            sub: 'reconcile, list gc_',
            col: 4,
            row: 0,
            kind: 'highlight',
            icon: 'checklist',
            domain: 'governance',
            detail:
              'Notebook that checks the tables exist, revenue reconciles to the sample, grain holds, and lists gc_ notebooks and dashboards. It reports gaps instead of failing.',
          },
          {
            id: 'prompts',
            label: 'Prompt library',
            sub: 'prompts.md in Git',
            col: 2,
            row: 1,
            kind: 'store',
            icon: 'list',
            domain: 'governance',
            detail:
              'The exact prompts for each step, kept in Git. They are the reproducible part, because generated code can differ between runs.',
          },
        ],
        edges: [
          { from: 'sample', to: 'flow' },
          { from: 'flow', to: 'notebook' },
          { from: 'notebook', to: 'dash' },
          { from: 'dash', to: 'check' },
          { from: 'prompts', to: 'notebook', dashed: true },
        ],
        legend: [
          { kind: 'surface', label: 'Interactive step' },
          { kind: 'highlight', label: 'Check' },
          { kind: 'dashed', label: 'Drives' },
        ],
      },
      steps: [
        {
          title: 'Run the preflight notebook or the job.',
          body: 'The job capability-guides-genie-code runs the preflight and then the check. The check reports the interactive steps as missing, which is correct at this point.',
        },
        {
          title: 'Note the printed counts.',
          body: 'Expect 2,000 customers, 30 products and 60,000 orders. The notebook also prints the order count and revenue for completed and shipped orders. The gold tables must match that revenue.',
        },
        {
          title: 'Confirm access.',
          body: 'You need USE CATALOG, USE SCHEMA, SELECT and CREATE TABLE on the schema. Genie Code runs as you, so these are the same privileges it uses.',
          code: 'SELECT COUNT(*) FROM <catalog>.<schema>.gc_orders;',
        },
      ],
    },
    {
      id: 'designer',
      heading: 'Step 1: shape silver and gold with Lakeflow Designer',
      prose:
        'Designer turns the sample into one silver table (a row per revenue order, joined to customer and product) and two gold tables. Operators, outputs and promotion to production are covered in the no-code data preparation guide, so this step only gives the prompts and the checks. Click the plus icon (New), choose Visual data prep, save the file as gc_orders_flow, and type each prompt in the canvas prompt, which opens Genie Code. The Output operator offers Overwrite, Append and Merge, and the prompts ask for Overwrite. Replace <catalog> and <schema> first.',
      steps: [
        {
          title: '1.1 Silver',
          body: 'Prompt, then check three things. The row count must equal the sample orders with status completed or shipped. COUNT(*) must equal COUNT(DISTINCT order_id). Region, segment and category must have no nulls.',
          code: 'Sources: <catalog>.<schema>.gc_orders, gc_customers and gc_products.\nKeep orders whose status is completed or shipped.\nJoin gc_customers on customer_id and gc_products on product_id (inner joins).\nAdd order_total = quantity * unit_price, and order_month = the first day of the month of order_ts.\nRemove duplicate rows by order_id with a Unique operator.\nWrite the result to the table <catalog>.<schema>.gc_orders_silver, overwrite mode.',
        },
        {
          title: '1.2 Gold: sales by region and month',
          body: 'Check that SUM(revenue) equals SUM(order_total) on silver, and that no (order_month, region, category) key repeats.',
          code: 'After the gc_orders_silver output, add an Aggregate.\nGroup by order_month, region and category.\nCompute orders = count of order_id, units = sum of quantity, revenue = sum of order_total.\nThe grain is one row per order_month, region and category.\nWrite the result to <catalog>.<schema>.gc_sales_by_region_month, overwrite mode.',
        },
        {
          title: '1.3 Gold: customer value',
          body: 'Check one row per customer_id, and that SUM(revenue) equals the silver total.',
          code: 'Add a second branch from gc_orders_silver.\nGroup by customer_id, region and segment.\nCompute orders = count of order_id, revenue = sum of order_total,\nfirst_order_date = min of order_ts cast to date, last_order_date = max of order_ts cast to date.\nThe grain is one row per customer_id.\nWrite the result to <catalog>.<schema>.gc_customer_value, overwrite mode.',
        },
      ],
      links: [
        { label: 'Lakeflow Designer', url: 'https://docs.databricks.com/aws/en/designer/' },
        {
          label: 'Build a transformation in Designer',
          url: 'https://docs.databricks.com/aws/en/designer/build-transformation',
        },
      ],
    },
    {
      id: 'notebook',
      heading: 'Step 2: build an analysis notebook with Genie Code',
      prose:
        'Create a notebook named gc_orders_analysis, attach serverless compute and open Genie Code in agent mode. Paste one prompt at a time. Each prompt reads a table from Step 1, states the grain, and asks for an assert, so a wrong answer fails inside the notebook.',
      steps: [
        {
          title: '2.1 Profile the silver table',
          body: 'Check that the plan only reads. The row count must match the silver count from Step 1.',
          code: 'In a new cell, profile <catalog>.<schema>.gc_orders_silver.\nShow the row count, the null count per column, the min and max of order_ts,\nthe number of distinct customer_id values, and revenue by status.\nOnly read the table. Do not write any table.\nAdd an assert that the row count equals the distinct order_id count.',
        },
        {
          title: '2.2 A transformation',
          body: 'Check that the tier counts add up and that no table is written. A percent_rank tier splits customers by revenue, so the high tier holds about a tenth of them.',
          code: 'Read <catalog>.<schema>.gc_customer_value.\nAdd spend_tier with percent_rank over revenue: top 10 percent is high, the next 40 percent is mid, the rest is low.\nThe grain stays one row per customer_id.\nDisplay the count of customers and the revenue per tier.\nAdd an assert that the tier counts add up to the row count of gc_customer_value.\nDo not write a table.',
        },
        {
          title: '2.3 A chart',
          body: 'Check the chart has one line per region, sorted by month, and that the assert passes.',
          code: 'Read <catalog>.<schema>.gc_sales_by_region_month.\nDraw a line chart of revenue by order_month with one line per region, sorted by month, with titles and axis labels.\nAdd an assert that the sum of the plotted values equals SUM(revenue) in the table.',
        },
      ],
      points: [
        {
          strong: 'Read the diff before you run.',
          text: 'Confirm table names, join keys and filters. If the plan reads a table you did not name, stop and restate the prompt.',
        },
        {
          strong: 'Fix by prompt, not by hand, once.',
          text: 'When the output is wrong, say what is wrong and what to check ("revenue is double the silver total, check for a fan-out join"). Then copy the improved prompt into the library.',
        },
      ],
    },
    {
      id: 'dashboard',
      heading: 'Step 3: build the AI/BI dashboard',
      prose:
        'The docs say Genie Code can plan and generate production-ready dashboards, and that dashboards also offer AI-assisted authoring for single visualizations. The public pages do not give a click path for a whole-dashboard draft, so open a new dashboard named gc_sales_dashboard, open Genie Code from it, and use the prompt below. If your workspace shows a different entry point, use the AI-assisted visualization path for each chart instead and keep the same dataset rules.',
      steps: [
        {
          title: '3.1 Draft the dashboard',
          body: 'Check the Data tab shows only the two gold tables, the counter equals SUM(revenue) on gc_sales_by_region_month, and picking one region changes all three filtered visuals.',
          code: 'In this dashboard, named gc_sales_dashboard, use <catalog>.<schema>.gc_sales_by_region_month and <catalog>.<schema>.gc_customer_value.\nUse one dataset per table and no joins. Select only the columns each visual needs.\nPage Overview:\n- a counter for total revenue\n- a line chart of revenue by order_month, split by region\n- a bar chart of revenue by category\n- a table of the top 10 customers by revenue, with segment and region\nAdd a filter on region that applies to the first three visuals.',
        },
        {
          title: '3.2 Polish',
          body: 'Check that the formatting prompt did not change the dataset SQL. It should only touch visual settings.',
          code: 'Format revenue as currency with no decimals, sort the bar chart from highest to lowest,\nand rename the visuals so each title says what it measures.',
        },
        {
          title: 'Run the dashboard on a serverless warehouse.',
          body: 'Dashboards run their datasets on a SQL warehouse. Use a serverless one so the first load does not wait for a cluster.',
        },
      ],
      links: [
        { label: 'AI/BI dashboards', url: 'https://docs.databricks.com/aws/en/dashboards/' },
        { label: 'Dashboard tutorials', url: 'https://docs.databricks.com/aws/en/dashboards/tutorials/' },
      ],
    },
    {
      id: 'check',
      heading: 'Step 4: run the check',
      prose:
        'Run 02_check_outputs, or rerun the job. It checks that the silver and gold tables exist, that revenue reconciles with the sample within half a cent, that silver has one row per order, and that each gold table holds its grain. It then lists notebooks, other workspace objects and dashboards whose names start with gc_. When a step is not done, it prints what is missing and which prompt to use, and it does not fail the run.',
      points: [
        {
          strong: 'Status complete.',
          text: 'Every table exists, totals reconcile, grain holds, and a gc_orders_flow, gc_orders_analysis and gc_sales_dashboard asset is found.',
        },
        {
          strong: 'Status incomplete.',
          text: 'The summary lists each problem and each missing step. A reconcile mismatch usually means a join fan-out or a different status filter in the silver prompt.',
        },
        {
          strong: 'Status needs_manual_check.',
          text: 'The docs do not say how a Designer file appears in a workspace listing. When the three output tables exist but the flow name is not found, or a listing call fails, the check says it could not confirm the asset instead of calling it missing. Open the workspace and look.',
        },
        {
          strong: 'Listing follows your permissions.',
          text: 'The check lists objects in your home folder and dashboards you can see. An asset in a shared folder you cannot read shows as missing.',
        },
      ],
    },
    {
      id: 'tool-choice',
      heading: 'Choose: Designer, Genie Code or hand-written code',
      prose:
        'All three can produce the same tables. The choice is about who maintains the result, how it is tested and how it moves to production.',
      options: {
        caption: 'Building a data prep',
        rows: [
          {
            option: 'Lakeflow Designer',
            when: 'A business user owns the prep, the steps are filter, join, aggregate and derive, and a visual canvas helps review.',
            tradeoffs:
              'Fastest for non-coders and governed by Unity Catalog. Every visual data prep is backed by generated code that you can version in Git and schedule as a job, but complex logic, shared libraries and unit tests are awkward on the canvas.',
          },
          {
            option: 'Genie Code',
            when: 'An analyst or engineer wants a first draft of notebook, SQL or pipeline code to review and edit.',
            tradeoffs:
              'Fast to a draft and handles more than a canvas can. Output varies by run, so it needs review, asserts and a saved prompt.',
          },
          {
            option: 'Hand-written code',
            when: 'The logic is business-critical, shared, or needs tests, code review and a deployment pipeline.',
            tradeoffs:
              'Most control and the easiest to test and version. It costs the most engineering time to write and maintain.',
          },
        ],
        recommendation:
          'Start with Designer for business-owned prep and Genie Code for everything an engineer will review. Move to hand-written code, using the generated code as the draft, when a flow needs tests or shared logic.',
      },
    },
    {
      id: 'agent-vs-chat',
      heading: 'Choose: agent mode or chat',
      options: {
        caption: 'How to ask Genie Code',
        rows: [
          {
            option: 'Agent mode (default)',
            when: 'The task needs several steps: read tables, write code, run it, read the output and fix errors.',
            tradeoffs:
              'Does more per prompt and can iterate on errors. It runs actions as you, so write prompts that say what not to write and review the plan.',
          },
          {
            option: 'Chat',
            when: 'You want an explanation, a snippet to adapt, or an answer about Databricks without actions on your workspace.',
            tradeoffs:
              'Predictable and low risk, but you run and fix everything yourself. Ask for it in the prompt when you want a direct answer.',
          },
        ],
        recommendation:
          'Use agent mode for building and chat for learning. In this story, agent mode builds the notebook and dashboard, and you ask chat to explain a diff you do not follow.',
      },
    },
    {
      id: 'accept-code',
      heading: 'Choose: when to accept generated code',
      prose:
        'The docs recommend you always review code Genie Code generates before running it, because it can make mistakes. Review effort should follow what the code can change.',
      options: {
        caption: 'Review tiers',
        rows: [
          {
            option: 'Read-only analysis',
            when: 'Profiling, exploration, charts. Nothing is written.',
            tradeoffs:
              'Skim the diff, run it, and check the numbers against a count you know. A mistake costs a re-run.',
          },
          {
            option: 'Writes a table you own',
            when: 'A new gc_ table in your schema, replaced on rerun.',
            tradeoffs:
              'Read every line, confirm the target name and mode, and run a reconciliation. A mistake costs a rebuild.',
          },
          {
            option: 'Changes shared or production objects',
            when: 'Existing tables, jobs, pipelines or dashboards others use.',
            tradeoffs:
              'Use a branch or a copy, require a second reviewer, and test against sample data first. A mistake affects other people.',
          },
        ],
        recommendation:
          'Match review depth to blast radius. Ask for asserts in every prompt, so the code checks itself, and never accept a write to a shared object without a diff you have read.',
      },
    },
    {
      id: 'reproducible',
      heading: 'Choose: how to keep prompts reproducible',
      options: {
        caption: 'Where prompts live',
        rows: [
          {
            option: 'Prompt library in Git',
            when: 'A team reuses prompts, reviews changes and wants history.',
            tradeoffs:
              'Reviewable and versioned. It takes discipline to update the file when a chat improves a prompt.',
          },
          {
            option: 'Saved in chat history',
            when: 'One person explores, and the result is not reused.',
            tradeoffs:
              'No setup, but hard to share or review. Threads can be shared, but they are not a source of truth.',
          },
          {
            option: 'Genie Code instructions and skills',
            when: 'Rules apply to every prompt, such as naming rules and the default schema.',
            tradeoffs:
              'Applied automatically, so prompts stay short. The rules are hidden from a reader of the prompt, so keep a copy in Git too.',
          },
        ],
        recommendation:
          'Keep prompts.md in Git next to the check notebook. Put stable team rules in instructions, and record in the file which prompt produced which table.',
      },
      links: [
        { label: 'Genie Code instructions', url: 'https://docs.databricks.com/aws/en/genie-code/instructions' },
        { label: 'Genie Code skills', url: 'https://docs.databricks.com/aws/en/genie-code/skills' },
      ],
    },
    {
      id: 'prompting',
      heading: 'Write prompts that produce checkable code',
      points: [
        {
          strong: 'Name the tables.',
          text: 'Use the full catalog.schema.table name or an @ reference. A prompt that says "the orders table" lets the agent pick one.',
        },
        {
          strong: 'State the grain.',
          text: 'Say "one row per order_id" or "one row per order_month, region and category". The grain tells the agent how to aggregate and gives you a duplicate test.',
        },
        {
          strong: 'Name the output and the write mode.',
          text: 'Give the target table and say overwrite. Say "do not write any table" for analysis.',
        },
        {
          strong: 'Ask for tests.',
          text: 'Request an assert that ties the result to a source total. The check notebook repeats those reconciliations.',
        },
        {
          strong: 'Review the diff.',
          text: 'Read the plan and the code before running. Ask chat to explain anything you cannot follow.',
        },
        {
          strong: 'Document the data.',
          text: 'Table and column comments in Unity Catalog improve the answers. The preflight notebook adds table comments for this reason.',
        },
      ],
      links: [{ label: 'Tips for Genie Code responses', url: 'https://docs.databricks.com/aws/en/genie-code/tips' }],
    },
    {
      id: 'extending',
      heading: 'Extend Genie Code: instructions, skills, tools',
      prose:
        'Four mechanisms change what Genie Code knows or can reach. Instructions are text that applies to every request. Skills are folders that load when a request matches. Tools are MCP servers and Unity Catalog objects the agent can call. A Genie Agent answers data questions over curated tables. Locations and formats below come from the Genie Code documentation as of October 22, 2026. The docs show no Beta label on skills, instructions or MCP server support, so confirm the stage in your workspace.',
      table: {
        caption: 'Documented locations and formats',
        columns: ['Item', 'Where it lives and what the docs say'],
        rows: [
          [
            'User instructions',
            '.assistant_instructions.md in /Users/<your-username-or-email>. Up to 20,000 characters.',
          ],
          [
            'Workspace instructions',
            '.assistant_workspace_instructions.md in the Workspace root. Up to 20,000 characters. Only workspace admins can add or edit it. Genie Code generally prioritizes workspace instructions over user instructions.',
          ],
          [
            'Project files',
            'AGENTS.md and CLAUDE.md files are found by walking the directory tree when you open a notebook or file. No setup.',
          ],
          ['User skills', '/Users/<username>/.assistant/skills/<skill-name>/SKILL.md. Visible to you.'],
          [
            'Workspace skills',
            'Workspace/.assistant/skills/<skill-name>/SKILL.md. Workspace admins create them and can grant others access to the folder. You can also register additional folders by path.',
          ],
          [
            'MCP servers',
            'Added in the Genie Code pane under Settings, MCP Servers, Add Server. The docs describe no config file or JSON path, so there is nothing to keep in Git for this part.',
          ],
        ],
      },
      steps: [
        {
          title: 'What a skill is.',
          body: 'A folder with a required SKILL.md and any files it points to, such as reference notes or scripts. The format follows the open Agent Skills standard (agentskills.io). Genie Code loads a skill when your request matches its description, and you can call one by typing @ and its name. Changes reach new chats only.',
          code: 'Workspace/.assistant/skills/\n  gc-sample-data/\n    SKILL.md\n    reference/tables.md\n    scripts/check_totals.py',
        },
        {
          title: 'How to write one.',
          body: 'Front matter needs name and description. The description is what Genie Code matches against, so say what the skill does and when to use it. Keep the body to rules and steps, and move long reference text into attached files. The name should match the folder, in lowercase with hyphens (limits of 64 and 1,024 characters for name and description come from the open standard, not the Genie Code page).',
          code: '---\nname: gc-sample-data\ndescription: Knows the gc_ sample tables and the prompt conventions. Use when a request mentions gc_ tables, revenue by region, or customer value.\n---\n# gc-sample-data\n\n- Revenue orders have status completed or shipped.\n- Every gold total equals SUM(order_total) on gc_orders_silver.\n- Name the grain, the output table and an assert in every prompt.',
        },
        {
          title: 'Install the example.',
          body: 'The reference notebook 03_install_skills validates the example skill, copies it into your own skills folder and rewrites it in place on a rerun. It prints the publish steps for the shared folder and writes there only when you set write_workspace_wide to yes.',
        },
      ],
      points: [
        {
          strong: 'Tools: what you can add.',
          text: 'Databricks-managed connectors cover Google Drive, Gmail, Google Calendar, Microsoft 365, Atlassian, Glean, Slack and GitHub. You can add Unity Catalog MCP services (external servers registered in Unity Catalog), Unity Catalog functions, AI Search indexes, Genie Agents, and custom MCP servers hosted as Databricks Apps. Each user authenticates on their own and OAuth tokens are not shared between users. External MCP servers work only in regions where Model Serving is supported.',
        },
        {
          strong: 'Genie One MCP.',
          text: 'The Genie One MCP server is generally available as system.ai.genie_one_mcp in Unity Gateway (September 25, 2026). The earlier Beta endpoint under /api/2.0/mcp/genie is deprecated and sunsets October 31, 2026, so point any client at the new service.',
        },
        {
          strong: 'Hooks.',
          text: 'The public Genie Code docs and release notes describe no hooks feature, meaning no pre-action or post-action commands that run around a tool call. Do not plan on one. The documented alternatives are asserts in the prompt, instructions that require a plan before a write, Unity Catalog permissions that limit what the agent can write, scheduled tasks (generally available September 1, 2026), and the Genie Code task in Lakeflow Jobs (generally available October 21, 2026).',
        },
      ],
      options: {
        caption: 'Where a rule or capability should live',
        rows: [
          {
            option: 'Instructions',
            when: 'A short rule applies to every request, such as naming, the default schema or a style rule.',
            tradeoffs:
              'Always applied, so every request pays for the text and a long file dilutes the rules. Capped at 20,000 characters. Workspace instructions are admin-only, and user instructions can be overridden in conflict.',
          },
          {
            option: 'Skill',
            when: 'Knowledge or a workflow applies to one kind of task, such as the gc_ tables, a review checklist or a migration recipe.',
            tradeoffs:
              'Loads only when the description matches, so a vague description means it never fires. It can carry files and scripts. It is text and code, so it needs review like any other code.',
          },
          {
            option: 'Tool (MCP server, Unity Catalog function)',
            when: 'The agent must reach a system or run logic it cannot do from notebook code, such as a ticketing system, a document store or a governed function.',
            tradeoffs:
              'Gives real reach, so it needs the most governance. Each user authenticates, an external server adds a data path outside Databricks, and a bad tool description sends the agent to the wrong place.',
          },
          {
            option: 'Genie Agent',
            when: 'People ask business questions over a curated set of tables and want answers with Unity Catalog governance.',
            tradeoffs:
              'Best for repeated questions on known tables, with curated instructions and sample queries. It does not write code or change objects. See the Genie Agents guide.',
          },
        ],
        recommendation:
          'Start with a short instructions file for the rules everyone shares. Put task knowledge in skills. Add a tool only when notebook code cannot do the job, and add a Genie Agent when the need is business questions on stable tables.',
      },
      links: [
        { label: 'Agent skills', url: 'https://docs.databricks.com/aws/en/genie-code/skills' },
        { label: 'Add custom instructions', url: 'https://docs.databricks.com/aws/en/genie-code/instructions' },
        { label: 'Connect to MCP servers', url: 'https://docs.databricks.com/aws/en/genie-code/mcp' },
        { label: 'Agent Skills standard', url: 'https://agentskills.io' },
      ],
    },
    {
      id: 'org-management',
      heading: 'Manage Genie Code across an organization',
      prose:
        'The practices below follow from the documented locations and permissions. The docs do not give a rollout process, so the sequence and naming rules are recommendations. Treat skills, instructions and MCP choices like code and access policy, with owners, review and a way to retire them.',
      diagram: {
        type: 'flow',
        title: 'From Git to every user',
        description:
          'Skills and instructions live in a Git repository. A pull request is reviewed, CI copies the files to the shared workspace folder, and Genie Code loads them. A workspace admin separately approves the MCP servers users can add.',
        nodes: [
          {
            id: 'repo',
            label: 'Git repo',
            sub: 'skills, instructions',
            col: 0,
            row: 0,
            kind: 'store',
            icon: 'data-file',
            domain: 'governance',
            detail:
              'One folder per skill with a SKILL.md, plus the workspace instructions file. History, owners and review all come from Git.',
          },
          {
            id: 'review',
            label: 'Pull request review',
            col: 1,
            row: 0,
            kind: 'gate',
            domain: 'governance',
            detail: 'A named reviewer checks the description, the rules and any script before merge.',
          },
          {
            id: 'ci',
            label: 'CI deploy',
            sub: 'workspace import',
            col: 2,
            row: 0,
            kind: 'box',
            icon: 'workflow',
            domain: 'orchestration',
            detail:
              'A service principal with write access to the shared folder copies the merged files. Only CI writes there.',
          },
          {
            id: 'folder',
            label: 'Shared folder',
            sub: 'Workspace/.assistant',
            mono: true,
            col: 3,
            row: 0,
            kind: 'store',
            icon: 'database',
            domain: 'data',
            detail:
              'Workspace skills and the workspace instructions file. Everyone in the workspace can use what is here.',
          },
          {
            id: 'genie',
            label: 'Genie Code',
            sub: 'new chats',
            col: 4,
            row: 0,
            kind: 'surface',
            icon: 'gear-data',
            domain: 'ai',
            detail:
              'Loads a skill when a request matches and applies the instructions. Open chats do not pick up changes.',
          },
          {
            id: 'admin',
            label: 'Admin approval',
            col: 3,
            row: 1,
            kind: 'gate',
            domain: 'governance',
            detail:
              'Workspace admins approve the MCP servers users can add. Unity Catalog privileges on connections and functions decide who can use them.',
          },
        ],
        edges: [
          { from: 'repo', to: 'review' },
          { from: 'review', to: 'ci' },
          { from: 'ci', to: 'folder' },
          { from: 'folder', to: 'genie' },
          { from: 'admin', to: 'genie', dashed: true },
        ],
        legend: [
          { kind: 'store', label: 'Stored' },
          { kind: 'surface', label: 'User-facing' },
          { kind: 'dashed', label: 'Gates tools' },
        ],
      },
      points: [
        {
          strong: 'Keep it in Git, deploy from CI.',
          text: 'Keep skills, the workspace instructions text and a list of approved MCP servers in one repository. A CI job running as a service principal copies skill folders with the Databricks CLI. For skills that hold only Markdown, databricks workspace import-dir skills/gc-sample-data /Workspace/.assistant/skills/gc-sample-data --overwrite does it. The import-dir command turns .py and .sql files into notebooks, so upload skills with scripts one file at a time with databricks workspace import --format RAW --overwrite. Check both commands with --help in your CLI version.',
        },
        {
          strong: 'Workspace instructions are admin-only.',
          text: 'Only workspace admins can add or edit .assistant_workspace_instructions.md. Keep the text in Git, keep it under 20,000 characters, and have an admin paste or upload the merged version. Put the rules every user must follow there, and leave task knowledge to skills.',
        },
        {
          strong: 'Who can add MCP servers.',
          text: 'The docs say workspace administrators control which servers are available and users pick from those. Use Unity Catalog to back that up. Grant USE CONNECTION on a connection and EXECUTE on a function only to the groups that should call them, since the agent acts as the user. Review each external server for what data leaves the workspace.',
        },
        {
          strong: 'Model and tool controls in Unity Gateway.',
          text: 'Unity Gateway can screen MCP tool calls and their results for jailbreak and prompt injection attempts (Beta, October 21, 2026), applied on input, output or both. Release notes from September 22, 2026 describe central configuration of models, MCP servers and skills for coding agents launched through the ug CLI. The docs do not say the in-workspace Genie Code pane reads those settings, so confirm before you rely on them there. The Genie Code CLI (Beta, October 6, 2026) uses Unity Gateway for model access.',
        },
        {
          strong: 'Partner-powered AI setting.',
          text: 'Since September 8, 2026 the setting cannot be turned off in the account or workspace settings UI. The Settings API could still change it until November 1, 2026. On that date the setting is removed and any change goes through your Databricks account team. Plan for it to stay on, and set data-handling rules in instructions and in Unity Catalog permissions.',
        },
        {
          strong: 'Audit and usage.',
          text: 'Generated code runs as the user, so table access is attributed to that user in the audit sources you already use. The system.ai_gateway.usage system table gained coding-agent session metadata and token details in Public Preview on September 27, 2026, and Unity Gateway tracing includes coding-agent activity. The docs do not say that usage from the Genie Code pane lands in that table. Genie budgets set limits at account, workspace and user level, and the Measure Genie Code impact page covers adoption. Confirm what your workspace logs before you promise a report.',
        },
        {
          strong: 'Naming, versions and review.',
          text: 'Prefix skills by owner or domain, for example sales-pipeline-review, and keep the folder name equal to the name field. Put an owner, a version and a last-reviewed date in the SKILL.md body. Tag releases in Git and deploy from a tag so you can roll back by redeploying the previous one. Review a skill like code, with a second person reading the description, every rule and every script.',
        },
        {
          strong: 'Roll out in stages.',
          text: 'Test a skill in a few user folders, then publish to the shared folder for a pilot group, then to everyone. Because the shared folder is workspace-wide, a pilot group needs either a separate workspace or per-user installs, since the docs describe no group-level skill scope. Collect misfires (skill never loaded, wrong skill loaded) and fix the description first.',
        },
        {
          strong: 'Deprecate stale skills.',
          text: 'Review the shared folder each quarter. A skill with no owner, or a description that matches too much, goes first. Mark it deprecated in its description for one release, then delete the folder through CI so the repository stays the source of truth.',
        },
      ],
      links: [
        { label: 'Agent skills', url: 'https://docs.databricks.com/aws/en/genie-code/skills' },
        { label: 'Genie budgets', url: 'https://docs.databricks.com/aws/en/genie/budgets' },
        { label: 'Release notes', url: 'https://docs.databricks.com/aws/en/release-notes/' },
      ],
    },
    {
      id: 'skills-scope',
      heading: 'Choose: per-user or shared skills',
      options: {
        caption: 'Where a skill is installed',
        rows: [
          {
            option: 'Per-user skills',
            when: 'One person experiments, or a skill is not ready for others.',
            tradeoffs:
              'No approval needed and no effect on anyone else. Copies drift, nobody reviews them, and a fix reaches only the people who update.',
          },
          {
            option: 'Shared workspace skills',
            when: 'A skill carries team rules or domain knowledge many people need.',
            tradeoffs:
              'One reviewed copy and one place to fix. It is visible to the whole workspace, writing needs access to the folder, and a bad skill affects everyone, so deploy it from CI.',
          },
        ],
        recommendation:
          'Develop in your own folder, then publish to the shared folder through a pull request and CI. Keep personal skills for drafts and private habits.',
      },
    },
    {
      id: 'skills-repo',
      heading: 'Choose: a central skills repo or team-owned repos',
      options: {
        caption: 'Who owns the skills repository',
        rows: [
          {
            option: 'One central repo',
            when: 'A platform or enablement team owns standards, and skills are few and general.',
            tradeoffs:
              'Consistent naming, one review path and one deploy job. Domain teams wait on the central team, and reviewers lack domain context.',
          },
          {
            option: 'Team-owned repos',
            when: 'Domain teams know their tables and processes and ship often.',
            tradeoffs:
              'Fast and accurate for the domain. Names can collide in the shared folder, quality varies, and you need shared rules for the format and review.',
          },
          {
            option: 'Central standards, team-owned skills',
            when: 'Many teams, one workspace, and a platform team that can run the deploy.',
            tradeoffs:
              'Teams own content and a central pipeline enforces the naming rule, validates the front matter and deploys. It takes setup, and the validation must stay current.',
          },
        ],
        recommendation:
          'Start with one repo and a CODEOWNERS file per skill folder. Split into team repos when review becomes the bottleneck, and keep one deploy pipeline with the same validation checks.',
      },
    },
    {
      id: 'mcp-policy',
      heading: 'Choose: allow external MCP servers or not',
      options: {
        caption: 'Policy for tools outside Databricks',
        rows: [
          {
            option: 'Managed connectors and Databricks tools only',
            when: 'Regulated data, a new rollout, or no security review capacity yet.',
            tradeoffs:
              'Smallest data path, and Unity Catalog covers most of it. Users cannot reach systems that have no managed connector.',
          },
          {
            option: 'Approved external servers through Unity Catalog',
            when: 'A named external system is needed and the owner can review what the server returns and accepts.',
            tradeoffs:
              'Real reach, with an admin-controlled list and Unity Catalog privileges on the connection. Each server adds a data path to review, OAuth per user, and Model Serving region limits.',
          },
          {
            option: 'Open: users add any server',
            when: 'A sandbox workspace with no sensitive data.',
            tradeoffs:
              'Fastest to explore. Prompt injection through tool results and data leaving the workspace are the main risks, and nobody can audit what is connected.',
          },
        ],
        recommendation:
          'Default to managed connectors and Databricks tools. Add external servers one at a time after a review, grant access by group, and screen tool calls in Unity Gateway where it is available.',
      },
    },
    {
      id: 'governance',
      heading: 'Governance, data usage and settings',
      points: [
        {
          strong: 'Runs as you.',
          text: 'Generated code runs with your Unity Catalog permissions. Row filters and column masks apply, and it cannot read what you cannot read. Nothing in this story is created at account level.',
        },
        {
          strong: 'What goes to the model.',
          text: 'The docs say Genie Code sends your prompt and relevant context to the model: table and column names, descriptions, the code you are working with, data samples from tables and cell outputs, all within your Unity Catalog permissions. Do not run the story on sensitive tables unless that is acceptable.',
        },
        {
          strong: 'Partner-powered AI features.',
          text: 'Agentic Genie Code needs this setting on at the account and workspace level. With it on, features use Azure OpenAI service, OpenAI on Databricks or Anthropic on Databricks. With it off, the agentic capabilities are not available. Genie Code Autocomplete is hosted by Databricks either way. The docs say Databricks will remove the setting on November 1, 2026, and after that date you contact your account team to change it, so check the current page.',
        },
        {
          strong: 'Compliance profiles.',
          text: 'Release notes say agent mode is available by default on workspaces with the compliance security profile, and Genie Code is available on HIPAA compliance security profile workspaces with partner-powered AI features disabled. Check your region and profile.',
        },
        {
          strong: 'Cost.',
          text: 'Since July 8, 2026 Databricks charges for Genie Code usage beyond a free monthly allowance per user, and the Genie budgets page covers limits at account, workspace and user level. Check it before a large rollout. Use serverless compute so nothing bills while idle.',
        },
      ],
      links: [
        {
          label: 'Partner-powered AI features',
          url: 'https://docs.databricks.com/aws/en/databricks-ai/partner-powered',
        },
        {
          label: 'Databricks AI trust and safety',
          url: 'https://docs.databricks.com/aws/en/databricks-ai/databricks-ai-trust',
        },
        { label: 'Genie budgets', url: 'https://docs.databricks.com/aws/en/genie/budgets' },
      ],
    },
  ],
  related: [
    { slug: 'no-code-data-prep', title: 'No-code data preparation' },
    { slug: 'sql-notebook-analysis', title: 'SQL and notebooks at scale' },
    { slug: 'in-platform-visualization', title: 'Charts and dashboards in the platform' },
    { slug: 'ai-functions', title: 'AI Functions in SQL' },
    { slug: 'genie-agents', title: 'Genie Agents' },
  ],
};
