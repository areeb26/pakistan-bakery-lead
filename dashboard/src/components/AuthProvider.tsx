/**
 * AuthProvider — runs the silent refresh on every app mount.
 * If a valid refresh cookie exists, it hydrates the access token and user
 * without forcing the user to log in again.
 */

import { useEffect, type ReactNode } from 'react'
import { authApi, tokenStore } from '../services/api'
import { useAppStore } from '../store'

interface AuthProviderProps { children: ReactNode }

export function AuthProvider({ children }: AuthProviderProps) {
  const { setAuth, clearAuth, setAuthLoading } = useAppStore()

  useEffect(() => {
    setAuthLoading(true)

    authApi
      .tryRestore()
      .then(({ data }) => {
        // Decode user id and email from the JWT payload
        try {
          const payload = JSON.parse(atob(data.access_token.split('.')[1]))
          // We only have sub (user id) in the token; fetch profile later if needed
          setAuth({ id: payload.sub, email: '', plan: 'free' })
        } catch {
          tokenStore.clear()
          clearAuth()
        }
      })
      .catch(() => {
        // No valid refresh cookie — user must log in
        clearAuth()
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
