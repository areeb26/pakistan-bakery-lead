/**
 * API client — auth-aware, with access-token injection and silent refresh.
 */

import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,          // send the httpOnly refresh cookie automatically
})

// ── token store (in-memory only, never localStorage) ─────────────────────────
let _accessToken: string | null = null

export const tokenStore = {
  get: () => _accessToken,
  set: (t: string | null) => { _accessToken = t },
  clear: () => { _accessToken = null },
}

// ── request interceptor: attach Bearer token ─────────────────────────────────
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${_accessToken}`
  }
  return config
})

// ── response interceptor: silent token refresh on 401 ────────────────────────
let _refreshing = false
let _refreshQueue: Array<(token: string | null) => void> = []

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retried?: boolean }

    // Only retry 401s once, and never retry the refresh call itself
    if (error.response?.status !== 401 || original._retried || original.url?.includes('/auth/refresh')) {
      return Promise.reject(error)
    }

    original._retried = true

    if (_refreshing) {
      // Queue this request until the ongoing refresh resolves
      return new Promise((resolve, reject) => {
        _refreshQueue.push((newToken) => {
          if (newToken) {
            original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
            resolve(api(original))
          } else {
            reject(error)
          }
        })
      })
    }

    _refreshing = true

    try {
      const { data } = await api.post<{ access_token: string }>('/auth/refresh')
      tokenStore.set(data.access_token)

      _refreshQueue.forEach((cb) => cb(data.access_token))
      _refreshQueue = []

      original.headers = { ...original.headers, Authorization: `Bearer ${data.access_token}` }
      return api(original)
    } catch (refreshErr) {
      tokenStore.clear()
      _refreshQueue.forEach((cb) => cb(null))
      _refreshQueue = []
      // Redirect to login if we can't refresh
      window.location.href = '/login'
      return Promise.reject(refreshErr)
    } finally {
      _refreshing = false
    }
  }
)

// ==================== AUTH ====================

export interface RegisterRequest { email: string; password: string }
export interface LoginRequest    { email: string; password: string }
export interface TokenResponse   { access_token: string; token_type: string }
export interface UserResponse    { id: string; email: string; plan: string; created_at: string }

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<UserResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<TokenResponse>('/auth/login', data),

  refresh: () =>
    api.post<TokenResponse>('/auth/refresh'),

  logout: () =>
    api.post('/auth/logout'),

  /** Try to restore the session silently on app load */
  tryRestore: () =>
    api.post<TokenResponse>('/auth/refresh').then((r) => {
      tokenStore.set(r.data.access_token)
      return r
    }),
}

// ==================== CAMPAIGNS (was projects) ====================

/** Normalise backend's `_id` → `id` so the rest of the frontend uses `campaign.id` */
function normaliseCampaign(raw: unknown): Campaign {
  const r = raw as Record<string, unknown>
  return { ...r, id: (r._id ?? r.id) as string } as Campaign
}

export interface CampaignSummary {
  total_leads: number
  scrape_count: number
  avg_rating: number | null
  leads_with_phone: number
  leads_with_website: number
  date_range: {
    first_scrape: string | null
    last_scrape: string | null
  }
}

export interface Campaign {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
  summary: CampaignSummary
  last_scrape_id: string | null
  is_scheduled: boolean
  schedule?: {
    cron_expression: string
    enabled: boolean
    last_run: string | null
    next_run: string | null
  }
}

export interface CreateCampaignRequest { name: string; description?: string }
export interface UpdateCampaignRequest {
  name?: string
  description?: string
  schedule?: { cron_expression: string; enabled: boolean }
}

export const campaignsApi = {
  create: (data: CreateCampaignRequest) =>
    api.post<Campaign>('/campaigns', data)
      .then((r) => ({ ...r, data: normaliseCampaign(r.data) })),
  list: () =>
    api.get<{ campaigns: Campaign[] }>('/campaigns')
      .then((r) => ({ ...r, data: { campaigns: r.data.campaigns.map(normaliseCampaign) } })),
  get: (id: string) =>
    api.get<Campaign>(`/campaigns/${id}`)
      .then((r) => ({ ...r, data: normaliseCampaign(r.data) })),
  update: (id: string, data: UpdateCampaignRequest) =>
    api.put<Campaign>(`/campaigns/${id}`, data)
      .then((r) => ({ ...r, data: normaliseCampaign(r.data) })),
  delete: (id: string) =>
    api.delete(`/campaigns/${id}`),
}

// ==================== SCRAPING ====================

export interface ScrapeRequest {
  campaign_id: string
  query: string
  limit?: number
  headless?: boolean
}

export interface ScrapeResponse {
  scrape_id: string
  campaign_id: string
  status: string
  created_at: string
}

export interface ScrapeProgress {
  scrape_id: string
  status: string
  progress_percent: number
  leads_collected: number
  current_query: string
  started_at: string
  estimated_completion: string | null
}

export interface Lead {
  lead_id: string
  type: string
  business_name: string
  category: string
  address: string
  phone: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  plus_code: string | null
  hours: string | null
  gmaps_url: string
  search_query: string
  scraped_at: string
}

export interface LeadsPage {
  leads: Lead[]
  total: number
  page: number
  has_more: boolean
}

export interface ScrapeHistoryItem {
  _id: string
  query: string
  leads_count: number
  scraped_at: string
  status: string
}

export const scrapeApi = {
  start: (campaignId: string, query: string, limit = 50, headless = true) =>
    api.post<ScrapeResponse>('/scrapes', { campaign_id: campaignId, query, limit, headless }),

  progress: (scrapeId: string) =>
    api.get<ScrapeProgress>(`/scrapes/${scrapeId}/progress`),

  history: (campaignId: string, skip = 0, limit = 10) =>
    api.get<{ scrapes: ScrapeHistoryItem[]; total: number }>(
      `/campaigns/${campaignId}/scrapes`,
      { params: { skip, limit } }
    ),
}

// ==================== LEADS ====================

export const leadsApi = {
  page: (scrapeId: string, page = 0, limit = 50) =>
    api.get<LeadsPage>(`/scrapes/${scrapeId}/leads`, { params: { page, limit } }),

  search: (scrapeId: string, searchTerm: string, page = 0, limit = 50) =>
    api.get<LeadsPage>(`/scrapes/${scrapeId}/leads`, {
      params: { search: searchTerm, page, limit },
    }),
}

// ==================== DIFF ====================

export interface DiffLead {
  lead_id: string
  business_name: string
  address: string
  change_type: 'new' | 'deleted' | 'updated'
  changes?: Record<string, { old: unknown; new: unknown }>
}

export interface DiffResult {
  new_leads: DiffLead[]
  deleted_leads: DiffLead[]
  updated_leads: DiffLead[]
  stats: { added: number; deleted: number; updated: number; total_change: number }
}

export const diffApi = {
  compute: (scrapeId1: string, scrapeId2: string) =>
    api.post<DiffResult>(`/scrapes/${scrapeId1}/diff/${scrapeId2}`),
}

// ==================== EXPORT ====================

export const exportApi = {
  json: (scrapeId: string) =>
    api.get(`/scrapes/${scrapeId}/export?format=json`, { responseType: 'blob' }),
  csv: (scrapeId: string) =>
    api.get(`/scrapes/${scrapeId}/export?format=csv`, { responseType: 'blob' }),
}

// ==================== SCHEDULE ====================

export const scheduleApi = {
  update: (campaignId: string, enabled: boolean, cronExpression: string) =>
    api.put(`/campaigns/${campaignId}/schedule`, { enabled, cron_expression: cronExpression }),
  get: (campaignId: string) =>
    api.get(`/campaigns/${campaignId}/schedule`),
}

export default api
