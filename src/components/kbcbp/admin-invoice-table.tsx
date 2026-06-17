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

const STATUS_CLS: Record<string, { label: string; cls: string; dotCls: string }> = {
  review:   { label: 'Pending',  cls: 'bg-kb-amber-light text-kb-amber', dotCls: 'bg-kb-amber-dot' },
  approved: { label: 'Approved', cls: 'bg-kb-green-light text-kb-green', dotCls: 'bg-kb-green-dot' },
  rejected: { label: 'Rejected', cls: 'bg-kb-red-light text-kb-red',     dotCls: 'bg-kb-red-dot' },
  sent:     { label: 'Sent',     cls: 'bg-kb-blue-light text-kb-blue',   dotCls: 'bg-kb-blue' },
  draft:    { label: 'Draft',    cls: 'bg-kb-surface-alt text-kb-fg-2',  dotCls: 'bg-kb-muted' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CLS[status] ?? STATUS_CLS.draft
  return (
    <span className={`inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-[5px] text-[11px] font-semibold ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dotCls}`} />
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
      <tr className="border-b border-kb-border">
        <td className="px-3 py-2.5 text-xs font-mono font-medium text-kb-accent-text">
          {inv.invoice_number}
        </td>
        <td className="px-3 py-2.5 text-[13px] font-medium">
          {inv.client_name}
        </td>
        <td className="px-3 py-2.5 text-xs text-kb-fg-2">
          {inv.billing_month}
        </td>
        <td className="px-3 py-2.5 text-xs text-kb-fg-2">
          {inv.pm_name}
        </td>
        <td className="px-3 py-2.5 text-xs font-mono text-right text-kb-fg-2">
          {fmt(inv.fee_amount)}
        </td>
        <td className="px-3 py-2.5 text-xs font-mono text-right text-kb-fg-2">
          {fmt(inv.ad_spend_amount)}
        </td>
        <td className="px-3 py-2.5 text-xs font-mono text-right text-kb-green font-medium">
          {fmt(inv.commission_amount)}
        </td>
        <td className="px-3 py-2.5 text-[13px] font-mono text-right font-bold text-kb-accent-text">
          {fmt(inv.invoice_total)}
        </td>
        <td className="px-3 py-2.5 text-center">
          <StatusBadge status={inv.status} />
        </td>
        {showActions && (
          <td className="px-3 py-2.5 text-right whitespace-nowrap">
            {msg ? (
              <span className={`text-[11px] font-medium px-2 py-[3px] rounded ${msg === 'Approved' ? 'bg-kb-green-light text-kb-green' : 'bg-kb-red-light text-kb-red'}`}>
                {msg}
              </span>
            ) : isPending ? (
              <span className="text-[11px] text-kb-fg-3">Saving...</span>
            ) : (
              <div className="flex gap-1.5 justify-end">
                <button onClick={handleApprove}
                  className="px-3.5 py-[5px] rounded-md border-none bg-kb-green text-white text-xs font-semibold font-sans cursor-pointer">
                  Approve
                </button>
                <button onClick={() => setRejectOpen(!rejectOpen)}
                  className={`px-3.5 py-[5px] rounded-md border border-kb-border text-xs font-semibold font-sans cursor-pointer text-kb-red ${rejectOpen ? 'bg-kb-red-light' : 'bg-kb-surface'}`}>
                  Reject
                </button>
              </div>
            )}
          </td>
        )}
        {!showActions && inv.approver_note && (
          <td className="px-3 py-2.5 text-[11px] text-kb-red max-w-[200px]">
            {inv.approver_note}
          </td>
        )}
      </tr>
      {rejectOpen && showActions && (
        <tr className="border-b border-kb-border">
          <td colSpan={10} className="px-3 py-2 bg-kb-reject-bg">
            <div className="flex items-center gap-2 max-w-[500px] ml-auto">
              <input
                autoFocus
                placeholder="Rejection reason (optional)"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleReject() }}
                className="flex-1 px-2.5 py-1.5 rounded-md border border-kb-reject-border text-xs font-sans outline-none bg-kb-surface"
              />
              <button onClick={handleReject} disabled={isPending}
                className="px-3.5 py-1.5 rounded-md border-none bg-kb-red text-white text-xs font-semibold font-sans cursor-pointer">
                Confirm Reject
              </button>
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
    <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-kb-border">
              {['Invoice #', 'Client', 'Month', 'PM', 'Fee', 'Ad Spend', 'Commission', 'Total', 'Status',
                ...(showActions ? ['Actions'] : ['Note'])
              ].map(h => (
                <th key={h} className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-kb-fg-3 whitespace-nowrap ${
                  h === 'Fee' || h === 'Ad Spend' || h === 'Commission' || h === 'Total' ? 'text-right'
                    : h === 'Status' ? 'text-center' : h === 'Actions' ? 'text-right' : 'text-left'
                }`}>
                  {h}
                </th>
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
      className="px-3 py-[5px] rounded-md border border-kb-border bg-kb-surface text-kb-fg-2 text-xs font-medium font-sans cursor-pointer"
    >Sign Out</button>
  )
}
