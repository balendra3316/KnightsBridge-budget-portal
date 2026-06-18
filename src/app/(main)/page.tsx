import { createClient } from '@/lib/supabase/server'
import FilterableClientGrid from '@/components/kbcbp/filterable-client-grid'

const ALL_MONTHS = [
  'DEC 2025',
  'JAN 2026','FEB 2026','MAR 2026','APR 2026','MAY 2026','JUN 2026',
  'JUL 2026','AUG 2026','SEP 2026','OCT 2026','NOV 2026','DEC 2026',
]

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

  const { data: allServices } = await supabase
    .from('client_services')
    .select('*')
    .order('sort_order')

  const { data: allEntries } = await supabase
    .from('budget_entries')
    .select('*')
    .in('billing_month', ALL_MONTHS)

  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, billing_month, client_id, commission_amount, invoice_total, monthly_total')
    .in('billing_month', ALL_MONTHS)

  return (
    <FilterableClientGrid
      clients={clients}
      services={allServices ?? []}
      entries={allEntries ?? []}
      invoices={allInvoices ?? []}
      months={ALL_MONTHS}
    />
  )
}
