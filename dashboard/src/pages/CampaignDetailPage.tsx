/**
 * Campaign detail page — leads table, scrape controls, pagination, search.
 * Notion-style: minimal chrome, table-first layout.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Search, Play, History, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Layout, ProgressBar } from '../components'
import { campaignsApi, scrapeApi, leadsApi, exportApi } from '../services'
import type { Lead } from '../services'
import { useAppStore } from '../store'
import { downloadFile } from '../utils/export'
import { cn } from '../lib/utils'

export function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const { setCurrentCampaignId, getCampaignFilters, updateCampaignFilter } = useAppStore()

  const [campaign, setCampaign]             = useState<any>(null)
  const [leads, setLeads]                   = useState<Lead[]>([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [page, setPage]                     = useState(0)
  const [hasMore, setHasMore]               = useState(false)
  const [totalLeads, setTotalLeads]         = useState(0)
  const [currentScrapeId, setCurrentScrapeId] = useState<string | null>(null)

  // scrape controls
  const [scrapeQuery, setScrapeQuery]       = useState('')
  const [scrapeLimit, setScrapeLimit]       = useState(50)
  const [scrapeStatus, setScrapeStatus]     = useState<'idle' | 'running'>('idle')
  const [scrapeProgress, setScrapeProgress] = useState(0)
  const [scrapeLeadsCount, setScrapeLeadsCount] = useState(0)

  // search
  const filters    = getCampaignFilters(campaignId ?? '')
  const [search, setSearch] = useState(filters.searchTerm)

  useEffect(() => {
    if (!campaignId) return
    setCurrentCampaignId(campaignId)
    loadCampaign()
  }, [campaignId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCampaign() {
    try {
      setLoading(true)
      const { data } = await campaignsApi.get(campaignId!)
      setCampaign(data)
      setCurrentScrapeId(data.last_scrape_id)
      if (data.last_scrape_id) loadLeads(data.last_scrape_id, 0)
    } catch {
      setError('Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }

  async function loadLeads(scrapeId: string, pageNum: number) {
    try {
      const { data } = search.trim()
        ? await leadsApi.search(scrapeId, search, pageNum, 50)
        : await leadsApi.page(scrapeId, pageNum, 50)
      setLeads(data.leads)
      setTotalLeads(data.total)
      setHasMore(data.has_more)
      setPage(pageNum)
    } catch {
      setError('Failed to load leads')
    }
  }

  async function handleStartScrape() {
    if (!scrapeQuery.trim()) return
    try {
      setScrapeStatus('running')
      setScrapeProgress(0)
      const { data } = await scrapeApi.start(campaignId!, scrapeQuery, scrapeLimit)
      setCurrentScrapeId(data.scrape_id)
      useAppStore.getState().setActiveScrapeId(data.scrape_id)

      const poll = setInterval(async () => {
        try {
          const { data: prog } = await scrapeApi.progress(data.scrape_id)
          setScrapeProgress(prog.progress_percent)
          setScrapeLeadsCount(prog.leads_collected)
          if (prog.status === 'completed' || prog.status === 'failed') {
            clearInterval(poll)
            setScrapeStatus('idle')
            useAppStore.getState().setActiveScrapeId(null)
            await loadCampaign()
            if (prog.status === 'completed') loadLeads(data.scrape_id, 0)
          }
        } catch { /* ignore poll errors */ }
      }, 1000)
    } catch {
      setError('Failed to start scrape')
      setScrapeStatus('idle')
    }
  }

  async function handleExport(format: 'json' | 'csv') {
    if (!currentScrapeId) return
    try {
      const { data } = format === 'json'
        ? await exportApi.json(currentScrapeId)
        : await exportApi.csv(currentScrapeId)
      downloadFile(data, `leads_${currentScrapeId}.${format}`)
    } catch {
      setError('Export failed')
    }
  }

  // ── render ──

  if (!campaignId) return null

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Link to="/campaigns" className="hover:text-[var(--color-text-h)] transition-colors">
            Campaigns
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-h)]">{campaign?.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-h)]">{campaign?.name}</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {totalLeads.toLocaleString()} leads · {campaign?.summary.scrape_count} scrapes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/campaigns/${campaignId}/history`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <History className="w-3.5 h-3.5" /> History
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={!currentScrapeId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={!currentScrapeId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-danger)] px-3 py-2 rounded-[var(--radius)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
            {error}
          </p>
        )}

        {/* Scrape controls */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Play className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-text-h)]">New Scrape</span>
          </div>

          {scrapeStatus === 'running' ? (
            <ProgressBar
              percent={scrapeProgress}
              leadsCollected={scrapeLeadsCount}
              currentQuery={scrapeQuery}
            />
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={scrapeQuery}
                onChange={(e) => setScrapeQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartScrape()}
                placeholder="e.g. bakeries in Karachi"
                className={cn(
                  'flex-1 px-3 py-2 rounded-[var(--radius)] border text-sm',
                  'bg-[var(--color-bg)] border-[var(--color-border)]',
                  'focus:border-[var(--color-accent)] outline-none transition-colors',
                  'placeholder:text-[var(--color-text-muted)]'
                )}
              />
              <input
                type="number"
                value={scrapeLimit}
                onChange={(e) => setScrapeLimit(parseInt(e.target.value) || 50)}
                min={1} max={1000}
                className={cn(
                  'w-20 px-3 py-2 rounded-[var(--radius)] border text-sm text-center',
                  'bg-[var(--color-bg)] border-[var(--color-border)]',
                  'focus:border-[var(--color-accent)] outline-none transition-colors'
                )}
              />
              <button
                onClick={handleStartScrape}
                disabled={!scrapeQuery.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius)] text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Play className="w-3.5 h-3.5" /> Scrape
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border',
          'border-[var(--color-border)] bg-[var(--color-bg)]'
        )}>
          <Search className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              updateCampaignFilter(campaignId!, 'searchTerm', e.target.value)
              if (currentScrapeId) loadLeads(currentScrapeId, 0)
            }}
            placeholder="Search leads…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {/* Leads table */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-sidebar)]">
                  {['Business', 'Category', 'Phone', 'Rating', 'Website'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[var(--color-text-muted)] text-sm">
                      {currentScrapeId ? 'No leads match your search' : 'Run a scrape to collect leads'}
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.lead_id} className="bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] transition-colors">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium text-[var(--color-text-h)] truncate max-w-48">
                            {lead.business_name}
                          </p>
                          {lead.address && (
                            <p className="text-xs text-[var(--color-text-muted)] truncate max-w-48">
                              {lead.address}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-muted)] truncate max-w-32">
                        {lead.category ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text)] whitespace-nowrap">
                        {lead.phone ?? <span className="text-[var(--color-text-muted)]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {lead.rating
                          ? <span className="text-amber-600 dark:text-amber-400">{lead.rating}★</span>
                          : <span className="text-[var(--color-text-muted)]">—</span>
                        }
                      </td>
                      <td className="px-4 py-2.5">
                        {lead.website
                          ? <a href={lead.website} target="_blank" rel="noopener noreferrer"
                              className="text-[var(--color-accent)] hover:underline truncate max-w-36 block text-xs">
                              {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                            </a>
                          : <span className="text-[var(--color-text-muted)]">—</span>
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(page > 0 || hasMore) && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)] text-xs text-[var(--color-text-muted)]">
              <span>{totalLeads.toLocaleString()} total leads</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => currentScrapeId && loadLeads(currentScrapeId, page - 1)}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-[var(--color-bg-hover)] disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2">Page {page + 1}</span>
                <button
                  onClick={() => currentScrapeId && loadLeads(currentScrapeId, page + 1)}
                  disabled={!hasMore}
                  className="p-1 rounded hover:bg-[var(--color-bg-hover)] disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
