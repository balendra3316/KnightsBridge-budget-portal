import type { BudgetLine, InvoiceCalc } from './types'

// Rate is stored as a fraction (0.15 = 15%).
export const RATE_OPTIONS: { value: number; label: string }[] = [
  { value: 0.15,  label: '15%' },
  { value: 0.125, label: '12.5%' },
  { value: 0.10,  label: '10%' },
  { value: 0,     label: '0%' },
]

const sum = (lines: BudgetLine[]) =>
  lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)

// The single source of truth for invoice math. Pure function — runs identically
// in the budget grid (live preview) and the server action (authoritative save).
//
// The CARD on each service decides how its spend is billed (service_type no longer
// matters — a line is "ad spend" precisely when a card is attached to it):
//   • Client Card → client paid the platform directly → invoice only the commission on it.
//   • KB Card     → KB fronted the spend → invoice it in full (commission baked in).
//   • No card     → fee / retainer / SEO etc. → always invoiced in full.
// This handles pure Client-Card, pure KB-Card, and mixed-card clients automatically.
export function computeInvoice(lines: BudgetLine[], rate: number): InvoiceCalc {
  // Skip every sub-line. Only top-level (parent) rows count.
  const lineItems = lines.filter(l => !l.parent_service_id)

  const clientCardAd = sum(lineItems.filter(l => l.credit_card === 'Client Card'))
  const kbCardAd = sum(lineItems.filter(l => l.credit_card === 'KB Card'))
  const feeLines = sum(lineItems.filter(l => l.credit_card !== 'Client Card' && l.credit_card !== 'KB Card'))
  const monthlyTotal = sum(lineItems)

  const commission = clientCardAd * rate          // earned on Client-Card ad spend
  const invoiceTotal = feeLines + commission + kbCardAd

  const netSpend = kbCardAd * (1 - rate)          // what the freelancer is told to spend (KB Card)
  const kbKeeps = kbCardAd * rate                 // commission hidden inside the KB-Card gross

  return { feeLines, clientCardAd, kbCardAd, monthlyTotal, commission, invoiceTotal, netSpend, kbKeeps }
}

// Descriptive label for the invoice record, derived from which cards are present.
export function billingLabel(clientCardAd: number, kbCardAd: number): string {
  if (clientCardAd > 0 && kbCardAd > 0) return 'mixed'
  if (kbCardAd > 0) return 'kb-card'
  if (clientCardAd > 0) return 'client-card'
  return 'fee-only'
}
