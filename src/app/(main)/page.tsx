import { createClient } from '@/lib/supabase/server'
import FilterableClientGrid from '@/components/kbcbp/filterable-client-grid'

const ALL_MONTHS = [
  'DEC 2025',
  'JAN 2026','FEB 2026','MAR 2026','APR 2026','MAY 2026','JUN 2026',
  'JUL 2026','AUG 2026','SEP 2026','OCT 2026','NOV 2026','DEC 2026',
]

// Supabase caps a single request at 1000 rows. budget_entries (and to a lesser
// extent services/invoices) blow past that once a few clients are entered, and the
// dropped rows are the most recent — exactly the services someone just added, which
// then render as "—" in the grid. Page through in 1000-row windows so every row loads.
async function fetchAllRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  make: () => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const PAGE = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

export default async function BudgetEntryPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('sort_order')

  if (!clients || clients.length === 0) {
    return (
      <div className="max-w-[600px] mx-auto mt-20 p-10 text-center rounded-xl bg-kb-surface border border-kb-border">
        <div className="text-4xl mb-3">&#128202;</div>
        <div className="text-[15px] font-semibold mb-1.5">No clients found</div>
        <div className="text-[13px] text-kb-fg-3">
          Run the seed SQL in Supabase to add demo clients.
        </div>
      </div>
    )
  }

  const allServices = await fetchAllRows(() =>
    supabase.from('client_services').select('*').order('sort_order'))

  const allEntries = await fetchAllRows(() =>
    supabase.from('budget_entries').select('*').in('billing_month', ALL_MONTHS).order('billing_month'))

  // line_items is the frozen per-month snapshot — the grid uses it to display
  // already-submitted (non-editable) months exactly as they were billed.
  const allInvoices = await fetchAllRows(() =>
    supabase
      .from('invoices')
      .select('id, invoice_number, status, billing_month, client_id, commission_amount, invoice_total, monthly_total, line_items')
      .in('billing_month', ALL_MONTHS)
      .order('billing_month'))

  return (
    <FilterableClientGrid
      clients={clients}
      services={allServices}
      entries={allEntries}
      invoices={allInvoices}
      months={ALL_MONTHS}
    />
  )
}
