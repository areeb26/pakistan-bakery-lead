/**
 * Notion-style app shell.
 *
 * Structure:
 *   <div full-screen>
 *     <Sidebar fixed left />
 *     <main flex-1 />
 *   </div>
 *
 * Sidebar sections:
 *   - Workspace name + collapse toggle
 *   - Primary nav (Campaigns, Scrape)
 *   - Active scrapes widget (live badge)
 *   - Footer: user menu (plan badge, settings, logout)
 */

import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  Zap,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  LogOut,
  User,
  Settings,
  Activity,
  Loader2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAppStore } from '../store'
import { authApi, tokenStore } from '../services/api'

interface LayoutProps {
  children: ReactNode
}

// ── nav item ──────────────────────────────────────────────────────────────────

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string
  icon: React.ElementType
  label: string
  collapsed: boolean
}) {
  const { pathname } = useLocation()
  const active = pathname === to || pathname.startsWith(to + '/')

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius)] text-sm font-medium',
        'transition-colors duration-100 select-none',
        active
          ? 'bg-[var(--color-bg-selected)] text-[var(--color-text-h)]'
          : 'text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-h)]'
      )}
    >
      <Icon className="shrink-0 w-4 h-4" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

// ── active scrapes badge ──────────────────────────────────────────────────────

function ActivityWidget({ collapsed }: { collapsed: boolean }) {
  const { activeScrapeId } = useAppStore()
  if (!activeScrapeId) return null

  return (
    <div
      className={cn(
        'mx-2 mb-2 px-2.5 py-2 rounded-[var(--radius)] border border-[var(--color-border)]',
        'bg-[var(--color-bg-hover)] flex items-center gap-2 text-xs text-[var(--color-text)]'
      )}
    >
      <Loader2 className="w-3 h-3 animate-spin shrink-0 text-[var(--color-accent)]" />
      {!collapsed && <span className="truncate">Scrape running…</span>}
    </div>
  )
}

// ── user menu ─────────────────────────────────────────────────────────────────

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, clearAuth, isDarkMode, setIsDarkMode } = useAppStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleLogout() {
    try { await authApi.logout() } catch { /* ignore */ }
    tokenStore.clear()
    clearAuth()
    navigate('/login')
  }

  const planColors: Record<string, string> = {
    free:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    pro:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    business: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? (user?.email ?? 'Account') : undefined}
        className={cn(
          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius)]',
          'text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]',
          'transition-colors duration-100'
        )}
      >
        {/* Avatar */}
        <div className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-xs font-semibold uppercase">
          {user?.email?.[0] ?? <User className="w-3 h-3" />}
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0 text-left">
            <p className="truncate text-xs font-medium text-[var(--color-text-h)]">
              {user?.email ?? 'Account'}
            </p>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium capitalize',
                planColors[user?.plan ?? 'free']
              )}
            >
              {user?.plan ?? 'free'}
            </span>
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute bottom-full left-0 mb-1 w-52 z-50',
            'bg-[var(--color-bg)] border border-[var(--color-border)]',
            'rounded-[var(--radius)] shadow-lg py-1 text-sm'
          )}
        >
          <button
            onClick={() => { setIsDarkMode(!isDarkMode); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--color-bg-hover)] text-[var(--color-text)]"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDarkMode ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={() => { navigate('/settings'); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--color-bg-hover)] text-[var(--color-text)]"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <div className="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--color-bg-hover)] text-[var(--color-danger)]"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

// ── layout ────────────────────────────────────────────────────────────────────

export function Layout({ children }: LayoutProps) {
  const { isDarkMode, sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">

        {/* ── Sidebar ── */}
        <aside
          className={cn(
            'flex flex-col shrink-0 border-r border-[var(--color-border)]',
            'bg-[var(--color-bg-sidebar)] transition-[width] duration-200 overflow-hidden',
            sidebarCollapsed ? 'w-12' : 'w-[var(--sidebar-width)]'
          )}
        >
          {/* Header: workspace name + collapse toggle */}
          <div
            className={cn(
              'flex items-center h-11 px-2.5 border-b border-[var(--color-border)] shrink-0',
              sidebarCollapsed ? 'justify-center' : 'justify-between'
            )}
          >
            {!sidebarCollapsed && (
              <span className="text-sm font-semibold text-[var(--color-text-h)] truncate px-1">
                LeadScraper
              </span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] shrink-0"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed
                ? <ChevronRight className="w-4 h-4" />
                : <ChevronLeft className="w-4 h-4" />
              }
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {!sidebarCollapsed && (
              <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                Workspace
              </p>
            )}
            <NavItem to="/campaigns"   icon={LayoutGrid} label="Campaigns"   collapsed={sidebarCollapsed} />
            <NavItem to="/scrape"      icon={Zap}        label="New Scrape"  collapsed={sidebarCollapsed} />
            <NavItem to="/activity"    icon={Activity}   label="Activity"    collapsed={sidebarCollapsed} />
          </nav>

          {/* Active scrape indicator */}
          <ActivityWidget collapsed={sidebarCollapsed} />

          {/* Footer: user menu */}
          <div className="px-2 pb-3 pt-2 border-t border-[var(--color-border)] shrink-0">
            <UserMenu collapsed={sidebarCollapsed} />
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
