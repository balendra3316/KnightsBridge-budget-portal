'use client'

import { useState, useTransition } from 'react'
import { approveInvoice, rejectInvoice, adminLogout } from '@/app/admin/actions'

type Invoice = {
  id: string
  invoice_number: string
  client_name: string
  billing_month: string
  pm_name: string
  billing_pattern: string
  commission_rate: number
  fee_amount: number
  ad_spend_amount: number
  commission_amount: number
  invoice_total: number
  monthly_total: number
  status: string
  approver_note: string | null
  created_at: string
}

function fmt(n: number) {
  if (!n || n === 0) return '$0'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  review:   { bg: '#FAEEDA', color: '#854F0B', dot: '#EF9F27', label: 'Pending' },
  approved: { bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75', label: 'Approved' },
  rejected: { bg: '#FCEBEB', color: '#A32D2D', dot: '#E05252', label: 'Rejected' },
  sent:     { bg: '#E6F1FB', color: '#185FA5', dot: '#185FA5', label: 'Sent' },
  draft:    { bg: '#F5F4F1', color: '#6B6A65', dot: '#B4B2A9', label: 'Draft' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  )
}

function InvoiceRow({ inv, showActions }: { inv: Invoice; showActions?: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const handleApprove = () => {
    setMsg(null)
    startTransition(async () => {
      const result = await approveInvoice(inv.id)
      if (result.error) setMsg(result.error)
      else setMsg('Approved')
    })
  }

  const handleReject = () => {
    setMsg(null)
    startTransition(async () => {
      const result = await rejectInvoice(inv.id, rejectNote)
      if (result.error) setMsg(result.error)
      else setMsg('Rejected')
    })
  }

  return (
    <>
      <tr style={{ borderBottom: '1px solid #E8E6E1' }}>
        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 500, color: '#3C3489' }}>
          {inv.invoice_number}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>
          {inv.client_name}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B6A65' }}>
          {inv.billing_month}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B6A65' }}>
          {inv.pm_name}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: "'DM Mono', monospace", textAlign: 'right', color: '#6B6A65' }}>
          {fmt(inv.fee_amount)}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: "'DM Mono', monospace", textAlign: 'right', color: '#6B6A65' }}>
          {fmt(inv.ad_spend_amount)}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: "'DM Mono', monospace", textAlign: 'right', color: '#0F6E56', fontWeight: 500 }}>
          {fmt(inv.commission_amount)}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 13, fontFamily: "'DM Mono', monospace", textAlign: 'right', fontWeight: 700, color: '#3C3489' }}>
          {fmt(inv.invoice_total)}
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          <StatusBadge status={inv.status} />
        </td>
        {showActions && (
          <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
            {msg ? (
              <span style={{
                fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
                background: msg === 'Approved' ? '#E1F5EE' : '#FCEBEB',
                color: msg === 'Approved' ? '#0F6E56' : '#A32D2D',
              }}>{msg}</span>
            ) : isPending ? (
              <span style={{ fontSize: 11, color: '#9C9A92' }}>Saving...</span>
            ) : (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={handleApprove} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none',
                  background: '#0F6E56', color: 'white', fontSize: 12,
                  fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                }}>Approve</button>
                <button onClick={() => setRejectOpen(!rejectOpen)} style={{
                  padding: '5px 14px', borderRadius: 6, border: '1px solid #E8E6E1',
                  background: rejectOpen ? '#FCEBEB' : '#FFFFFF', color: '#A32D2D', fontSize: 12,
                  fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                }}>Reject</button>
              </div>
            )}
          </td>
        )}
        {!showActions && inv.approver_note && (
          <td style={{ padding: '10px 12px', fontSize: 11, color: '#A32D2D', maxWidth: 200 }}>
            {inv.approver_note}
          </td>
        )}
      </tr>
      {rejectOpen && showActions && (
        <tr style={{ borderBottom: '1px solid #E8E6E1' }}>
          <td colSpan={10} style={{ padding: '8px 12px', background: '#FFF8F8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 500, marginLeft: 'auto' }}>
              <input
                autoFocus
                placeholder="Rejection reason (optional)"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleReject() }}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6,
                  border: '1px solid #E8C4C4', fontSize: 12,
                  fontFamily: 'inherit', outline: 'none', background: '#FFFFFF',
                }}
              />
              <button onClick={handleReject} disabled={isPending} style={{
                padding: '6px 14px', borderRadius: 6, border: 'none',
                background: '#A32D2D', color: 'white', fontSize: 12,
                fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              }}>Confirm Reject</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminInvoiceTable({
  invoices,
  showActions,
}: {
  invoices: Invoice[]
  showActions?: boolean
}) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E6E1',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E8E6E1' }}>
              {['Invoice #', 'Client', 'Month', 'PM', 'Fee', 'Ad Spend', 'Commission', 'Total', 'Status',
                ...(showActions ? ['Actions'] : ['Note'])
              ].map(h => (
                <th key={h} style={{
                  padding: '10px 12px', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase' as const, letterSpacing: '0.4px',
                  color: '#9C9A92', textAlign: h === 'Fee' || h === 'Ad Spend' || h === 'Commission' || h === 'Total' ? 'right'
                    : h === 'Status' ? 'center' : h === 'Actions' ? 'right' : 'left',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <InvoiceRow key={inv.id} inv={inv} showActions={showActions} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(() => adminLogout())}
      disabled={isPending}
      style={{
        padding: '5px 12px', borderRadius: 6, border: '1px solid #E8E6E1',
        background: '#FFFFFF', color: '#6B6A65', fontSize: 12,
        fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
      }}
    >Sign Out</button>
  )
}

