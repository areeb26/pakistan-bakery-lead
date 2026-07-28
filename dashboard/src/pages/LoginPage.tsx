/**
 * Login page — Notion-style, minimal.
 */

import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { authApi, tokenStore } from '../services/api'
import { useAppStore } from '../store'
import { cn } from '../lib/utils'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAppStore()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  // Where to go after login — default to /campaigns
  const from = (location.state as { from?: string })?.from ?? '/campaigns'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await authApi.login({ email, password })
      tokenStore.set(data.access_token)

      // Decode user from token payload (base64 middle segment)
      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      setAuth({ id: payload.sub, email, plan: 'free' })

      navigate(from, { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-[var(--color-text-h)] tracking-tight">
            LeadScraper
          </span>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
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

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-h)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          {/* Error */}
          {error && (
            <p className="text-xs text-[var(--color-danger)] bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-[var(--radius)] border border-red-200 dark:border-red-900">
              {error}
            </p>
          )}

          {/* Submit */}
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
            {loading ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="text-[var(--color-accent)] hover:underline font-medium"
          >
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}
