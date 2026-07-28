/**
 * Zustand store — auth state + campaign filters + UI preferences.
 * Access token lives in-memory only (never persisted).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  plan: string
}

interface AuthSlice {
  user: AuthUser | null
  isAuthenticated: boolean
  isAuthLoading: boolean          // true while the silent refresh on mount is running

  setAuth: (user: AuthUser) => void
  clearAuth: () => void
  setAuthLoading: (loading: boolean) => void
}

// ── campaign filters ──────────────────────────────────────────────────────────

export interface CampaignFilterState {
  searchTerm: string
  hasPhone: boolean
  hasWebsite: boolean
  page: number
}

const DEFAULT_FILTERS: CampaignFilterState = {
  searchTerm: '',
  hasPhone: false,
  hasWebsite: false,
  page: 0,
}

interface CampaignSlice {
  currentCampaignId: string | null
  setCurrentCampaignId: (id: string | null) => void

  campaignFilters: Record<string, CampaignFilterState>
  getCampaignFilters: (id: string) => CampaignFilterState
  setCampaignFilters: (id: string, filters: CampaignFilterState) => void
  updateCampaignFilter: (id: string, key: keyof CampaignFilterState, value: unknown) => void
}

// ── scrape / activity ─────────────────────────────────────────────────────────

interface ScrapeSlice {
  activeScrapeId: string | null
  setActiveScrapeId: (id: string | null) => void

  compareScrapeId1: string | null
  compareScrapeId2: string | null
  setCompareScrapes: (id1: string | null, id2: string | null) => void
}

// ── ui prefs (persisted) ──────────────────────────────────────────────────────

interface UISlice {
  isDarkMode: boolean
  setIsDarkMode: (dark: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
}

// ── combined store ────────────────────────────────────────────────────────────

export type AppStore = AuthSlice & CampaignSlice & ScrapeSlice & UISlice

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── auth (NOT persisted — see partialize below) ──
      user: null,
      isAuthenticated: false,
      isAuthLoading: true,
      setAuth: (user) => set({ user, isAuthenticated: true, isAuthLoading: false }),
      clearAuth: () => set({ user: null, isAuthenticated: false, isAuthLoading: false }),
      setAuthLoading: (loading) => set({ isAuthLoading: loading }),

      // ── campaigns ──
      currentCampaignId: null,
      setCurrentCampaignId: (id) => set({ currentCampaignId: id }),

      campaignFilters: {},
      getCampaignFilters: (id) => get().campaignFilters[id] ?? { ...DEFAULT_FILTERS },
      setCampaignFilters: (id, filters) =>
        set((s) => ({ campaignFilters: { ...s.campaignFilters, [id]: filters } })),
      updateCampaignFilter: (id, key, value) => {
        const current = get().getCampaignFilters(id)
        set((s) => ({
          campaignFilters: {
            ...s.campaignFilters,
            [id]: { ...current, [key]: value },
          },
        }))
      },

      // ── scrape / activity ──
      activeScrapeId: null,
      setActiveScrapeId: (id) => set({ activeScrapeId: id }),
      compareScrapeId1: null,
      compareScrapeId2: null,
      setCompareScrapes: (id1, id2) => set({ compareScrapeId1: id1, compareScrapeId2: id2 }),

      // ── ui prefs ──
      isDarkMode: false,
      setIsDarkMode: (dark) => set({ isDarkMode: dark }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    {
      name: 'app-store',
      // Only persist UI prefs and campaign filters — never auth state
      partialize: (s) => ({
        isDarkMode: s.isDarkMode,
        sidebarCollapsed: s.sidebarCollapsed,
        currentCampaignId: s.currentCampaignId,
        campaignFilters: s.campaignFilters,
      }),
    }
  )
)
