// The fixed menu of services an admin can add to a client, and the sub-services
// that belong under each parent. This is the single source of truth for the
// Add Service / Add Sub-Service dropdowns.
//
// Sub-services are tracking-only breakdowns of a parent's ad budget — they are
// NEVER counted in any invoice/commission math (see computeInvoice). They exist
// so the team can see how a parent budget is split across campaigns.

export type CatalogParent = {
  name: string
  children: string[]
}

export const SERVICE_CATALOG: CatalogParent[] = [
  {
    name: 'Digital Advertising, Search Ad Budget',
    children: [
      'Remarketing',
      'Customer Match',
      'Custom Audience',
      'Affinity Audience',
      'Affinity Targeting',
      'In Market',
      'In-Market',
      'Demand Gen',
      'Demand Gen / Customer Match',
      'Performance Max',
      'Display, General',
      'Display: ZoomInfo',
    ],
  },
  {
    name: 'Digital Advertising, Display Ad Budget',
    children: [
      'Remarketing',
      'Custom Audience',
      'Affinity Audience',
      'In Market',
      'Display, General',
      'Responsive Display',
      'Responsive Display (Windfall)',
      'Demand Gen',
      'Display: ZoomInfo',
    ],
  },
  {
    name: 'Digital Advertising, Social Media Ad Budget',
    children: [
      'Social / Advertising',
      'Social / Promoted Posts',
      'Social / Evergreen Campaign',
      'Social / Website Traffic',
      'Social, Meta',
      'Social, LinkedIn',
      'Social, Promoted Posts',
      'Social Media, Meta Advertising',
      'Social Media, LinkedIn',
      'Social Media, Promoted Posts',
      'Social: Meta ZoomInfo',
      'Social: LinkedIn ZoomInfo',
      'Remarketing',
      'Customer Match',
      'Demand Gen',
    ],
  },

  // Parents with no sub-services.
  { name: 'Digital Marketing Suite', children: [] },
  { name: 'SEO', children: [] },
  { name: 'Blogging', children: [] },
  { name: 'SEO & Blogging', children: [] },
  { name: 'Social Media, Organic', children: [] },
  { name: 'Social Media, Organic & Advertising', children: [] },
  { name: 'Social Media, Advertising', children: [] },
  { name: 'Ad Campaign Management, Search', children: [] },
  { name: 'Ad Campaign Management, Social', children: [] },
  { name: 'Ad Campaign Management, Display', children: [] },
  { name: 'CRM Setup', children: [] },
  { name: 'CRM Management', children: [] },
  { name: 'Website Maintenance', children: [] },
  { name: 'Website Programming', children: [] },
  { name: 'Website Design', children: [] },
  { name: 'Website Design & Development', children: [] },
  { name: 'Media Placement', children: [] },
  { name: 'Media Planning, Management', children: [] },
  { name: 'Brand Development', children: [] },
  { name: 'Advertising Creative, Social', children: [] },
  { name: 'Digital Advertising, Performance Max', children: [] },
  { name: 'Digital Advertising, YouTube Budget', children: [] },
  { name: 'Commission, Digital Advertising', children: [] },
  { name: 'Commission, Media Planning', children: [] },
  { name: 'TVG Fee on Digital Ad (7.5%)', children: [] },
  { name: 'TVG Reimbursable, Media Placements', children: [] },
  { name: 'Credit', children: [] },
]

// All selectable parent service names.
export const PARENT_SERVICE_NAMES: string[] = SERVICE_CATALOG.map(p => p.name)

// The sub-services allowed under a given parent name ('' if the name is unknown
// or has no sub-services).
export function catalogChildren(parentName: string): string[] {
  return SERVICE_CATALOG.find(p => p.name === parentName)?.children ?? []
}
