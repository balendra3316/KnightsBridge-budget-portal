import LoginForm from '@/components/kbcbp/login-form'

// Single sign-in page for the whole app (creators and approvers alike). There
// is intentionally NO sign-up — accounts are created in the Supabase dashboard.
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-kb-bg flex items-center justify-center font-sans">
      <div className="w-[380px] bg-kb-surface rounded-2xl border border-kb-border px-8 py-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <div className="text-center mb-7">
          <div className="font-semibold text-lg tracking-tight mb-1">
            KBP<span className="text-kb-accent">CBP</span>
          </div>
          <div className="text-[13px] text-kb-fg-3">Sign in to continue</div>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
