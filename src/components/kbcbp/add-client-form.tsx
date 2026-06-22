'use client'

import { useState, useTransition } from 'react'
import { addClient } from '@/app/(main)/clients/actions'

// Region + commission options mirror the Budget Entry filters / rate dropdown so
// new clients line up with what the rest of the app expects.
const REGIONS = ['New York', 'Texas', 'California', 'Florida']
const RATES = [
  { value: 15, label: '15%' },
  { value: 12.5, label: '12.5%' },
  { value: 10, label: '10%' },
  { value: 0, label: '0%' },
]
const PATTERNS = ['A', 'B', 'C']

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-kb-border-strong text-sm font-sans outline-none bg-kb-bg'
const labelCls = 'block text-xs font-semibold text-kb-fg-2 mb-1.5'

export default function AddClientForm() {
  const [name, setName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [parentGroup, setParentGroup] = useState('')
  const [region, setRegion] = useState(REGIONS[0])
  const [team, setTeam] = useState('')
  const [commissionRate, setCommissionRate] = useState(15)
  const [billingPattern, setBillingPattern] = useState('A')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await addClient({
        name,
        project_name: projectName,
        parent_group: parentGroup,
        region,
        team,
        commission_rate: commissionRate,
        billing_pattern: billingPattern,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      // revalidatePath in the action refreshes the list below; clear the form so
      // the admin can add another client right away.
      setSuccess(`Added "${name.trim()}"`)
      setName('')
      setProjectName('')
      setParentGroup('')
      setTeam('')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-kb-surface rounded-xl border border-kb-border p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Client name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ONE WALL STREET"
            required
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Project name</label>
          <input
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="Optional"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Parent group</label>
          <input
            value={parentGroup}
            onChange={e => setParentGroup(e.target.value)}
            placeholder="e.g. Extell"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Region</label>
          <select value={region} onChange={e => setRegion(e.target.value)} className={inputCls}>
            {REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Team / PM</label>
          <input
            value={team}
            onChange={e => setTeam(e.target.value)}
            placeholder="e.g. Jordan / James"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Commission rate</label>
          <select
            value={commissionRate}
            onChange={e => setCommissionRate(Number(e.target.value))}
            className={inputCls}
          >
            {RATES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Billing pattern</label>
          <select
            value={billingPattern}
            onChange={e => setBillingPattern(e.target.value)}
            className={inputCls}
          >
            {PATTERNS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md mt-4 bg-kb-red-light text-kb-red text-xs font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-md mt-4 bg-kb-accent-light text-kb-accent-text text-xs font-medium">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 px-4 py-2.5 rounded-lg border-none bg-kb-accent text-white text-sm font-semibold font-sans cursor-pointer disabled:opacity-70"
      >
        {isPending ? 'Adding…' : 'Add Client'}
      </button>
    </form>
  )
}
