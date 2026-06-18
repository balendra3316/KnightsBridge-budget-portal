'use client'

import { useState, useTransition } from 'react'
import { updateInvoiceStatus, createQuickbooksInvoice } from '@/app/(main)/invoices/actions'
import type { Role } from '@/lib/auth'

type Props = { id: string; status: string; role: Role }

const btnCls = "px-2.5 py-1 rounded-[5px] border-none text-[11px] font-semibold cursor-pointer font-sans transition-colors duration-150"

export default function InvoiceRowActions({ id, status, role }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const canApprove = role === 'approver' || role === 'admin'
  const canCreate = role === 'creator' || role === 'admin'

  const change = (newStatus: 'draft' | 'review' | 'approved' | 'rejected') => {
    setError(null)
    startTransition(async () => {
      const result = await updateInvoiceStatus(id, newStatus)
      if (result.error) setError(result.error)
    })
  }

  const sendToQuickbooks = () => {
    setError(null)
    startTransition(async () => {
      const result = await createQuickbooksInvoice(id)
      if (result.error) setError(result.error)
    })
  }

  if (isPending) {
    return <span className="text-[11px] text-kb-fg-3">Updating…</span>
  }

  if (error) {
    return <span className="text-[11px] text-kb-red">{error}</span>
  }

  if (status === 'draft') {
    if (!canCreate) return null
    return (
      <button onClick={() => change('review')}
        className={`${btnCls} bg-kb-accent-light text-kb-accent-text`}>
        Send for Review
      </button>
    )
  }

  if (status === 'review') {
    if (!canApprove) {
      return <span className="text-[11px] text-kb-fg-3">Awaiting approval</span>
    }
    return (
      <div className="flex gap-1.5">
        <button onClick={() => change('approved')}
          className={`${btnCls} bg-kb-green-light text-kb-green`}>
          Approve
        </button>
        <button onClick={() => change('rejected')}
          className={`${btnCls} bg-kb-red-light text-kb-red`}>
          Reject
        </button>
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <button onClick={sendToQuickbooks}
        className={`${btnCls} bg-kb-accent text-white`}>
        Create Invoice in QuickBooks
      </button>
    )
  }

  if (status === 'sent') {
    return (
      <span className="text-[11px] text-kb-blue font-medium">
        &#10003; Sent to QuickBooks
      </span>
    )
  }

  if (status === 'rejected') {
    if (!canCreate) return null
    return (
      <button onClick={() => change('draft')}
        className={`${btnCls} bg-kb-surface-alt text-kb-fg-2`}>
        Reset to Draft
      </button>
    )
  }

  return null
}
