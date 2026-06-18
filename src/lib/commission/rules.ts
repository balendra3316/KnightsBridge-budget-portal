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
// The CARD on each parent service decides how its spend is billed (service_type
// no longer matters — a line is "ad spend" precisely when a card is attached):
//   • Client Card → client paid the platform directly → invoice ONLY the commission
//                   on it (the spend itself is not billed).
//   • KB Card     → KB fronted the spend on its card → invoice the spend in FULL
//                   (reimbursement) AND charge commission on it.
//   • No card     → fee / retainer / SEO etc. → invoiced in full, no commission.
//
// Sub-lines roll UP: a parent that has sub-lines is billed on the SUM of its
// children (not on its own entered amount). So editing a sub-service changes its
// parent's total, which flows through to commission and the invoice total.
export function computeInvoice(lines: BudgetLine[], rate: number): InvoiceCalc {
  const parents = lines.filter(l => !l.parent_service_id)

  // A parent with children is billed on the sum of those children; otherwise on
  // its own amount.
  const effective = (parent: BudgetLine): number => {
    const kids = lines.filter(l => l.parent_service_id === parent.id)
    return kids.length > 0 ? sum(kids) : (Number(parent.amount) || 0)
  }
  const sumWhere = (pred: (l: BudgetLine) => boolean) =>
    parents.filter(pred).reduce((s, p) => s + effective(p), 0)

  const clientCardAd = sumWhere(l => l.credit_card === 'Client Card')
  const kbCardAd = sumWhere(l => l.credit_card === 'KB Card')
  const feeLines = sumWhere(l => l.credit_card !== 'Client Card' && l.credit_card !== 'KB Card')
  const monthlyTotal = clientCardAd + kbCardAd + feeLines

  // Commission is earned on ALL card-paid ad spend — the client's card AND KB's card.
  // Client-card spend is not billed (only its commission). KB-card spend IS billed in
  // full (KB fronted it) and ALSO earns commission. No-card fees are billed in full.
  const commission = (clientCardAd + kbCardAd) * rate
  const invoiceTotal = feeLines + kbCardAd + commission

  const netSpend = kbCardAd * (1 - rate)          // KB Card: what the freelancer is told to spend
  const kbKeeps = kbCardAd * rate                 // KB Card: its share of the commission above

  return { feeLines, clientCardAd, kbCardAd, monthlyTotal, commission, invoiceTotal, netSpend, kbKeeps }
}

// One printable row on the invoice. Stored (frozen) on the invoice at creation.
// `card` records how the row was paid ('' = fee/no-card, 'Client Card', 'KB Card')
// so the invoice page can decide which rows to show or hide.
export type InvoiceLineItem = { name: string; amount: number; card?: string }

// Input for buildLineItems — a BudgetLine plus the service's display name.
export type NamedBudgetLine = BudgetLine & { service_name: string }

// Build the invoice rows from the budget lines. EVERY service is stored as a row
// tagged with its credit card, so the invoice page can decide which rows to show or
// hide. Then one combined "Commission" row:
//   • No card (fee)         → card '' — shown on the invoice, billed in full.
//   • Client Card / KB Card → tagged with the card; the invoice page hides these rows
//                             by default. Each also feeds the single Commission row.
//                             (KB-card spend still counts toward invoiceTotal.)
// Parents roll up their sub-services; sub-lines are never stored on their own.
export function buildLineItems(lines: NamedBudgetLine[], rate: number): InvoiceLineItem[] {
  const parents = lines.filter(l => !l.parent_service_id)
  const effective = (parent: NamedBudgetLine): number => {
    const kids = lines.filter(l => l.parent_service_id === parent.id)
    return kids.length > 0 ? sum(kids) : (Number(parent.amount) || 0)
  }

  const items: InvoiceLineItem[] = []
  let commission = 0
  for (const p of parents) {
    const amt = effective(p)
    if (amt <= 0) continue
    if (p.credit_card === 'Client Card' || p.credit_card === 'KB Card') {
      // Store the row tagged with its card so the invoice page can hide it. The card
      // spend also feeds the single Commission row below. (KB-card spend still counts
      // toward invoiceTotal in computeInvoice — hiding the row changes no total.)
      items.push({ name: p.service_name, amount: amt, card: p.credit_card })
      commission += amt * rate
    } else {
      // No card (fee / retainer) → shown on the invoice, billed in full, no commission.
      items.push({ name: p.service_name, amount: amt, card: '' })
    }
  }
  if (commission > 0) items.push({ name: 'Commission', amount: commission, card: '' })
  return items
}

// Descriptive label for the invoice record, derived from which cards are present.
export function billingLabel(clientCardAd: number, kbCardAd: number): string {
  if (clientCardAd > 0 && kbCardAd > 0) return 'mixed'
  if (kbCardAd > 0) return 'kb-card'
  if (clientCardAd > 0) return 'client-card'
  return 'fee-only'
}
