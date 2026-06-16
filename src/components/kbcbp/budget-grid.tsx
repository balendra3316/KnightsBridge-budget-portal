'use client'

import { useState, useTransition, useRef } from 'react'
import {
  saveBudgetEntries, createDraftFromBudget, sendForReview,
  addService, addSubService, deleteService,
} from '@/app/budget/actions'
import { computeInvoice, RATE_OPTIONS } from '@/lib/commission'

type Service = {
  id: string; service_name: string; service_type: string
  credit_card: string; parent_service_id: string | null; sort_order: number
}
type BudgetEntry = { service_id: string; billing_month: string; amount: number }
type InvoiceInfo = {
  id: string; invoice_number: string; status: string; billing_month: string
  commission_amount: number | null; invoice_total: number | null; monthly_total: number | null
}
type Client = {
  id: string; name: string; project_name: string | null; parent_group: string | null
  region: string | null; tags: string[] | null; team: string | null
  commission_rate: number; billing_pattern: string; notes: string[] | null
}
type Props = {
  client: Client; services: Service[]; entries: BudgetEntry[]
  months: string[]; invoices: InvoiceInfo[]
}

const CC_MAP: Record<string, { label: string; bg: string; color: string } | null> = {
  'KB Card':     { label: 'KB CARD',     bg: '#FCEBEB', color: '#A32D2D' },
  'Client Card': { label: 'CLIENT CARD', bg: '#E6F1FB', color: '#185FA5' },
  '':            null,
}
const SVC_DOT: Record<string, string> = { fee: '#854F0B', ad: '#993C1D', seo: '#0F6E56' }

