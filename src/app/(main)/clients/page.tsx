import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, canManageClients } from '@/lib/auth'
import AddClientForm from '@/components/kbcbp/add-client-form'

// Admin-only client management. For now it's just "add a client" plus a read-only
// list of what already exists; edit/delete come later. The (main) layout already
// bounces approvers to /admin and gates auth — this guard keeps creators out too.
export default async function ClientsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!canManageClients(user.role)) redirect('/')

  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, project_name, region, team, commission_rate')
    .order('sort_order')

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6 pb-20">
      <h1 className="text-[20px] font-semibold tracking-tight mb-1">Clients</h1>
      <p className="text-[13px] text-kb-fg-3 mb-6">
        Add a new client. They&apos;ll appear in Budget Entry right away.
      </p>

      <div className="mb-8">
        <h2 className="text-[15px] font-semibold tracking-tight mb-3">Add a client</h2>
        <AddClientForm />
      </div>

      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <h2 className="text-[15px] font-semibold tracking-tight m-0">Existing clients</h2>
          <span className="px-2.5 py-[3px] rounded-[10px] text-xs font-bold bg-kb-accent-light text-kb-accent-text">
            {clients?.length ?? 0}
          </span>
        </div>

        {!clients || clients.length === 0 ? (
          <div className="py-10 px-5 text-center bg-kb-surface rounded-xl border border-kb-border">
            <div className="text-[13px] text-kb-fg-3">No clients yet — add one above.</div>
          </div>
        ) : (
          <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-kb-fg-3 border-b border-kb-border">
                  <th className="font-medium px-4 py-2.5">Name</th>
                  <th className="font-medium px-4 py-2.5">Region</th>
                  <th className="font-medium px-4 py-2.5">Team</th>
                  <th className="font-medium px-4 py-2.5 text-right">Commission</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-b border-kb-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">
                      {c.name}
                      {c.project_name && (
                        <span className="text-kb-fg-3 font-normal"> / {c.project_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-kb-fg-2">{c.region ?? '—'}</td>
                    <td className="px-4 py-2.5 text-kb-fg-2">{c.team ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-kb-fg-2">
                      {(Number(c.commission_rate) || 0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
