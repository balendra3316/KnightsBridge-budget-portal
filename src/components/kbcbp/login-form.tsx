'use client'

import { useState, useTransition } from 'react'
import { login } from '@/lib/auth-actions'

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-kb-border-strong text-sm font-sans outline-none bg-kb-bg'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
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
    </form>
  )
}
