/**
 * Register page — Notion-style, minimal.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { authApi, tokenStore } from '../services/api'
import { useAppStore } from '../store'
import { cn } from '../lib/utils'

export function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAppStore()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      await authApi.register({ email, password })
      // Auto-login after registration
      const { data } = await authApi.login({ email, password })
      tokenStore.set(data.access_token)

      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      setAuth({ id: payload.sub, email, plan: 'free' })

      navigate('/campaigns', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (status === 409) {
        setError('An account with this email already exists')
      } else {
        setError(detail ?? 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-[var(--color-text-h)] tracking-tight">
            LeadScraper
          </span>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Create your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-h)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className={cn(
                'w-full px-3 py-2 rounded-[var(--radius)] border text-sm',
                'bg-[var(--color-bg)] text-[var(--color-text-h)]',
                'border-[var(--color-border)] focus:border-[var(--color-accent)]',
                'outline-none transition-colors placeholder:text-[var(--color-text-muted)]'
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-h)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              className={cn(
                'w-full px-3 py-2 rounded-[var(--radius)] border text-sm',
                'bg-[var(--color-bg)] text-[var(--color-text-h)]',
                'border-[var(--color-border)] focus:border-[var(--color-accent)]',
                'outline-none transition-colors placeholder:text-[var(--color-text-muted)]'
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-h)] mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className={cn(
                'w-full px-3 py-2 rounded-[var(--radius)] border text-sm',
                'bg-[var(--color-bg)] text-[var(--color-text-h)]',
                'border-[var(--color-border)] focus:border-[var(--color-accent)]',
                'outline-none transition-colors placeholder:text-[var(--color-text-muted)]'
              )}
            />
          </div>

          {error && (
            <p className="text-xs text-[var(--color-danger)] bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-[var(--radius)] border border-red-200 dark:border-red-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-2 px-4 rounded-[var(--radius)] text-sm font-medium',
              'bg-[var(--color-accent)] text-white',
              'hover:opacity-90 transition-opacity',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-accent)] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
