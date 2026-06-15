import type { Pattern, BudgetLine, InvoiceCalc } from './types'

// Dropdown choices for the budget grid. Rules live here in code, not the database.
export const PATTERN_OPTIONS: { value: Pattern; label: string }[] = [
  { value: 'A', label: 'Client Card — fee + commission' },
  { value: 'B', label: 'KB Card — commission baked in' },
  { value: 'C', label: 'No commission — fee only' },
]

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
export function computeInvoice(
  lines: BudgetLine[],
  pattern: Pattern,
  rate: number
): InvoiceCalc {
  // Step: skip every sub-line. Only top-level (parent) rows count.
  const lineItems = lines.filter(l => !l.parent_service_id)

  const feeLines = sum(lineItems.filter(l => l.service_type !== 'ad'))
  const clientCardAd = sum(lineItems.filter(l => l.service_type === 'ad' && l.credit_card === 'client'))
  const kbCardAd = sum(lineItems.filter(l => l.service_type === 'ad' && l.credit_card === 'kb'))
  const monthlyTotal = sum(lineItems)

  let commission = 0
  let invoiceTotal = 0
  let netSpend = 0
  let kbKeeps = 0

  if (pattern === 'A') {
    // Client paid the platforms directly → invoice only fee + commission on that spend.
    commission = clientCardAd * rate
    invoiceTotal = feeLines + commission
  } else if (pattern === 'B') {
    // KB fronted the spend → invoice everything; commission is hidden inside the gross.
    invoiceTotal = feeLines + kbCardAd
    netSpend = kbCardAd * (1 - rate)
    kbKeeps = kbCardAd * rate
  } else {
    // No commission → fee lines only; ad spend excluded.
    invoiceTotal = feeLines
  }

  return { feeLines, clientCardAd, kbCardAd, monthlyTotal, commission, invoiceTotal, netSpend, kbKeeps }
}

// Best-guess default pattern for a client's services, used to pre-fill the dropdown.
// KB-card ad spend → B; client-card ad with a rate → A; otherwise C.
export function defaultPattern(
  lines: { service_type: string; credit_card: string }[],
  rate: number
): Pattern {
  const hasKbAd = lines.some(l => l.service_type === 'ad' && l.credit_card === 'kb')
  if (hasKbAd) return 'B'
  if (rate > 0) return 'A'
  return 'C'
}
