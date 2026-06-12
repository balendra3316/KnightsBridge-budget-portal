import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function fmt(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function AppBar() {
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
        { label: 'Budget Entry', href: '/', active: false },
        { label: 'Approvals', href: '/approvals', active: true },
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
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: '#534AB7',
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600,
      }}>VM</div>
    </div>
  )
}

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .in('status', ['approved', 'sent', 'paid'])
    .order('updated_at', { ascending: false })

  const all = invoices ?? []
  const approvedCount = all.filter(i => i.status === 'approved').length
  const sentCount = all.filter(i => i.status === 'sent').length

  const cols = ['Invoice #', 'Client', 'Month', 'PM', 'Fee', 'Ad Spend', 'Commission', 'Total', 'Status', 'Approved On']

  const STATUS_STYLES: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    approved: { label: 'Approved',  bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75' },
    sent:     { label: 'Sent to QB', bg: '#E6F1FB', color: '#185FA5', dot: '#185FA5' },
    paid:     { label: 'Paid',      bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75' },
  }

  return (
    <div style={{ background: '#FAF9F7', minHeight: '100vh', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <AppBar />

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '8px 24px',
        background: '#F5F4F1', borderBottom: '1px solid #E8E6E1',
        fontSize: 12, color: '#6B6A65',
      }}>
        <span>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#1D9E75', marginRight: 5 }} />
          {approvedCount} approved
        </span>
        <span style={{ width: 1, height: 16, background: '#E8E6E1', display: 'inline-block' }} />
        <span>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#185FA5', marginRight: 5 }} />
          {sentCount} sent to QuickBooks
        </span>
        <span style={{ width: 1, height: 16, background: '#E8E6E1', display: 'inline-block' }} />
        <span>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#534AB7', marginRight: 5 }} />
          {all.length} total
        </span>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 80px' }}>
        {all.length === 0 ? (
          <div style={{
            background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E6E1',
            padding: '60px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', marginBottom: 6 }}>No approved invoices yet</div>
            <div style={{ fontSize: 13, color: '#9C9A92' }}>
              Invoices will appear here once they have been approved.
            </div>
          </div>
        ) : (
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E6E1', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {cols.map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 14px',
                        textAlign: i >= 4 && i <= 7 ? 'right' : 'left',
                        fontWeight: 500, fontSize: 11,
                        textTransform: 'uppercase' as const, letterSpacing: '0.4px',
                        color: '#9C9A92', borderBottom: '1px solid #E8E6E1',
                        background: '#FFFFFF', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {all.map((inv, idx) => {
                    const st = STATUS_STYLES[inv.status] ?? STATUS_STYLES.approved
                    const date = inv.updated_at
                      ? new Date(inv.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'
                    return (
                      <tr key={inv.id} style={{
                        borderBottom: idx < all.length - 1 ? '1px solid #E8E6E1' : 'none',
                      }}>
                        <td style={{
                          padding: '10px 14px',
                          fontFamily: "'DM Mono', monospace", fontWeight: 500,
                          color: '#3C3489', whiteSpace: 'nowrap',
                        }}>
                          {inv.invoice_number ?? '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1A1A18', minWidth: 160 }}>
                          {inv.client_name}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#6B6A65', whiteSpace: 'nowrap' }}>
                          {inv.billing_month}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#6B6A65' }}>
                          {inv.pm_name}
                        </td>
                        <td style={{
                          padding: '10px 14px', textAlign: 'right',
                          fontFamily: "'DM Mono', monospace", color: '#6B6A65', whiteSpace: 'nowrap',
                        }}>
                          {fmt(inv.fee_amount)}
                        </td>
                        <td style={{
                          padding: '10px 14px', textAlign: 'right',
                          fontFamily: "'DM Mono', monospace", color: '#6B6A65', whiteSpace: 'nowrap',
                        }}>
                          {fmt(inv.ad_spend_amount)}
                        </td>
                        <td style={{
                          padding: '10px 14px', textAlign: 'right',
                          fontFamily: "'DM Mono', monospace", color: '#0F6E56', whiteSpace: 'nowrap',
                        }}>
                          {fmt(inv.commission_amount)}
                        </td>
                        <td style={{
                          padding: '10px 14px', textAlign: 'right',
                          fontFamily: "'DM Mono', monospace", fontWeight: 600,
                          color: '#1A1A18', whiteSpace: 'nowrap',
                        }}>
                          {fmt(inv.invoice_total)}
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 8px', borderRadius: 4,
                            background: st.bg, color: st.color,
                            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
                            {st.label}
                          </span>
                        </td>
                        <td style={{
                          padding: '10px 14px', fontSize: 12, color: '#9C9A92', whiteSpace: 'nowrap',
                        }}>
                          {date}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
