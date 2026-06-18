import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, canApprove } from '@/lib/auth'
import AdminInvoiceTable, { LogoutButton } from '@/components/kbcbp/admin-invoice-table'

export default async function AdminDashboard() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  // Approvals dashboard is approver/admin-only; creators don't belong here.
  if (!canApprove(user.role)) redirect('/')

  const supabase = await createClient()

  const { data: pendingInvoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('status', 'review')
    .order('created_at', { ascending: false })

  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('*')
    .in('status', ['approved', 'rejected', 'sent'])
    .order('updated_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-kb-bg font-sans">
      {/* Admin header */}
      <div className="flex items-center gap-1 px-6 py-3 bg-kb-surface border-b border-kb-border sticky top-0 z-[100]">
        <div className="font-semibold text-sm tracking-tight mr-2">
          KBP<span className="text-kb-accent">CBP</span>
        </div>
        <span className="text-[10px] font-semibold tracking-wide text-white bg-kb-accent rounded px-1.5 py-0.5">
          APPROVALS
        </span>
        {/* Only admins also have the creator workspace; approvers stay here. */}
        {user.role === 'admin' && (
          <Link href="/" className="px-3 py-1 rounded-md text-[13px] font-medium text-kb-fg-2 no-underline ml-3">
            Budget Entry
          </Link>
        )}
        <div className="flex-1" />
        <span className="text-xs text-kb-fg-2 mr-3">
          {user.name}
        </span>
        <LogoutButton />
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-6 pb-20">
        {/* Pending approvals */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="text-[17px] font-semibold tracking-tight m-0">
              Pending Approval
            </h2>
            <span className="px-2.5 py-[3px] rounded-[10px] text-xs font-bold bg-kb-amber-light text-kb-amber">
              {pendingInvoices?.length ?? 0}
            </span>
          </div>

          {!pendingInvoices || pendingInvoices.length === 0 ? (
            <div className="py-10 px-5 text-center bg-kb-surface rounded-xl border border-kb-border">
              <div className="text-[13px] text-kb-fg-3">No invoices pending approval</div>
            </div>
          ) : (
            <AdminInvoiceTable invoices={pendingInvoices} showActions />
          )}
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight mb-3">
            Recent Activity
          </h2>
          {!recentInvoices || recentInvoices.length === 0 ? (
            <div className="py-10 px-5 text-center bg-kb-surface rounded-xl border border-kb-border">
              <div className="text-[13px] text-kb-fg-3">No recent activity</div>
            </div>
          ) : (
            <AdminInvoiceTable invoices={recentInvoices} />
          )}
        </div>
      </div>
    </div>
  )
}
