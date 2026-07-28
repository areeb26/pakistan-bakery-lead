/**
 * Scrape page — select a campaign and start a Google Maps scrape.
 * Notion-style layout wrapped in Layout shell.
 */

import { useState, useEffect } from 'react'
import { Search, Loader2, CheckCircle, AlertCircle, Zap, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { campaignsApi, scrapeApi, type Campaign } from '../services'
import { useAppStore } from '../store'
import { Layout } from '../components'
import { cn } from '../lib/utils'

const QUERY_PRESETS = [
  { label: 'Bakeries · Karachi',    query: 'bakeries in Karachi' },
  { label: 'Restaurants · Karachi', query: 'restaurants in Karachi' },
  { label: 'Bakeries · Lahore',     query: 'bakeries in Lahore' },
  { label: 'Restaurants · Lahore',  query: 'restaurants in Lahore' },
  { label: 'Bakeries · Islamabad',  query: 'bakeries in Islamabad' },
  { label: 'Travel Agencies PK',    query: 'travel agency Pakistan' },
  { label: 'Hajj / Umrah Operators',query: 'hajj umrah travel agency Pakistan' },
]

export default function ScrapePage() {
  const navigate = useNavigate()
  const { currentCampaignId, setCurrentCampaignId } = useAppStore()

  const [campaigns, setCampaigns]                 = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [campaignsLoading, setCampaignsLoading]   = useState(true)
  const [query, setQuery]                         = useState('')
  const [limit, setLimit]                         = useState(50)
  const [headless, setHeadless]                   = useState(true)
  const [status, setStatus]                       = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage]                     = useState('')
  const [scrapeId, setScrapeId]                   = useState<string | null>(null)
  const [progress, setProgress]                   = useState(0)
  const [showCreate, setShowCreate]               = useState(false)
  const [newName, setNewName]                     = useState('')

  useEffect(() => { loadCampaigns() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentCampaignId && !selectedCampaignId) setSelectedCampaignId(currentCampaignId)
  }, [currentCampaignId, selectedCampaignId])

  // Poll progress while scraping
  useEffect(() => {
    if (status !== 'running' || !scrapeId) return
    const interval = setInterval(async () => {
      try {
        const { data } = await scrapeApi.progress(scrapeId)
        setProgress(data.progress_percent)
        if (data.status === 'completed') {
          setStatus('success')
          setMessage(`Done — ${data.leads_collected} leads collected`)
          setProgress(100)
          clearInterval(interval)
          useAppStore.getState().setActiveScrapeId(null)
        } else if (data.status === 'failed') {
          setStatus('error')
          setMessage('Scraping failed')
          clearInterval(interval)
          useAppStore.getState().setActiveScrapeId(null)
        }
      } catch { /* ignore transient errors */ }
    }, 2000)
    return () => clearInterval(interval)
  }, [status, scrapeId])

  async function loadCampaigns() {
    try {
      setCampaignsLoading(true)
      const { data } = await campaignsApi.list()
      setCampaigns(data.campaigns)
      if (data.campaigns.length > 0 && !selectedCampaignId) {
        const def = currentCampaignId
          ? data.campaigns.find((c) => c.id === currentCampaignId) ?? data.campaigns[0]
          : data.campaigns[0]
        setSelectedCampaignId(def.id)
        setCurrentCampaignId(def.id)
      }
    } catch { /* handled by empty state */ }
    finally { setCampaignsLoading(false) }
  }

  async function handleCreateCampaign() {
    if (!newName.trim()) return
    try {
      const { data } = await campaignsApi.create({ name: newName })
      setCampaigns([data, ...campaigns])
      setSelectedCampaignId(data.id)
      setCurrentCampaignId(data.id)
      setNewName('')
      setShowCreate(false)
    } catch { /* ignore */ }
  }

  async function handleScrape() {
    if (!selectedCampaignId) { setMessage('Select a campaign first'); setStatus('error'); return }
    if (!query.trim())        { setMessage('Enter a search query');     setStatus('error'); return }

    setStatus('running')
    setMessage('Starting scraper…')
    setProgress(0)
    setScrapeId(null)

    try {
      const { data } = await scrapeApi.start(selectedCampaignId, query.trim(), limit, headless)
      setScrapeId(data.scrape_id)
      useAppStore.getState().setActiveScrapeId(data.scrape_id)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage(detail ?? 'Failed to start scrape')
      setStatus('error')
    }
  }

  const selected = campaigns.find((c) => c.id === selectedCampaignId)

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-h)]">New Scrape</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Enter a Google Maps search query to collect business leads
          </p>
        </div>

        {/* Campaign selector */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Campaign
          </label>

          {campaignsLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedCampaignId}
                onChange={(e) => { setSelectedCampaignId(e.target.value); setCurrentCampaignId(e.target.value) }}
                className={cn(
                  'flex-1 px-3 py-2 rounded-[var(--radius)] border text-sm',
                  'bg-[var(--color-bg)] border-[var(--color-border)]',
                  'focus:border-[var(--color-accent)] outline-none transition-colors'
                )}
              >
                <option value="">Select a campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1 px-3 py-2 rounded-[var(--radius)] text-sm border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
          )}

          {selected && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {selected.summary.total_leads.toLocaleString()} leads · {selected.summary.scrape_count} scrapes
            </p>
          )}
        </div>

        {/* Query */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Search Query
          </label>

          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border',
            'border-[var(--color-border)] focus-within:border-[var(--color-accent)] transition-colors'
          )}>
            <Search className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              placeholder="e.g. bakeries in Karachi"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-[var(--color-text-muted)]"
            />
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {QUERY_PRESETS.map((p) => (
              <button
                key={p.query}
                onClick={() => setQuery(p.query)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border transition-colors',
                  query === p.query
                    ? 'bg-[var(--color-accent-bg)] border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Options row */}
          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--color-text-muted)]">Max leads</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                min={1} max={1000}
                className={cn(
                  'w-20 px-2 py-1 rounded-[var(--radius)] border text-sm text-center',
                  'bg-[var(--color-bg)] border-[var(--color-border)]',
                  'focus:border-[var(--color-accent)] outline-none'
                )}
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={headless}
                onChange={(e) => setHeadless(e.target.checked)}
                className="w-3.5 h-3.5 accent-[var(--color-accent)]"
              />
              Headless
            </label>
          </div>
        </div>

        {/* Status */}
        {status !== 'idle' && (
          <div className={cn(
            'rounded-[var(--radius)] border px-4 py-3 text-sm',
            status === 'success' ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900' :
            status === 'error'   ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900' :
            'border-[var(--color-border)] bg-[var(--color-bg-hover)]'
          )}>
            {status === 'running' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                  <span>Scraping "{query}" · {progress}%</span>
                </div>
                <div className="w-full bg-[var(--color-bg-selected)] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[var(--color-accent)] h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center gap-2 text-[var(--color-success)]">
                <CheckCircle className="w-4 h-4" />
                <span>{message}</span>
                <button
                  onClick={() => navigate(`/campaigns/${selectedCampaignId}`)}
                  className="ml-auto text-[var(--color-accent)] hover:underline"
                >
                  View leads →
                </button>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-[var(--color-danger)]">
                <AlertCircle className="w-4 h-4" />
                <span>{message}</span>
              </div>
            )}
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleScrape}
          disabled={status === 'running' || !selectedCampaignId || !query.trim()}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-2.5 rounded-[var(--radius)] text-sm font-medium',
            'bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {status === 'running'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Scraping…</>
            : <><Zap className="w-4 h-4" /> Start scraping</>
          }
        </button>
      </div>

      {/* Create campaign dialog */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="w-full max-w-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] shadow-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text-h)]">New campaign</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCampaign()}
              placeholder="Campaign name"
              autoFocus
              className={cn(
                'w-full px-3 py-2 rounded-[var(--radius)] border text-sm',
                'bg-[var(--color-bg)] border-[var(--color-border)]',
                'focus:border-[var(--color-accent)] outline-none'
              )}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] rounded-[var(--radius)] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={!newName.trim()}
                className="px-3 py-1.5 text-sm font-medium bg-[var(--color-accent)] text-white rounded-[var(--radius)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
