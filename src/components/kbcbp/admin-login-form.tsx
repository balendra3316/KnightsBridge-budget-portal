'use client'

import { useState, useTransition } from 'react'
import { adminLogin } from '@/app/admin/actions'

export default function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await adminLogin(email, password)
      if (result?.error) setError(result.error)
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid #D3D1C7', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', background: '#FAF9F7', boxSizing: 'border-box',
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6A65', marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="admin@knightbridge.com"
          required
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6A65', marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter password"
          required
          style={inputStyle}
        />
      </div>

      {error && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 16,
          background: '#FCEBEB', color: '#A32D2D', fontSize: 12, fontWeight: 500,
        }}>{error}</div>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
          background: '#534AB7', color: 'white', fontSize: 14,
          fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? 'Signing in...' : 'Sign In'}
      </button>

      <div style={{
        marginTop: 20, padding: '10px 12px', borderRadius: 6,
        background: '#F5F4F1', border: '1px solid #E8E6E1',
        fontSize: 11, color: '#9C9A92', textAlign: 'center',
      }}>
        Demo: admin@knightbridge.com / admin123
      </div>
    </form>
  )
}
