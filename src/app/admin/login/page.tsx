import { getAdmin } from '../actions'
import { redirect } from 'next/navigation'
import AdminLoginForm from '@/components/kbcbp/admin-login-form'

export default async function AdminLoginPage() {
  const admin = await getAdmin()
  if (admin) redirect('/admin')

  return (
    <div className="min-h-screen bg-kb-bg flex items-center justify-center font-sans">
      <div className="w-[380px] bg-kb-surface rounded-2xl border border-kb-border px-8 py-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <div className="text-center mb-7">
          <div className="font-semibold text-lg tracking-tight mb-1">
            KB<span className="text-kb-accent">CBP</span>
            <span className="text-[10px] font-semibold tracking-wide text-white bg-kb-accent rounded px-1.5 py-0.5 ml-2 align-middle">
              ADMIN
            </span>
          </div>
          <div className="text-[13px] text-kb-fg-3">Sign in to manage invoices</div>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  )
}
