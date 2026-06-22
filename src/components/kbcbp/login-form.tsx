'use client'

import { useState, useTransition } from 'react'
import { login, loginWithGoogle } from '@/lib/auth-actions'

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-kb-border-strong text-sm font-sans outline-none bg-kb-bg'

export default function LoginForm({
  initialError = null,
}: {
  initialError?: string | null
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      // On success the action redirects, so we only ever see the error branch.
      const result = await login(email, password)
      if (result?.error) setError(result.error)
    })
  }

  const handleGoogle = () => {
    setError(null)
    startTransition(async () => {
      // On success this redirects to Google, so we only see the error branch.
      const result = await loginWithGoogle()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-xs font-semibold text-kb-fg-2 mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@knightbridge.com"
          required
          className={inputCls}
        />
      </div>
      <div className="mb-6">
        <label className="block text-xs font-semibold text-kb-fg-2 mb-1.5">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter password"
          required
          className={inputCls}
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md mb-4 bg-kb-red-light text-kb-red text-xs font-medium">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 rounded-lg border-none bg-kb-accent text-white text-sm font-semibold font-sans cursor-pointer disabled:opacity-70"
      >
        {isPending ? 'Signing in...' : 'Sign In'}
      </button>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-kb-border" />
        <span className="text-[11px] text-kb-fg-3 uppercase tracking-wide">or</span>
        <div className="h-px flex-1 bg-kb-border" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isPending}
        className="w-full py-2.5 rounded-lg border border-kb-border-strong bg-kb-surface text-sm font-semibold font-sans cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-70"
      >
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        Continue with Google
      </button>
    </form>
  )
}
