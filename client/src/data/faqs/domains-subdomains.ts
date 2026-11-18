import type { Faq } from './types.ts';

export const faqs: Faq[] = [
  {
    question: 'How deep can a domain hierarchy be?',
    answer:
      'Databricks supports five levels total: one top-level domain plus four subdomain levels. Treat that as a limit, not a target. Add a level only when it changes ownership, audience, or how consumers browse.',
    links: [{ label: 'Domains and subdomains', url: 'https://docs.databricks.com/aws/en/uc-semantics/domains' }],
  },
  {
    question: 'Should domains mirror catalogs and schemas?',
    answer:
      'Usually no. Domains are a business-facing organization layer, while catalogs and schemas are technical governance and storage boundaries. Use stable areas such as Customer, Product, Finance, or Supply Chain unless the technical boundary is also how consumers understand the business.',
  },
  {
    question: 'Can an asset belong to more than one domain?',
    answer:
      'Yes. Add each membership only when it creates a useful discovery path. Domain pages and counts reflect direct membership, and a child-domain tag does not automatically add every ancestor tag.',
  },
  {
    question: 'What is the difference between MANAGE DISCOVER and MANAGE DOMAIN?',
    answer:
      'MANAGE DISCOVER is account-wide authority over domains, subdomains, and their Pages. MANAGE DOMAIN is scoped to one domain or subdomain and its descendants. Use MANAGE DISCOVER for the central governance team and MANAGE DOMAIN for delegated curator groups.',
  },
  {
    question: 'Why does a published subdomain not appear under its parent?',
    answer:
      'Publish the child subdomain first, then republish its parent. The parent publication refreshes the consumer-facing tree so the child card appears in Discover.',
  },
];
