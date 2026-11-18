import type { Walkthrough } from './types.ts';

export const walkthrough: Walkthrough = {
  slug: 'pages',
  area: 'AI Guides',
  title: 'Databricks Pages',
  intro:
    'A Page is a governed, authoritative definition of a business concept such as a term, entity, KPI, or acronym. Pages live in domains and subdomains on the Discover page. Genie One prioritizes a matching Page over learned context and cites it so users can inspect the source. Pages became generally available on November 11, 2026.',
  businessValue: {
    summary:
      'Pages give each important business concept one visible owner, one reviewed definition, and direct links to the assets that implement or support it.',
    outcomes: [
      {
        title: 'One authoritative definition',
        body: 'Teams stop copying competing definitions into dashboards, agent instructions, spreadsheets, and onboarding documents.',
      },
      {
        title: 'Better Genie grounding',
        body: 'Genie gives the published Page priority over conflicting learned context and cites it in the answer.',
      },
      {
        title: 'Visible evidence',
        body: 'Sources explain where the definition came from, while related assets connect it to metric views, tables, dashboards, agents, and other Pages.',
      },
      {
        title: 'Controlled publication',
        body: 'Owners remain accountable, publisher groups manage Page content, and domain curators certify or deprecate trusted definitions.',
      },
    ],
  },
  shortVersion: [
    {
      title: 'Use a Page for meaning, not math.',
      body: 'A Page explains a concept in words. Put executable KPI logic in a metric view and link it as a related asset.',
    },
    {
      title: 'Start with concepts that affect decisions.',
      body: 'Prioritize disputed terms, acronyms, entities, and KPIs that appear in real questions. Do not create Pages nobody will use.',
    },
    {
      title: 'Write boundaries and evidence.',
      body: 'State what the concept includes and excludes, add real synonyms, cite sources, and link the assets that implement it.',
    },
    {
      title: 'Separate accountability from authority.',
      body: 'The owner answers for the definition, MANAGE PAGES controls publication, and a domain curator controls certification and deprecation.',
    },
    {
      title: 'Protect metadata.',
      body: 'Do not put PII, regulated data, secrets, or customer records in Page names, descriptions, synonyms, or body text.',
    },
  ],
  prerequisites: [
    {
      slug: 'domains-subdomains',
      title: 'Databricks Domains and Subdomains',
      why: 'Every Page belongs to a domain or subdomain and inherits access from that location.',
    },
  ],
  sections: [
    {
      id: 'anatomy',
      heading: 'Give every Page a clear job',
      prose:
        'A useful Page resolves a concrete business question. Its fields establish the name, boundary, accountability, evidence, and implementation links for that concept.',
      table: {
        caption: 'Page anatomy',
        columns: ['Field', 'What good looks like'],
        rows: [
          ['Name and description', 'A canonical name and one sentence that distinguishes the concept from nearby terms.'],
          ['Owner', 'A named person accountable for resolving disputes and keeping the definition current.'],
          ['Synonyms', 'Acronyms, legacy names, and the words users put in questions, reports, and support requests.'],
          ['Body', 'Scope, exclusions, lifecycle states, guardrails, and examples without duplicating executable metric logic.'],
          ['Sources', 'Databricks assets or external links that provide provenance and evidence for the definition.'],
          ['Related assets', 'Metric views, tables, dashboards, agents, or Pages that implement or explain the concept.'],
          ['Status', 'Draft during review, published for broad use, then certified or deprecated by a curator.'],
        ],
      },
      diagram: {
        type: 'flow',
        title: 'Definition to trusted answer',
        description:
          'A concept owner and steward group review a Page. The Page links evidence and implementation assets. After publication and certification, Genie can use and cite the definition in an answer.',
        nodes: [
          {
            id: 'owner',
            label: 'Concept owner',
            sub: 'accountable for meaning',
            col: 0,
            row: 0,
            kind: 'box',
            domain: 'governance',
            icon: 'users',
            detail: 'The business contact who resolves disputes about scope, exclusions, policy, and acceptable use.',
          },
          {
            id: 'page',
            label: 'Business concept',
            sub: 'draft, then published',
            col: 1,
            row: 0,
            kind: 'highlight',
            domain: 'governance',
            icon: 'list',
            detail: 'The Page that holds the reviewed definition, synonyms, sources, related assets, owner, and lifecycle state.',
          },
          {
            id: 'evidence',
            label: 'Sources',
            sub: 'provenance and evidence',
            col: 2,
            row: 0,
            kind: 'store',
            domain: 'data',
            icon: 'data-search',
            detail: 'Documents, tables, metric views, or external links that support the definition and help reviewers verify it.',
          },
          {
            id: 'related',
            label: 'Related assets',
            sub: 'metrics, data, dashboards',
            col: 2,
            row: 1,
            kind: 'store',
            domain: 'data',
            icon: 'data-model',
            detail: 'The assets that implement, visualize, or answer questions about the concept.',
          },
          {
            id: 'genie',
            label: 'Cited Genie answer',
            sub: 'modeled knowledge wins',
            col: 3,
            row: 0,
            kind: 'surface',
            domain: 'apps',
            icon: 'gear-maroon',
            detail: 'Genie prioritizes the modeled Page definition over conflicting learned context and cites the source for the user.',
          },
        ],
        edges: [
          { from: 'owner', to: 'page' },
          { from: 'page', to: 'evidence' },
          { from: 'page', to: 'related' },
          { from: 'evidence', to: 'genie' },
          { from: 'related', to: 'genie' },
        ],
        legend: [
          { kind: 'highlight', label: 'Authoritative definition' },
          { kind: 'store', label: 'Evidence and implementation' },
          { kind: 'surface', label: 'Consumer answer' },
        ],
      },
    },
    {
      id: 'write',
      heading: 'Write the boundary, not an essay',
      steps: [
        {
          title: 'Choose a concept that matters',
          body: 'Start with a term that changes a decision, appears across teams, or regularly produces inconsistent answers.',
        },
        {
          title: 'Name the concept and its owner',
          body: 'Use the term business users recognize and assign a person who can resolve disputes. Ownership is accountability, not automatic edit authority after publication.',
        },
        {
          title: 'Define scope and exclusions',
          body: 'Explain what the concept includes, what it excludes, and how it differs from adjacent concepts. Keep the first description short enough to scan.',
        },
        {
          title: 'Add real synonyms',
          body: 'Collect acronyms, legacy terms, and regional language from real questions and reports. Avoid speculative synonym lists that blur distinct concepts.',
        },
        {
          title: 'Attach evidence and implementation',
          body: 'Use Sources for provenance. Use Related assets for the metric views, data, dashboards, agents, and Pages that put the definition into practice.',
        },
        {
          title: 'Review, publish, and certify',
          body: 'Create a draft, verify the evidence with the owner and steward, publish through a MANAGE PAGES group, and ask the domain curator to certify it.',
        },
      ],
    },
    {
      id: 'placement',
      heading: 'Keep definitions and calculations in their proper homes',
      options: {
        caption: 'Which object should hold the information?',
        rows: [
          {
            option: 'Page',
            when: 'A term, entity, acronym, or policy needs one authoritative definition across assets.',
            tradeoffs:
              'Pages hold prose, synonyms, sources, and related assets. They do not execute calculations.',
          },
          {
            option: 'Metric view',
            when: 'A KPI, filter, dimension, or code mapping must return the same result for every consumer.',
            tradeoffs:
              'Metric views are queryable and governed. Link the metric view from the Page instead of copying its calculation into prose.',
          },
          {
            option: 'Wiki or comment',
            when: 'The context belongs to one table or column: grain, intended use, caveats, or valid values.',
            tradeoffs:
              'Asset-specific documentation is close to the schema but does not replace a concept that spans several assets.',
          },
          {
            option: 'Genie Agent instruction',
            when: 'A conversational rule, example query, or response behavior belongs to one agent.',
            tradeoffs:
              'Agent instructions do not govern dashboards or other agents. Shared meaning belongs in Pages and metric views.',
          },
        ],
        recommendation:
          'Use Pages for meaning, metric views for calculations, wikis and comments for asset-specific documentation, and agent instructions only for one agent experience.',
      },
    },
    {
      id: 'governance',
      heading: 'Control publication and lifecycle',
      points: [
        {
          strong: 'Review the default MANAGE PAGES grant.',
          text: 'Decide which steward groups may publish and maintain Pages in each domain instead of assuming creation and publication are already restricted.',
        },
        {
          strong: 'Separate owner, publisher, and curator.',
          text: 'The owner answers for the concept, publishers maintain content, and curators certify or deprecate the Page.',
        },
        {
          strong: 'Certify evidence, not prose alone.',
          text: 'Confirm that the Page, metric view, source assets, and accountable owner agree before marking the definition trusted.',
        },
        {
          strong: 'Deprecate conflicts.',
          text: 'Do not leave two active Pages claiming authority over the same concept. Deprecate the old Page and link consumers to its replacement.',
        },
        {
          strong: 'Automate drafts cautiously.',
          text: 'The REST API can create and update Pages. Use drafts, explicit update masks, idempotent request IDs, review gates, and read-back verification.',
        },
      ],
      links: [
        { label: 'Pages', url: 'https://docs.databricks.com/aws/en/uc-semantics/pages' },
        { label: 'Pages REST API', url: 'https://docs.databricks.com/api/workspace/knowledge/pages' },
        {
          label: 'Certify or deprecate assets',
          url: 'https://docs.databricks.com/aws/en/data-governance/unity-catalog/certify-deprecate-data',
        },
      ],
    },
  ],
  related: [
    { slug: 'domains-subdomains', title: 'Databricks Domains and Subdomains' },
    { slug: 'ontology', title: 'Databricks Ontology best practices' },
    { slug: 'metric-views', title: 'Metric views' },
  ],
};
