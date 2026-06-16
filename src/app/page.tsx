import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BudgetGrid from '@/components/kbcbp/budget-grid'

const ALL_MONTHS = [
  'DEC 2025',
  'JAN 2026','FEB 2026','MAR 2026','APR 2026','MAY 2026','JUN 2026',
  'JUL 2026','AUG 2026','SEP 2026','OCT 2026','NOV 2026','DEC 2026',
]

function AppBar() {
  return (
    <div className="flex items-center gap-1 px-6 py-3 sticky top-0 z-50"
      style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E6E1' }}>
      <div className="font-semibold text-sm tracking-tight mr-3">
        KB<span style={{ color: '#534AB7' }}>CBP</span>
      </div>
      {[
        { label: 'Budget Entry', href: '/', active: true },
        { label: 'Approvals', href: '/approvals', active: false },
        { label: 'Invoices', href: '/invoices', active: false },
        { label: 'Admin', href: '/admin', active: false },
      ].map(item => (
        <Link key={item.label} href={item.href}
          className="px-3 py-1 rounded-md text-[13px] font-medium no-underline"
          style={{
            background: item.active ? '#EEEDFE' : 'transparent',
            color: item.active ? '#3C3489' : '#6B6A65',
          }}>
          {item.label}
        </Link>
      ))}
      <div className="flex-1" />
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
        style={{ background: '#534AB7', color: 'white' }}>
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
      <div className="min-h-screen" style={{ background: '#FAF9F7' }}>
        <AppBar />
        <div className="max-w-[600px] mx-auto mt-20 p-10 text-center rounded-xl"
          style={{ background: '#FFFFFF', border: '1px solid #E8E6E1' }}>
          <div className="text-4xl mb-3">&#128202;</div>
          <div className="text-[15px] font-semibold mb-1.5">No clients found</div>
          <div className="text-[13px]" style={{ color: '#9C9A92' }}>
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

  const draftCount = clients.filter(c => {
    const inv = allInvoices?.find(i => i.client_id === c.id)
    return !inv
  }).length
  const enteredCount = clients.length - draftCount

  const grouped: { group: string | null; items: typeof clients }[] = []
  const seen = new Set<string>()

  for (const c of clients) {
    const g = c.parent_group
    if (g && !seen.has(g)) {
      seen.add(g)
      grouped.push({ group: g, items: clients.filter(x => x.parent_group === g) })
    } else if (!g) {
      grouped.push({ group: null, items: [c] })
    }
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: '#FAF9F7' }}>
      <AppBar />

      <div className="flex items-center gap-4 px-6 py-2 text-xs"
        style={{ background: '#F5F4F1', borderBottom: '1px solid #E8E6E1', color: '#6B6A65' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: '#1D9E75' }} />
          {enteredCount} of {clients.length} clients entered
        </span>
        <span className="w-px h-4 inline-block" style={{ background: '#E8E6E1' }} />
        <span className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: '#EF9F27' }} />
          {draftCount} pending entry
        </span>
        <div className="flex-1" />
        <span className="text-[11px] px-2.5 py-0.5 rounded font-medium"
          style={{ color: '#3C3489', background: '#EEEDFE' }}>
          Click a month column to edit
        </span>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-5 pb-20">
        {grouped.map((g, gi) => (
          <div key={gi}>
            {g.group && (
              <div className="flex items-center gap-2.5 pt-2.5 pb-1.5 mt-3 mb-1">
                <div className="text-[17px] font-semibold tracking-tight">{g.group}</div>
                <div className="text-[11px]" style={{ color: '#9C9A92' }}>{g.items.length} projects</div>
              </div>
            )}
            {g.items.map(client => {
              const services = (allServices ?? []).filter(s => s.client_id === client.id)
              const clientEntries = (allEntries ?? []).filter(e => e.client_id === client.id)
              const clientInvoices = (allInvoices ?? []).filter(i => i.client_id === client.id)

              return (
                <BudgetGrid
                  key={client.id}
                  client={client}
                  services={services}
                  entries={clientEntries}
                  months={ALL_MONTHS}
                  invoices={clientInvoices}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
