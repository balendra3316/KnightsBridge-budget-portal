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
//   • Client Card → client paid the platform directly → invoice only the commission on it.
//   • KB Card     → KB fronted the spend → invoice it in full (commission baked in).
//   • No card     → fee / retainer / SEO etc. → always invoiced in full.
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

  const commission = clientCardAd * rate          // earned on Client-Card ad spend
  const invoiceTotal = feeLines + commission + kbCardAd

  const netSpend = kbCardAd * (1 - rate)          // what the freelancer is told to spend (KB Card)
  const kbKeeps = kbCardAd * rate                 // commission hidden inside the KB-Card gross

  return { feeLines, clientCardAd, kbCardAd, monthlyTotal, commission, invoiceTotal, netSpend, kbKeeps }
}

// One printable row on the invoice. Stored (frozen) on the invoice at creation.
export type InvoiceLineItem = { name: string; amount: number }

// Input for buildLineItems — a BudgetLine plus the service's display name.
export type NamedBudgetLine = BudgetLine & { service_name: string }

// Build the printable invoice rows from the budget lines, applying the same card
// rules as computeInvoice so the rows always reconcile to invoiceTotal:
//   • No card (fee) → its own row, billed in full (e.g. "Digital Marketing Suite").
//   • KB Card       → its own row, billed in full (commission baked into the gross).
//   • Client Card   → NOT listed; only feeds the single Commission row at the end.
// Then one combined "Commission" row, then the total. Parents roll up their
// sub-services; sub-lines are never printed on their own.
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
    if (p.credit_card === 'Client Card') {
      // Client paid the platforms directly — the service isn't billed, it only
      // contributes commission (collected into one row below).
      commission += amt * rate
    } else {
      // No card (fee) or KB Card → billed in full as its own row.
      items.push({ name: p.service_name, amount: amt })
    }
  }
  if (commission > 0) items.push({ name: 'Commission', amount: commission })
  return items
}

// Descriptive label for the invoice record, derived from which cards are present.
export function billingLabel(clientCardAd: number, kbCardAd: number): string {
  if (clientCardAd > 0 && kbCardAd > 0) return 'mixed'
  if (kbCardAd > 0) return 'kb-card'
  if (clientCardAd > 0) return 'client-card'
  return 'fee-only'
}
