import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'cost-chargeback',
  area: 'Governance/Monitoring',
  title: 'Cost tracking and chargeback',
  intro:
    'Chargeback works when every unit of spend carries a label for who owns it. On classic compute that label is a custom tag. On serverless it comes from a serverless usage policy, because there is no cluster to tag. Databricks writes the labels into system.billing.usage, where you join them to list prices, report by team, and raise alerts with Budgets. This page covers how to attribute spend for each product, how to enforce the labels, which columns identify the workload and the person, and how to forecast without fooling yourself.',
  businessValue: {
    summary:
      'Finance and platform leaders need to bill each team for its own Databricks spend. This guide shows how to label usage so cost lands with the right owner, and how to alert before a budget is exceeded.',
    outcomes: [
      {
        title: 'Each team sees its own bill',
        body:
          'Classic compute carries custom tags and serverless carries tags from serverless usage policies. Both land in system.billing.usage, so finance can report cost by team and cost center.',
      },
      {
        title: 'Untagged spend gets smaller',
        body:
          'Compute policies require tags and every user, group, and service principal gets a serverless usage policy. Untagged cost shrinks to a short work queue that owners can clear.',
      },
      {
        title: 'Alerts before the month closes',
        body:
          'Budgets email an owner when monthly spend crosses a threshold, scoped to workspaces, products, or tags. Owners can act before the invoice arrives.',
      },
      {
        title: 'Shared warehouses can be split',
        body:
          'Query tags in system.query.history divide a shared SQL warehouse\'s cost by team or app, so shared compute does not have to be billed as one lump.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Tag classic compute; use policies for serverless.',
      body: 'Custom tags on clusters, pools, and warehouses flow into billing. Serverless usage policies add tags to serverless notebooks, jobs, pipelines, apps, and endpoints.',
    },
    {
      title: 'Enforce the tags.',
      body: 'Require tags in compute policies, and assign a serverless usage policy to every user, group, and service principal. Untagged spend is the number to drive to zero.',
    },
    {
      title: 'Use Budgets for threshold alerts.',
      body: 'Budgets (generally available) email you when monthly spend crosses a line, scoped to workspaces, products, or tags.',
    },
    {
      title: 'Attribute with usage_metadata and identity_metadata.',
      body: 'They identify the job, warehouse, endpoint, or app behind a record, and the identity that ran it. Use them when tags are missing.',
    },
    {
      title: 'Forecast after you have a cycle of history.',
      body: 'A projection from a few days of data shows a method, not a plan.',
    },
  ],
  sections: [
    {
      id: 'attribute',
      heading: 'Attribute spend: tags and serverless usage policies (formerly serverless budget policies)',
      table: {
        caption: 'How each kind of spend gets its label',
        columns: ['Spend', 'Label'],
        rows: [
          [
            'Classic clusters, pools, and warehouses',
            'Custom tags on the resource, ideally set by a compute policy. They appear in custom_tags.',
          ],
          [
            'Serverless notebooks, jobs, pipelines, apps, endpoints',
            'A serverless usage policy assigned to the user, group, or service principal. Its tags appear in custom_tags. Assignment applies to new work; update existing jobs to attach a policy.',
          ],
          [
            'Queries on a shared SQL warehouse',
            "Query tags (generally available). They are in system.query.history.query_tags and let you split a shared warehouse's cost by team or app.",
          ],
          ['Unity Gateway model usage', 'Endpoint and Unity Catalog tags, and per-user budgets on the gateway.'],
        ],
      },
      points: [
        {
          strong: 'Naming.',
          text: 'Serverless usage policies were renamed from budget policies. The current docs page is titled serverless usage policies and the billing column is usage_policy_id; budget_policy_id is deprecated.',
        },
        {
          strong: 'Pick a small tag set.',
          text: 'For example team, cost_center, environment, and application. Each tag you add is one more thing to keep correct.',
        },
        {
          strong: 'Jobs win over notebooks.',
          text: "When a notebook runs inside a job, the job's policy applies to the usage record.",
        },
      ],
      options: {
        caption: 'How to split spend between teams',
        rows: [
          {
            option: 'Tags and serverless usage policies',
            when: 'Teams share workspaces and you charge back by team, cost center, or application.',
            tradeoffs:
              'Splits spend inside a workspace and shows up in billing records as custom_tags. It only works when tags are correct, so enforce them with compute policies and watch untagged spend. A policy applies to new work, and existing jobs need it attached.',
          },
          {
            option: 'A workspace per team or business unit',
            when: 'Isolation needs already justify separate workspaces.',
            tradeoffs:
              'Billing records carry workspace_id, so attribution needs no tags. It adds administration for each workspace, and shared catalogs, warehouses, and jobs still need another way to split their cost.',
          },
          {
            option: 'Query tags on a shared SQL warehouse',
            when: 'You want to split one warehouse\'s cost between teams or apps.',
            tradeoffs:
              'Tags land in system.query.history, so you can see who used the warehouse. The billing table does not carry them, so you design the allocation rule that turns query activity into dollars.',
          },
        ],
        recommendation:
          'Use tags and serverless usage policies as the default, with a small tag set that compute policies enforce. Use workspace boundaries where isolation already calls for them, and add query tags only for shared warehouses.',
      },
      links: [
        {
          label: 'Use tags to attribute and track usage',
          url: 'https://docs.databricks.com/aws/en/admin/account-settings/usage-detail-tags',
        },
        { label: 'Serverless usage policies', url: 'https://docs.databricks.com/aws/en/admin/usage/budget-policies' },
        { label: 'Query tags', url: 'https://docs.databricks.com/aws/en/sql/user/queries/query-tags' },
        { label: 'Billable usage system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing' },
        { label: 'Compute policies', url: 'https://docs.databricks.com/aws/en/admin/clusters/policies' },
      ],
    },
    {
      id: 'enforce',
      heading: 'Enforce tagging, and watch untagged spend',
      prose: 'Tags drift unless something requires them. Enforcement is what makes a chargeback report trustworthy.',
      points: [
        {
          strong: 'Compute policies.',
          text: 'Set a required or fixed custom tag in policies for classic compute, so no cluster can start without a cost center.',
        },
        {
          strong: 'Serverless usage policies for everyone.',
          text: 'A user with one assigned policy gets it automatically. A user with several must choose one, and otherwise the alphabetically first applies. Assign a policy to each group and service principal.',
        },
        {
          strong: 'Measure untagged spend.',
          text: 'Report the share of cost with no value for your required tag, by workspace and owner. That list is the work queue.',
        },
      ],
      examples: [
        {
          label: 'Untagged spend by owner, last 30 days',
          language: 'sql',
          code: `SELECT workspace_id, billing_origin_product,
       coalesce(identity_metadata.run_as, identity_metadata.owned_by, identity_metadata.created_by) AS owner,
       sum(usage_quantity) AS dbus
FROM system.billing.usage
WHERE usage_date >= current_date() - INTERVAL 30 DAYS
  AND custom_tags['cost_center'] IS NULL
GROUP BY ALL
ORDER BY dbus DESC;`,
          notes: [
            'Replace cost_center with your required tag. Multiply DBUs by system.billing.list_prices to get dollars.',
          ],
        },
      ],
    },
    {
      id: 'metadata',
      heading: 'usage_metadata and identity_metadata',
      prose:
        'Tags describe intent. The metadata columns describe what actually ran and who ran it, so they fill gaps and cross-check the tags.',
      table: {
        columns: ['Column', 'What it gives you'],
        rows: [
          [
            'usage_metadata',
            'IDs and names of the resource behind the record, such as the cluster, warehouse, job and run, pipeline update, notebook, serving endpoint, or app. Only some fields are filled for each product.',
          ],
          ['identity_metadata.run_as', 'Who ran the workload. How it is set depends on the product.'],
          ['identity_metadata.owned_by', 'The owner of the SQL warehouse (warehouse usage only).'],
          ['identity_metadata.created_by', 'The creator of an app, Knowledge Assistant, or Supervisor Agent.'],
          ['billing_origin_product', 'The product that produced the usage, such as JOBS, SQL, MODEL_SERVING, or APPS.'],
        ],
      },
      links: [
        { label: 'Billable usage system table', url: 'https://docs.databricks.com/aws/en/admin/system-tables/billing' },
        {
          label: 'Monitor costs using system tables',
          url: 'https://docs.databricks.com/aws/en/admin/usage/system-tables',
        },
      ],
    },
    {
      id: 'products',
      heading: 'Apps, Model Serving, and Unity Gateway',
      points: [
        {
          strong: 'Apps.',
          text: 'Usage records carry app_id and app_name in usage_metadata, and the creator in identity_metadata.created_by. Put the app under a serverless usage policy so its compute also carries your tags.',
        },
        {
          strong: 'Model Serving.',
          text: 'Records carry endpoint_name and endpoint_id. system.serving.endpoint_usage adds token counts when usage tracking is on (kept 90 days).',
        },
        {
          strong: 'Unity Gateway.',
          text: 'system.ai_gateway.usage records token usage, latency, and routing for gateway services. system.ai_gateway.external_model_spend (Beta) estimates USD spend for requests routed to external model providers. Budgets can be scoped to Unity Gateway.',
        },
      ],
      links: [{ label: 'Unity Gateway', url: 'https://docs.databricks.com/aws/en/ai-gateway/' }],
    },
    {
      id: 'budgets',
      heading: 'Budgets for threshold alerts',
      prose:
        'Budgets are the cost alert. An account admin creates one in the account console; workspace admins can manage budgets for the workspaces they administer. A budget measures spend in USD at list price, including platform add-ons.',
      points: [
        {
          strong: 'Scope.',
          text: 'Whole account, or filtered by workspace, product, and custom tags. A tag-scoped budget only counts usage that carries the tag, which is another reason to enforce tagging.',
        },
        {
          strong: 'Thresholds.',
          text: 'Up to four monthly thresholds per budget, each with its own email list. Recipients do not need Databricks accounts.',
        },
        {
          strong: 'Unity Gateway budgets.',
          text: 'Add per-user thresholds and overrides, and optionally block further gateway requests at the limit.',
        },
        {
          strong: 'Keep emails safe.',
          text: 'Budget names, tags, and recipients appear in notifications. Do not put sensitive data in them.',
        },
      ],
      links: [
        {
          label: 'Create and monitor budgets',
          url: 'https://docs.databricks.com/aws/en/admin/account-settings/budgets',
        },
      ],
    },
    {
      id: 'dashboards',
      heading: 'Account usage dashboards',
      prose:
        'Account admins can import the Databricks cost management dashboards into any Unity Catalog workspace and then customize them like any AI/BI dashboard. Start there for spend by product, workspace, and tag, and add your own views over system.billing.usage for chargeback by team.',
      links: [
        { label: 'Usage dashboards', url: 'https://docs.databricks.com/aws/en/admin/account-settings/usage' },
        { label: 'Cost management tools', url: 'https://docs.databricks.com/aws/en/admin/usage/' },
      ],
    },
    {
      id: 'forecast',
      heading: 'Forecast only with enough history',
      prose:
        'ai_forecast projects a time series, but it can only repeat patterns it has seen. Spend follows weekly and monthly rhythms, so the history has to cover them.',
      points: [
        {
          strong: 'Wait for the cycle.',
          text: 'Use at least a couple of full cycles of the pattern you want to project. For a monthly budget, that means two or more months of daily cost.',
        },
        {
          strong: 'Forecast by group.',
          text: 'Forecast per product or per team, not a single total, so one new workload does not distort the rest.',
        },
        {
          strong: 'Read the range.',
          text: 'Act on the lower and upper bounds, not the midpoint, and re-run the forecast as new data arrives.',
        },
      ],
      links: [
        { label: 'ai_forecast', url: 'https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_forecast' },
      ],
    },
  ],
  related: [
    { slug: 'compute-capacity-management', title: 'Compute and capacity management' },
    { slug: 'monitoring', title: 'Platform observability' },
    { slug: 'platform-administration', title: 'Workspace and account administration' },
  ],
};
