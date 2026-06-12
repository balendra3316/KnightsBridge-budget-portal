import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BudgetGrid from '@/components/kbcbp/budget-grid'

const ALL_MONTHS = [
  'JAN 2025','FEB 2025','MAR 2025','APR 2025','MAY 2025','JUN 2025',
  'JUL 2025','AUG 2025','SEP 2025','OCT 2025','NOV 2025','DEC 2025',
  'JAN 2026','FEB 2026','MAR 2026','APR 2026','MAY 2026','JUN 2026',
  'JUL 2026','AUG 2026','SEP 2026','OCT 2026','NOV 2026','DEC 2026',
]

function getVisibleMonths(current: string) {
  const idx = ALL_MONTHS.indexOf(current)
  const start = Math.max(0, idx - 4)
  const end = Math.min(ALL_MONTHS.length, idx + 2)
  return ALL_MONTHS.slice(start, end)
}

function getPrevMonth(current: string) {
  const idx = ALL_MONTHS.indexOf(current)
  return idx > 0 ? ALL_MONTHS[idx - 1] : null
}

function getNextMonth(current: string) {
  const idx = ALL_MONTHS.indexOf(current)
  return idx < ALL_MONTHS.length - 1 ? ALL_MONTHS[idx + 1] : null
}

function AppBar({ currentMonth }: { currentMonth: string }) {
  const prev = getPrevMonth(currentMonth)
  const next = getNextMonth(currentMonth)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '12px 24px',
      background: '#FFFFFF', borderBottom: '1px solid #E8E6E1',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.3px', marginRight: 12 }}>
        KB<span style={{ color: '#534AB7' }}>CBP</span>
      </div>
      {[
        { label: 'Budget Entry', href: '/', active: true },
        { label: 'Approvals', href: '/approvals', active: false },
        { label: 'Invoices', href: '/invoices', active: false },
        { label: 'Reports', href: '#', active: false },
      ].map(item => (
        <Link key={item.label} href={item.href} style={{
          padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
          background: item.active ? '#EEEDFE' : 'transparent',
          color: item.active ? '#3C3489' : '#6B6A65',
          textDecoration: 'none',
        }}>
          {item.label}
        </Link>
      ))}
      <div style={{ flex: 1 }} />

      {/* Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {prev ? (
          <Link href={`/?month=${encodeURIComponent(prev)}`} style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid #E8E6E1',
            background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6B6A65', fontSize: 14, textDecoration: 'none',
          }}>&lsaquo;</Link>
        ) : (
          <span style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid #E8E6E1',
            background: '#F5F4F1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#D3D1C7', fontSize: 14,
          }}>&lsaquo;</span>
        )}
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#3C3489',
          background: '#EEEDFE', padding: '4px 12px', borderRadius: 6,
          minWidth: 90, textAlign: 'center',
        }}>{currentMonth}</div>
        {next ? (
          <Link href={`/?month=${encodeURIComponent(next)}`} style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid #E8E6E1',
            background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6B6A65', fontSize: 14, textDecoration: 'none',
          }}>&rsaquo;</Link>
        ) : (
          <span style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid #E8E6E1',
            background: '#F5F4F1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#D3D1C7', fontSize: 14,
          }}>&rsaquo;</span>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: '#E8E6E1', margin: '0 8px' }} />
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: '#534AB7',
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600,
      }}>VM</div>
    </div>
  )
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const currentMonth = ALL_MONTHS.includes(params.month ?? '')
    ? params.month!
    : 'APR 2026'

  const months = getVisibleMonths(currentMonth)

  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('sort_order')

  if (!clients || clients.length === 0) {
    return (
      <div style={{ background: '#FAF9F7', minHeight: '100vh' }}>
        <AppBar currentMonth={currentMonth} />
        <div style={{
          maxWidth: 600, margin: '80px auto', padding: 40, textAlign: 'center',
          background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E6E1',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No clients found</div>
          <div style={{ fontSize: 13, color: '#9C9A92' }}>
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
    .in('billing_month', months)

  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, billing_month, client_id')
    .eq('billing_month', currentMonth)

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
    <div style={{ background: '#FAF9F7', minHeight: '100vh', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <AppBar currentMonth={currentMonth} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '8px 24px',
        background: '#F5F4F1', borderBottom: '1px solid #E8E6E1',
        fontSize: 12, color: '#6B6A65',
      }}>
        <span>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#1D9E75', marginRight: 5 }} />
          {enteredCount} of {clients.length} clients entered
        </span>
        <span style={{ width: 1, height: 16, background: '#E8E6E1', display: 'inline-block' }} />
        <span>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#EF9F27', marginRight: 5 }} />
          {draftCount} pending entry
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 11, color: '#3C3489', background: '#EEEDFE',
          padding: '3px 10px', borderRadius: 4, fontWeight: 500,
        }}>Enter amounts net of commission</span>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 80px' }}>
        {grouped.map((g, gi) => (
          <div key={gi}>
            {g.group && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0 6px', marginTop: 12, marginBottom: 4,
              }}>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.3px' }}>{g.group}</div>
                <div style={{ fontSize: 11, color: '#9C9A92' }}>{g.items.length} projects</div>
              </div>
            )}
            {g.items.map(client => {
              const services = (allServices ?? []).filter(s => s.client_id === client.id)
              const entries = (allEntries ?? []).filter(e => e.client_id === client.id)
              const invoice = (allInvoices ?? []).find(i => i.client_id === client.id) ?? null

              return (
                <BudgetGrid
                  key={client.id}
                  client={client}
                  services={services}
                  entries={entries}
                  months={months}
                  currentMonth={currentMonth}
                  invoice={invoice}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
