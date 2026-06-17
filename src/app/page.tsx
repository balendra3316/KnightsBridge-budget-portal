import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import FilterableClientGrid from '@/components/kbcbp/filterable-client-grid'

const ALL_MONTHS = [
  'DEC 2025',
  'JAN 2026','FEB 2026','MAR 2026','APR 2026','MAY 2026','JUN 2026',
  'JUL 2026','AUG 2026','SEP 2026','OCT 2026','NOV 2026','DEC 2026',
]

function AppBar() {
  return (
    <div className="flex items-center gap-1 px-6 py-3 sticky top-0 z-50 bg-kb-surface border-b border-kb-border">
      <div className="font-semibold text-sm tracking-tight mr-3">
        KB<span className="text-kb-accent">CBP</span>
      </div>
      {[
        { label: 'Budget Entry', href: '/', active: true },
        { label: 'Approvals', href: '/approvals', active: false },
        { label: 'Invoices', href: '/invoices', active: false },
        { label: 'Admin', href: '/admin', active: false },
      ].map(item => (
        <Link key={item.label} href={item.href}
          className={`px-3 py-1 rounded-md text-[13px] font-medium no-underline ${item.active ? 'bg-kb-accent-light text-kb-accent-text' : 'bg-transparent text-kb-fg-2'}`}>
          {item.label}
        </Link>
      ))}
      <div className="flex-1" />
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-kb-accent text-white">
        VM
      </div>
    </div>
  )
}

export default async function Home() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('sort_order')

  if (!clients || clients.length === 0) {
    return (
      <div className="min-h-screen bg-kb-bg">
        <AppBar />
        <div className="max-w-[600px] mx-auto mt-20 p-10 text-center rounded-xl bg-kb-surface border border-kb-border">
          <div className="text-4xl mb-3">&#128202;</div>
          <div className="text-[15px] font-semibold mb-1.5">No clients found</div>
          <div className="text-[13px] text-kb-fg-3">
            Run the seed SQL in Supabase to add demo clients.
          </div>
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
    <div className="min-h-screen font-sans bg-kb-bg">
      <AppBar />
      <FilterableClientGrid
        clients={clients}
        services={allServices ?? []}
        entries={allEntries ?? []}
        invoices={allInvoices ?? []}
        months={ALL_MONTHS}
      />
    </div>
  )
}
