import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import InvoiceRowActions from '@/components/kbcbp/invoice-row-actions'

const STATUS_CONFIG = {
  draft:     { label: 'Draft',        bg: '#F5F4F1', color: '#6B6A65', dot: '#B4B2A9' },
  review:    { label: 'Under Review', bg: '#FAEEDA', color: '#854F0B', dot: '#EF9F27' },
  approved:  { label: 'Approved',     bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75' },
  rejected:  { label: 'Rejected',     bg: '#FCEBEB', color: '#A32D2D', dot: '#E05252' },
  sent:      { label: 'Sent',         bg: '#E6F1FB', color: '#185FA5', dot: '#185FA5' },
  paid:      { label: 'Paid',         bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75' },
} as const

function fmt(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 4,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
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
        { label: 'Approvals', href: '/approvals', active: false },
        { label: 'Invoices', href: '/invoices', active: true },
        { label: 'Reports', href: '#', active: false },
      ].map(item => (
        <Link key={item.label} href={item.href} style={{
          padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
          background: item.active ? '#EEEDFE' : 'transparent',
          color: item.active ? '#3C3489' : '#6B6A65',
          textDecoration: 'none', transition: 'all 0.15s',
        }}>
          {item.label}
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <Link href="/invoices/new" style={{
        padding: '6px 14px', borderRadius: 6, border: 'none',
        background: '#534AB7', color: 'white', fontSize: 12, fontWeight: 600,
        textDecoration: 'none', fontFamily: 'inherit',
      }}>
        + Create Invoice
      </Link>
      <div style={{ width: 1, height: 20, background: '#E8E6E1', margin: '0 8px' }} />
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: '#534AB7',
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600,
      }}>VM</div>
    </div>
  )
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })

  const all = invoices ?? []
  const counts = {
    total:    all.length,
    draft:    all.filter(i => i.status === 'draft').length,
    review:   all.filter(i => i.status === 'review').length,
    approved: all.filter(i => i.status === 'approved').length,
  }

  const cols = ['Invoice #', 'Client', 'Month', 'PM', 'Fee', 'Ad Spend', 'Commission', 'Total', 'Status', '']

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
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#534AB7', marginRight: 5 }} />
          {counts.total} total
        </span>
        <span style={{ width: 1, height: 16, background: '#E8E6E1', display: 'inline-block' }} />
        <span>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#B4B2A9', marginRight: 5 }} />
          {counts.draft} draft
        </span>
        <span style={{ width: 1, height: 16, background: '#E8E6E1', display: 'inline-block' }} />
        <span>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#EF9F27', marginRight: 5 }} />
          {counts.review} under review
        </span>
        <span style={{ width: 1, height: 16, background: '#E8E6E1', display: 'inline-block' }} />
        <span>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#1D9E75', marginRight: 5 }} />
          {counts.approved} approved
        </span>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 80px' }}>
        {all.length === 0 ? (
          <div style={{
            background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E6E1',
            padding: '60px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', marginBottom: 6 }}>No invoices yet</div>
            <div style={{ fontSize: 13, color: '#9C9A92', marginBottom: 20 }}>
              Create your first invoice to get started
            </div>
            <Link href="/invoices/new" style={{
              display: 'inline-block', padding: '8px 20px', borderRadius: 8,
              background: '#534AB7', color: 'white', fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
            }}>
              Create Invoice
            </Link>
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
                        textTransform: 'uppercase', letterSpacing: '0.4px',
                        color: '#9C9A92', borderBottom: '1px solid #E8E6E1',
                        background: '#FFFFFF', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {all.map((inv, idx) => (
                    <tr key={inv.id} style={{
                      borderBottom: idx < all.length - 1 ? '1px solid #E8E6E1' : 'none',
                    }}>
                      <td style={{
                        padding: '10px 14px',
                        fontFamily: "'DM Mono', monospace", fontWeight: 500,
                        color: '#3C3489', whiteSpace: 'nowrap', minWidth: 90,
                      }}>
                        {inv.invoice_number ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1A1A18', minWidth: 160 }}>
                        {inv.client_name}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6B6A65', whiteSpace: 'nowrap' }}>
                        {inv.billing_month}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6B6A65', minWidth: 100 }}>
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
                        <StatusBadge status={inv.status} />
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <InvoiceRowActions id={inv.id} status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
