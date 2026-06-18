import { createClient } from '@/lib/supabase/server'

function fmt(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const STATUS_CLS: Record<string, { label: string; cls: string; dotCls: string }> = {
  approved: { label: 'Approved',  cls: 'bg-kb-green-light text-kb-green', dotCls: 'bg-kb-green-dot' },
  sent:     { label: 'Sent to QB', cls: 'bg-kb-blue-light text-kb-blue', dotCls: 'bg-kb-blue' },
  paid:     { label: 'Paid',      cls: 'bg-kb-green-light text-kb-green', dotCls: 'bg-kb-green-dot' },
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

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center gap-4 px-6 py-2 bg-kb-surface-alt border-b border-kb-border text-xs text-kb-fg-2">
        <span className="flex items-center gap-[5px]">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-green-dot" />
          {approvedCount} approved
        </span>
        <span className="w-px h-4 inline-block bg-kb-border" />
        <span className="flex items-center gap-[5px]">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-blue" />
          {sentCount} sent to QuickBooks
        </span>
        <span className="w-px h-4 inline-block bg-kb-border" />
        <span className="flex items-center gap-[5px]">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-accent" />
          {all.length} total
        </span>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-5 pb-20">
        {all.length === 0 ? (
          <div className="bg-kb-surface rounded-xl border border-kb-border py-15 px-6 text-center">
            <div className="text-4xl mb-3">&#9989;</div>
            <div className="text-[15px] font-semibold text-kb-fg mb-1.5">No approved invoices yet</div>
            <div className="text-[13px] text-kb-fg-3">
              Invoices will appear here once they have been approved.
            </div>
          </div>
        ) : (
          <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {cols.map((h, i) => (
                      <th key={i} className={`px-3.5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-kb-fg-3 border-b border-kb-border bg-kb-surface whitespace-nowrap ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {all.map((inv, idx) => {
                    const st = STATUS_CLS[inv.status] ?? STATUS_CLS.approved
                    const date = inv.updated_at
                      ? new Date(inv.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'
                    return (
                      <tr key={inv.id} className={idx < all.length - 1 ? 'border-b border-kb-border' : ''}>
                        <td className="px-3.5 py-2.5 font-mono font-medium text-kb-accent-text whitespace-nowrap">
                          {inv.invoice_number ?? '—'}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-kb-fg min-w-[160px]">
                          {inv.client_name}
                        </td>
                        <td className="px-3.5 py-2.5 text-kb-fg-2 whitespace-nowrap">
                          {inv.billing_month}
                        </td>
                        <td className="px-3.5 py-2.5 text-kb-fg-2">
                          {inv.pm_name}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-kb-fg-2 whitespace-nowrap">
                          {fmt(inv.fee_amount)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-kb-fg-2 whitespace-nowrap">
                          {fmt(inv.ad_spend_amount)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-kb-green whitespace-nowrap">
                          {fmt(inv.commission_amount)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-kb-fg whitespace-nowrap">
                          {fmt(inv.invoice_total)}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-[5px] px-2 py-[3px] rounded text-[11px] font-semibold whitespace-nowrap ${st.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dotCls}`} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-xs text-kb-fg-3 whitespace-nowrap">
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
