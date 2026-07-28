/**
 * ProtectedRoute — redirects to /login if not authenticated.
 * Saves the intended path so we can redirect back after login.
 * Shows nothing while the silent refresh is still in flight.
 */

import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAppStore } from '../store'

interface ProtectedRouteProps { children: ReactNode }

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isAuthLoading } = useAppStore()
  const location = useLocation()

  // Still checking the refresh cookie — render nothing to avoid flash
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