function fmt(n: number) {
  if (n === 0) return '$0'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function BudgetGrid({ client, services, entries, months, invoices }: Props) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const amountsRef = useRef<Record<string, number>>({})
  const [activeMonth, setActiveMonth] = useState<string | null>(null)
  const [, forceRender] = useState(0)

  const [addMode, setAddMode] = useState<'service' | 'sub' | null>(null)
  const [newSvcName, setNewSvcName] = useState('')
  const [newSvcType, setNewSvcType] = useState<'fee' | 'ad' | 'seo'>('fee')
  const [newSvcCC, setNewSvcCC] = useState('')
  const [newSvcParentId, setNewSvcParentId] = useState('')

  const getAmount = (svcId: string, month: string): number => {
    const e = entries.find(x => x.service_id === svcId && x.billing_month === month)
    return e ? Number(e.amount) : 0
  }
  const getCurrentAmount = (svcId: string): number => {
    if (!activeMonth) return 0
    if (amountsRef.current[svcId] !== undefined) return amountsRef.current[svcId]
    return getAmount(svcId, activeMonth)
  }
  const updateAmount = (svcId: string, value: number) => {
    amountsRef.current[svcId] = value
    forceRender(n => n + 1)
  }
  const handleMonthClick = (month: string) => {
    if (activeMonth === month) return
    amountsRef.current = {}
    setActiveMonth(month)
    setMsg(null)
  }

  const [rate, setRate] = useState<number>((Number(client.commission_rate) || 0) / 100)

  const computeMonthTotal = (month: string) =>
    services.filter(s => !s.parent_service_id).reduce((sum, s) => sum + getAmount(s.id, month), 0)

  const currentLines = activeMonth ? services.map(s => ({
    service_type: s.service_type, credit_card: s.credit_card,
    parent_service_id: s.parent_service_id, amount: getCurrentAmount(s.id),
  })) : []
  const calc = activeMonth
    ? computeInvoice(currentLines, rate)
    : { feeLines: 0, clientCardAd: 0, kbCardAd: 0, monthlyTotal: 0, commission: 0, invoiceTotal: 0, netSpend: 0, kbKeeps: 0 }

  const activeInvoice = activeMonth ? invoices.find(i => i.billing_month === activeMonth) ?? null : null
  const invoiceStatus = activeInvoice?.status
  const editable = activeMonth && (!activeInvoice || invoiceStatus === 'draft' || invoiceStatus === 'rejected')

  // Services can be added/deleted only while the SELECTED month is still editable
  // (no invoice yet, or draft/rejected). Submitted months (review/approved/sent)
  // are locked. Old finalized months keep showing their saved invoice snapshot.
  const canEditServices = !!editable

  // Display order: all top-level services first, then all sub-services below — two
  // groups, each sorted by sort_order.
  const orderedServices = (() => {
    const byOrder = (a: Service, b: Service) => a.sort_order - b.sort_order
    const tops = services.filter(s => !s.parent_service_id).sort(byOrder)
    const subs = services.filter(s => s.parent_service_id).sort(byOrder)
    return [...tops, ...subs]
  })()

  // Leave edit mode, discarding any unsaved cell edits.
  const closeEdit = () => {
    amountsRef.current = {}
    setActiveMonth(null)
    setMsg(null)
  }
  const handleSave = () => {
    if (!activeMonth) return
    setMsg(null)
    startTransition(async () => {
      const ents = services.map(s => ({ service_id: s.id, amount: getCurrentAmount(s.id) }))
      const r = await saveBudgetEntries(client.id, activeMonth, ents)
      if (r.error) { setMsg(r.error); return }
      closeEdit()   // saved — exit edit mode
    })
  }
  const handleSaveAndDraft = () => {
    if (!activeMonth) return
    setMsg(null)
    startTransition(async () => {
      const ents = services.map(s => ({ service_id: s.id, amount: getCurrentAmount(s.id) }))
      const r1 = await saveBudgetEntries(client.id, activeMonth, ents)
      if (r1.error) { setMsg(r1.error); return }
      const r2 = await createDraftFromBudget(client.id, activeMonth, rate)
      setMsg(r2.error || 'Draft invoice created')
    })
  }
  const handleSendReview = () => {
    if (!activeMonth) return
    setMsg(null)
    startTransition(async () => {
      const r = await sendForReview(client.id, activeMonth)
      setMsg(r.error || 'Sent for review')
    })
  }
  const handleResubmit = () => {
    if (!activeMonth) return
    setMsg(null)
    startTransition(async () => {
      const ents = services.map(s => ({ service_id: s.id, amount: getCurrentAmount(s.id) }))
      const r1 = await saveBudgetEntries(client.id, activeMonth, ents)
      if (r1.error) { setMsg(r1.error); return }
      const r2 = await sendForReview(client.id, activeMonth)
      setMsg(r2.error || 'Resent for approval')
    })
  }
  const closeAdd = () => {
    setAddMode(null); setNewSvcName(''); setNewSvcType('fee'); setNewSvcCC(''); setNewSvcParentId('')
  }
  const handleAddService = () => {
    if (!newSvcName.trim()) return
    if (addMode === 'sub' && !newSvcParentId) { setMsg('Pick a parent service'); return }
    startTransition(async () => {
      const result = addMode === 'sub'
        ? await addSubService(client.id, newSvcParentId, newSvcName.trim())
        : await addService(client.id, newSvcName.trim(), newSvcType, newSvcCC)
      if (result.error) { setMsg(result.error); return }
      closeAdd()
    })
  }
  const handleDelete = (svcId: string) => {
    setMsg(null)
    startTransition(async () => {
      const r = await deleteService(svcId)
      if (r.error) setMsg(r.error)
    })
  }

  const selectCss: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 6, border: '1px solid #D3D1C7',
    background: '#FFFFFF', fontSize: 11, fontWeight: 600, color: '#3C3489',
    fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  }

  return (
    <div className="rounded-xl mb-4 overflow-hidden"
      style={{ background: '#FFFFFF', border: '1px solid #E8E6E1' }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3 flex-wrap"
        style={{ borderBottom: '1px solid #E8E6E1', background: '#F5F4F1' }}>
        <div className="text-[15px] font-semibold tracking-tight">{client.name}</div>
        {client.project_name && (
          <div className="text-[13px] font-medium" style={{ color: '#6B6A65' }}>
            <span style={{ color: '#9C9A92' }}>/ </span>{client.project_name}
          </div>
        )}
        {client.region && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase"
            style={{ background: '#E6F1FB', color: '#185FA5' }}>
            {client.region}
          </span>
        )}
        {client.tags?.map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase"
            style={{ background: '#FAECE7', color: '#993C1D' }}>
            {tag}
          </span>
        ))}
        <div className="flex-1" />
        <div className="text-xs" style={{ color: '#9C9A92' }}>
          Team: <strong className="font-medium" style={{ color: '#6B6A65' }}>{client.team}</strong>
        </div>
      </div>

      {/* Notes */}
      {client.notes && client.notes.length > 0 && (
        <div className="px-5 py-2 flex gap-3 items-center flex-wrap"
          style={{ borderBottom: '1px solid #E8E6E1' }}>
          {client.notes.map((note, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
              style={{ background: '#F5F4F1', color: '#6B6A65', border: '1px solid #E8E6E1' }}>
              {note}
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-[11px] uppercase tracking-wider min-w-[240px] sticky left-0 z-[2]"
                style={{ color: '#9C9A92', borderBottom: '1px solid #E8E6E1', background: '#FFFFFF' }}>
                Service
              </th>
              <th className="px-3 py-2 text-center font-medium text-[11px] uppercase tracking-wider min-w-[85px] sticky left-[240px] z-[2]"
                style={{ color: '#9C9A92', borderBottom: '1px solid #E8E6E1', background: '#FFFFFF' }}>
                CC
              </th>
              {months.map(m => {
                const isActive = m === activeMonth
                const inv = invoices.find(i => i.billing_month === m)
                return (
                  <th key={m} onClick={() => handleMonthClick(m)}
                    className="px-3 py-2 text-right text-[11px] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none min-w-[100px]"
                    style={{
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#854F0B' : '#9C9A92',
                      borderBottom: '1px solid #E8E6E1',
                      background: isActive ? '#FFFBEB' : '#FFFFFF',
                      transition: 'background 0.15s, color 0.15s',
                    }}>
                    {m}
                    <span className="block text-[9px] font-medium tracking-normal normal-case mt-0.5"
                      style={{ color: isActive ? '#B07D0A' : inv ? '#0F6E56' : '#C4C2B8' }}>
                      {isActive ? (editable ? 'Editing' : 'Locked')
                        : inv ? inv.status : 'Click to edit'}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {orderedServices.map(svc => {
              const isSub = !!svc.parent_service_id
              return (
                <tr key={svc.id}>
                  <td className="px-3 py-1.5 sticky left-0 z-[1]"
                    style={{ borderBottom: '1px solid #E8E6E1', color: isSub ? '#9C9A92' : '#1A1A18', background: '#FFFFFF' }}>
                    <div className="flex items-center gap-2" style={{ paddingLeft: isSub ? 20 : 0 }}>
                      {isSub ? (
                        <span className="shrink-0" style={{ color: '#C4C2B8' }}>&#8627;</span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-sm shrink-0"
                          style={{ background: SVC_DOT[svc.service_type] ?? '#9C9A92' }} />
                      )}
                      <span className="flex-1">{svc.service_name}</span>
                      {isSub && (
                        <span className="text-[9px] font-semibold tracking-wide uppercase rounded px-1 py-px"
                          style={{ color: '#B4B2A9', border: '1px solid #E8E6E1' }}>
                          sub
                        </span>
                      )}
                      <button onClick={() => handleDelete(svc.id)}
                        disabled={isPending || !canEditServices}
                        title={canEditServices ? 'Delete'
                          : activeMonth ? 'Locked — this month is already submitted'
                          : 'Click a draft month to edit services'}
                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-sm leading-none disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        style={{ color: '#C4554D', background: 'transparent', border: 'none' }}>
                        &times;
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center sticky left-[240px] z-[1]"
                    style={{ borderBottom: '1px solid #E8E6E1', background: '#FFFFFF' }}>
                    {CC_MAP[svc.credit_card] ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide"
                        style={{ background: CC_MAP[svc.credit_card]!.bg, color: CC_MAP[svc.credit_card]!.color }}>
                        {CC_MAP[svc.credit_card]!.label}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: '#9C9A92' }}>&mdash;</span>
                    )}
                  </td>
                  {months.map(m => {
                    const isActive = m === activeMonth
                    if (isActive && editable) {
                      return (
                        <td key={m} className="px-3 py-1.5 text-right"
                          style={{ borderBottom: '1px solid #E8E6E1', background: '#FFFBEB' }}>
                          <EditableCell defaultValue={getCurrentAmount(svc.id)} onChange={v => updateAmount(svc.id, v)} />
                        </td>
                      )
                    }
                    const amt = getAmount(svc.id, m)
                    return (
                      <td key={m} className="px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap"
                        style={{ borderBottom: '1px solid #E8E6E1', color: '#6B6A65', background: isActive ? '#FFFBEB' : undefined }}>
                        {amt > 0 ? fmt(amt) : <span style={{ color: '#9C9A92' }}>&mdash;</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}


            {/* Commission row — saved value per month, or live preview for the active month */}
            <tr>
              <td className="px-3 py-1.5 font-medium text-[12px] sticky left-0 z-[1]"
                style={{ color: '#0F6E56', borderTop: '2px solid #D3D1C7', background: '#FFFFFF' }}>
                Commission
              </td>
              <td className="sticky left-[240px] z-[1]"
                style={{ borderTop: '2px solid #D3D1C7', background: '#FFFFFF' }} />
              {months.map(m => {
                const inv = invoices.find(i => i.billing_month === m) ?? null
                const isActive = m === activeMonth
                const value = inv ? Number(inv.commission_amount) || 0
                  : isActive ? calc.commission : 0
                return (
                  <td key={m} className="px-3 py-1.5 text-right font-mono text-xs"
                    style={{
                      color: '#0F6E56', borderTop: '2px solid #D3D1C7',
                      background: isActive ? '#FFFBEB' : undefined,
                    }}>
                    {value > 0 ? fmt(value) : <span style={{ color: '#C4C2B8' }}>&mdash;</span>}
                  </td>
                )
              })}
            </tr>

            {/* Monthly total row */}
            <tr>
              <td className="px-3 py-2 font-semibold text-[13px] sticky left-0 z-[1]"
                style={{ color: '#1A1A18', background: '#FFFFFF' }}>
                Monthly total
              </td>
              <td className="sticky left-[240px] z-[1]" style={{ background: '#FFFFFF' }} />
              {months.map(m => {
                const isActive = m === activeMonth
                const inv = invoices.find(i => i.billing_month === m) ?? null
                // Finalized months show the saved snapshot; otherwise compute live.
                const total = isActive ? calc.monthlyTotal
                  : inv && inv.monthly_total != null ? Number(inv.monthly_total)
                  : computeMonthTotal(m)
                return (
                  <td key={m} className="px-3 py-2 text-right font-semibold font-mono text-xs"
                    style={{
                      color: isActive ? '#3C3489' : '#1A1A18',
                      background: isActive ? '#FFFBEB' : undefined,
                    }}>
                    {total > 0 ? fmt(total) : '—'}
                  </td>
                )
              })}
            </tr>

            {/* Invoice total row — the billed amount, saved per month */}
            <tr>
              <td className="px-3 py-2 font-semibold text-[13px] sticky left-0 z-[1]"
                style={{ color: '#3C3489', background: '#FFFFFF' }}>
                Invoice total
              </td>
              <td className="sticky left-[240px] z-[1]" style={{ background: '#FFFFFF' }} />
              {months.map(m => {
                const inv = invoices.find(i => i.billing_month === m) ?? null
                const isActive = m === activeMonth
                const value = inv ? Number(inv.invoice_total) || 0
                  : isActive ? calc.invoiceTotal : 0
                return (
                  <td key={m} className="px-3 py-2 text-right font-bold font-mono text-xs"
                    style={{ color: '#3C3489', background: isActive ? '#FFFBEB' : undefined }}>
                    {value > 0 ? fmt(value) : <span style={{ color: '#C4C2B8' }}>&mdash;</span>}
                  </td>
                )
              })}
            </tr>

            {/* Invoice row */}
            <tr>
              <td className="px-3 py-1 pb-2 font-medium uppercase tracking-wide text-[10px] sticky left-0 z-[1]"
                style={{ color: '#9C9A92', background: '#FFFFFF' }}>
                Invoice
              </td>
              <td className="sticky left-[240px] z-[1]" style={{ background: '#FFFFFF' }} />
              {months.map(m => {
                const inv = invoices.find(i => i.billing_month === m) ?? null
                const isActive = m === activeMonth
                return (
                  <td key={m} className="px-3 py-1 pb-2 text-right text-[11px]"
                    style={{ background: isActive ? '#FFFBEB' : undefined }}>
                    {inv ? <InvoiceStatusBadge status={inv.status} num={inv.invoice_number} />
                      : <span style={{ color: '#C4C2B8', fontSize: 10 }}>—</span>}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Manage services — kept outside the scrolling table so it always fits on screen */}
      <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap"
        style={{ borderTop: '1px solid #E8E6E1' }}>
        {!canEditServices ? (
          <span className="text-[11px]" style={{ color: '#9C9A92' }}>
            {activeMonth
              ? '🔒 This month is submitted — services are locked'
              : 'Click a draft month to add or remove services'}
          </span>
        ) : addMode === null ? (
          <>
            <button onClick={() => setAddMode('service')}
              className="px-3 py-1.5 rounded text-[11px] font-semibold cursor-pointer"
              style={{ border: '1px dashed #D3D1C7', background: 'transparent', color: '#534AB7' }}>
              + Add Service
            </button>
            <button onClick={() => setAddMode('sub')}
              className="px-3 py-1.5 rounded text-[11px] font-semibold cursor-pointer"
              style={{ border: '1px dashed #D3D1C7', background: 'transparent', color: '#9C9A92' }}>
              + Add Sub-Service
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-wrap w-full">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold"
              style={{ background: '#EEEDFE', color: '#3C3489' }}>
              {addMode === 'service' ? 'New service' : 'New sub-service'}
            </span>
            <input autoFocus placeholder="Name (any label)" value={newSvcName}
              onChange={e => setNewSvcName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddService() }}
              className="flex-1 min-w-[140px] max-w-[280px] px-2.5 py-1.5 rounded text-xs outline-none"
              style={{ border: '1px solid #D3D1C7' }}
            />
            {addMode === 'service' ? (
              <>
                <select value={newSvcType}
                  onChange={e => setNewSvcType(e.target.value as 'fee' | 'ad' | 'seo')} style={selectCss}>
                  <option value="fee">Fee</option>
                  <option value="ad">Ad Spend</option>
                  <option value="seo">SEO</option>
                </select>
                <select value={newSvcCC} onChange={e => setNewSvcCC(e.target.value)} style={selectCss}>
                  <option value="">No Card</option>
                  <option value="Client Card">Client Card</option>
                  <option value="KB Card">KB Card</option>
                </select>
              </>
            ) : (
              <select value={newSvcParentId} onChange={e => setNewSvcParentId(e.target.value)} style={selectCss}>
                <option value="">Parent service…</option>
                {services.filter(s => !s.parent_service_id).map(p => (
                  <option key={p.id} value={p.id}>{p.service_name}</option>
                ))}
              </select>
            )}
            <button onClick={handleAddService} disabled={isPending || !newSvcName.trim()}
              className="px-3.5 py-1.5 rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
              style={{ background: '#534AB7', color: 'white', border: 'none' }}>
              Add
            </button>
            <button onClick={closeAdd}
              className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
              style={{ border: '1px solid #D9B0AC', background: '#FCEBEB', color: '#A32D2D' }}>
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Summary strip */}
      {activeMonth && (
        <div className="flex gap-4 px-5 py-2.5 text-xs items-center flex-wrap"
          style={{ background: '#F5F4F1', borderTop: '1px solid #E8E6E1', color: '#6B6A65' }}>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold"
            style={{ background: '#FFFBEB', color: '#854F0B', border: '1px solid #EFD99B' }}>
            {activeMonth}
          </span>

          {!activeInvoice ? (
            <label className="flex items-center gap-1.5">
              <span style={{ color: '#9C9A92' }}>Commission</span>
              <select value={rate} onChange={e => setRate(parseFloat(e.target.value))} style={selectCss}>
                {RATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ) : (
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold"
              style={{ background: '#EEEDFE', color: '#3C3489' }}>
              Commission {rate * 100}%
            </span>
          )}

          <span className="w-px h-4" style={{ background: '#E8E6E1' }} />

          <div>
            <span style={{ color: '#9C9A92' }}>Fee </span>
            <span className="font-semibold font-mono text-[11px]" style={{ color: '#1A1A18' }}>{fmt(calc.feeLines)}</span>
          </div>
          {calc.clientCardAd > 0 && (
            <div>
              <span style={{ color: '#9C9A92' }}>Client-Card ad </span>
              <span className="font-semibold font-mono text-[11px]" style={{ color: '#1A1A18' }}>{fmt(calc.clientCardAd)}</span>
            </div>
          )}
          {calc.kbCardAd > 0 && (
            <div>
              <span style={{ color: '#9C9A92' }}>KB-Card ad </span>
              <span className="font-semibold font-mono text-[11px]" style={{ color: '#1A1A18' }}>{fmt(calc.kbCardAd)}</span>
            </div>
          )}
          {calc.clientCardAd > 0 && rate > 0 && (
            <div>
              <span style={{ color: '#9C9A92' }}>Commission </span>
              <span className="font-semibold font-mono text-[11px]" style={{ color: '#0F6E56' }}>{fmt(calc.commission)}</span>
            </div>
          )}
          {calc.kbCardAd > 0 && rate > 0 && (
            <div>
              <span style={{ color: '#9C9A92' }}>KB net spend </span>
              <span className="font-semibold font-mono text-[11px]" style={{ color: '#854F0B' }}>{fmt(calc.netSpend)}</span>
            </div>
          )}

          <div className="flex-1" />

          {msg && (
            <span className="text-[11px] px-2.5 py-0.5 rounded font-medium"
              style={{
                background: msg.includes('error') || msg.includes('No') ? '#FCEBEB' : '#E1F5EE',
                color: msg.includes('error') || msg.includes('No') ? '#A32D2D' : '#0F6E56',
              }}>{msg}</span>
          )}

          {!isPending && (
            <button onClick={closeEdit}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
              style={{ border: '1px solid #E8E6E1', background: '#FFFFFF', color: '#6B6A65' }}>
              Close
            </button>
          )}

          {isPending ? (
            <span className="text-[11px]" style={{ color: '#9C9A92' }}>Saving&hellip;</span>
          ) : !activeInvoice ? (
            <div className="flex gap-2">
              <button onClick={handleSave}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
                style={{ background: '#0F6E56', color: 'white', border: 'none' }}>
                Save
              </button>
              <button onClick={handleSaveAndDraft}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
                style={{ background: '#534AB7', color: 'white', border: 'none' }}>
                Create Draft
              </button>
            </div>
          ) : invoiceStatus === 'draft' ? (
            <button onClick={handleSendReview}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
              style={{ background: '#EEEDFE', color: '#3C3489', border: 'none' }}>
              Send for Approval
            </button>
          ) : invoiceStatus === 'review' ? (
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold"
              style={{ background: '#FAEEDA', color: '#854F0B' }}>Under Review</span>
          ) : invoiceStatus === 'approved' ? (
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold"
              style={{ background: '#E1F5EE', color: '#0F6E56' }}>Approved</span>
          ) : invoiceStatus === 'sent' ? (
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold"
              style={{ background: '#E6F1FB', color: '#185FA5' }}>Sent to QuickBooks</span>
          ) : invoiceStatus === 'rejected' ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold"
                style={{ background: '#FCEBEB', color: '#A32D2D' }}>Rejected</span>
              <button onClick={handleResubmit}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
                style={{ background: '#EEEDFE', color: '#3C3489', border: 'none' }}>
                Resend for Approval
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ---- Sub-components ---- */

function EditableCell({ defaultValue, onChange }: { defaultValue: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState(String(defaultValue))

  const commit = () => {
    setEditing(false)
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ''))
    const val = isNaN(n) ? 0 : n
    setRaw(String(val))
    onChange(val)
  }

  if (!editing) {
    return (
      <span onClick={() => setEditing(true)}
        className="inline-block min-w-[70px] text-right px-2 py-1 rounded font-medium font-mono text-xs cursor-text"
        style={{ color: '#3C3489', background: '#E8E5FC', border: '1px dashed #534AB7', transition: 'all 0.15s' }}>
        {fmt(defaultValue)}
      </span>
    )
  }

  return (
    <input autoFocus value={raw}
      onChange={e => setRaw(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }}
      className="w-[90px] text-right px-2 py-1 rounded font-mono text-xs outline-none"
      style={{ border: '1px solid #534AB7', background: '#FFFFFF', boxShadow: '0 0 0 3px rgba(83,74,183,0.15)' }}
    />
  )
}

function InvoiceStatusBadge({ status, num }: { status: string; num: string }) {
  const colors: Record<string, string> = {
    draft: '#6B6A65', review: '#854F0B', approved: '#0F6E56', sent: '#185FA5', rejected: '#A32D2D',
  }
  const dots: Record<string, string> = {
    draft: '#B4B2A9', review: '#EF9F27', approved: '#1D9E75', sent: '#185FA5', rejected: '#E05252',
  }
  const labels: Record<string, string> = {
    draft: 'Draft', review: 'Review', approved: 'Approved', sent: 'Sent', rejected: 'Rejected',
  }
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-mono text-[11px] font-medium" style={{ color: '#3C3489' }}>{num}</span>
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap"
        style={{ color: colors[status] ?? '#6B6A65' }}>
        <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ background: dots[status] ?? '#B4B2A9' }} />
        {labels[status] ?? status}
      </span>
    </div>
  )
}
