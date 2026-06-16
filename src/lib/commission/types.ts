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
  netSpend: number              // KB-Card ad: what the freelancer is told to spend (gross × (1 − rate))
  kbKeeps: number               // KB-Card ad: commission hidden inside the gross
}
