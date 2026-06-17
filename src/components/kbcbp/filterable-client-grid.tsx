'use client'

import { useState } from 'react'
import BudgetGrid from './budget-grid'

type Client = {
  id: string; name: string; project_name: string | null; parent_group: string | null
  region: string | null; tags: string[] | null; team: string | null
  commission_rate: number; billing_pattern: string; notes: string[] | null
  sort_order: number
}
type Service = {
  id: string; client_id: string; service_name: string; service_type: string
  credit_card: string; parent_service_id: string | null; sort_order: number
}
type BudgetEntry = { client_id: string; service_id: string; billing_month: string; amount: number }
type InvoiceInfo = {
  id: string; invoice_number: string; status: string; billing_month: string; client_id: string
  commission_amount: number | null; invoice_total: number | null; monthly_total: number | null
}

type Props = {
  clients: Client[]
  services: Service[]
  entries: BudgetEntry[]
  invoices: InvoiceInfo[]
  months: string[]
}

const TEAMS   = ['All', 'Jordan', 'Andy', 'Bailey', 'James']
const REGIONS = ['All', 'New York', 'Texas', 'California', 'Florida']
const STATUSES = ['All', 'Pending', 'Approved']

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-2xl text-xs font-medium border cursor-pointer font-sans transition-colors duration-150 ${
        active
          ? 'bg-kb-accent-light border-kb-accent text-kb-accent-text'
          : 'bg-kb-surface border-kb-border text-kb-fg-2 hover:border-kb-border-strong hover:bg-kb-surface-alt'
      }`}>
      {label}
    </button>
  )
}

export default function FilterableClientGrid({ clients, services, entries, invoices, months }: Props) {
  const [team, setTeam] = useState('All')
  const [region, setRegion] = useState('All')
  const [status, setStatus] = useState('All')

  const filtered = clients.filter(c => {
    if (team !== 'All' && !(c.team ?? '').toLowerCase().includes(team.toLowerCase())) return false
    if (region !== 'All' && c.region !== region) return false
    if (status !== 'All') {
      const hasApproved = invoices.some(i => i.client_id === c.id && (i.status === 'approved' || i.status === 'sent'))
      if (status === 'Approved' && !hasApproved) return false
      if (status === 'Pending' && hasApproved) return false
    }
    return true
  })

  const grouped: { group: string | null; items: Client[] }[] = []
  const seen = new Set<string>()
  for (const c of filtered) {
    const g = c.parent_group
    if (g && !seen.has(g)) {
      seen.add(g)
      grouped.push({ group: g, items: filtered.filter(x => x.parent_group === g) })
    } else if (!g) {
      grouped.push({ group: null, items: [c] })
    }
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-kb-surface border-b border-kb-border text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-kb-fg-3 uppercase tracking-wider font-medium mr-1">Team</span>
          {TEAMS.map(t => (
            <Chip key={t} label={t} active={team === t} onClick={() => setTeam(t)} />
          ))}
        </div>
        <span className="w-px h-5 bg-kb-border mx-2" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-kb-fg-3 uppercase tracking-wider font-medium mr-1">Region</span>
          {REGIONS.map(r => (
            <Chip key={r} label={r} active={region === r} onClick={() => setRegion(r)} />
          ))}
        </div>
        <span className="w-px h-5 bg-kb-border mx-2" />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-kb-fg-3 uppercase tracking-wider font-medium mr-1">Status</span>
          {STATUSES.map(s => (
            <Chip key={s} label={s} active={status === s} onClick={() => setStatus(s)} />
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-6 py-2 text-xs bg-kb-surface-alt border-b border-kb-border text-kb-fg-2">
        <span className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-green-dot" />
          {filtered.filter(c => invoices.some(i => i.client_id === c.id)).length} of {filtered.length} clients entered
        </span>
        <span className="w-px h-4 inline-block bg-kb-border" />
        <span className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-amber-dot" />
          {filtered.filter(c => !invoices.some(i => i.client_id === c.id)).length} pending entry
        </span>
        <div className="flex-1" />
        <span className="text-[11px] px-2.5 py-0.5 rounded font-medium text-kb-accent-text bg-kb-accent-light">
          Click a month column to edit
        </span>
      </div>

      {/* Client grids */}
      <div className="max-w-[1400px] mx-auto px-6 py-5 pb-20">
        {filtered.length === 0 ? (
          <div className="py-16 text-center bg-kb-surface rounded-xl border border-kb-border">
            <div className="text-[15px] font-semibold mb-1.5">No clients match filters</div>
            <div className="text-[13px] text-kb-fg-3">Try adjusting the team, region, or status filters above.</div>
          </div>
        ) : (
          grouped.map((g, gi) => (
            <div key={gi}>
              {g.group && (
                <div className="flex items-center gap-2.5 pt-2.5 pb-1.5 mt-3 mb-1">
                  <div className="text-[17px] font-semibold tracking-tight">{g.group}</div>
                  <div className="text-[11px] text-kb-fg-3">{g.items.length} projects</div>
                </div>
              )}
              {g.items.map(client => (
                <BudgetGrid
                  key={client.id}
                  client={client}
                  services={services.filter(s => s.client_id === client.id)}
                  entries={entries.filter(e => e.client_id === client.id)}
                  months={months}
                  invoices={invoices.filter(i => i.client_id === client.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  )
}
