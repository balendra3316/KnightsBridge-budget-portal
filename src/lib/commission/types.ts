// Billing patterns from the budget sheet rules.
//   A = Client Card  — KB invoices fee lines + commission % × client-card ad spend.
//                      The ad spend itself is NOT invoiced (client pays the platforms directly).
//   B = KB Card      — KB fronts the ad spend, so the invoice = monthly total (fee + KB-card ad).
//                      Commission is baked into the gross; there is NO separate commission line.
//   C = No commission — invoice = fee lines only; ad spend is excluded entirely.
export type Pattern = 'A' | 'B' | 'C'

// One budget line for a single month. Sub-lines (parent_service_id != null) are
// tracking-only breakdowns for the freelancer and are NEVER counted financially.
export type BudgetLine = {
  service_type: string          // 'fee' | 'ad' | 'seo'
  credit_card: string           // '' | 'Client Card' | 'KB Card'
  parent_service_id: string | null
  amount: number
}

export type InvoiceCalc = {
  feeLines: number              // sum of non-ad parent lines
  clientCardAd: number          // ad spend on the client's own card
  kbCardAd: number              // ad spend on KB's card
  monthlyTotal: number          // fee + all ad (parent lines only) — reference, not the invoice
  commission: number            // commission line (0 for patterns B and C)
  invoiceTotal: number          // the amount actually billed
  netSpend: number              // pattern B only: what the freelancer is told to spend
  kbKeeps: number               // pattern B only: commission hidden inside the gross
}
