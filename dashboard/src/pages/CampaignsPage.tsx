/**
 * Campaigns page — the post-login landing page (replaces DashboardPage + ProjectsPage).
 * Notion-style: clean list of campaigns as cards, inline create dialog.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ChevronRight, Database, Zap, BarChart3 } from 'lucide-react'
import { Layout } from '../components'
import { campaignsApi, type Campaign } from '../services'
import { useAppStore } from '../store'
import { cn } from '../lib/utils'

export function CampaignsPage() {
  const navigate = useNavigate()
  const { setCurrentCampaignId } = useAppStore()

  const [campaigns, setCampaigns]           = useState<Campaign[]>([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [showCreate, setShowCreate]         = useState(false)
  const [newName, setNewName]               = useState('')
  const [newDesc, setNewDesc]               = useState('')
  const [creating, setCreating]             = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      const { data } = await campaignsApi.list()
      setCampaigns(data.campaigns)
    } catch {
      setError('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    try {
      setCreating(true)
      const { data } = await campaignsApi.create({ name: newName, description: newDesc })
      setCampaigns([data, ...campaigns])
      setCurrentCampaignId(data.id)
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      navigate(`/campaigns/${data.id}`)
    } catch {
      setError('Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this campaign and all its scrapes?')) return
    try {
      await campaignsApi.delete(id)
      setCampaigns(campaigns.filter((c) => c.id !== id))
    } catch {
      setError('Failed to delete campaign')
    }
  }

  // totals for the summary row
  const totalLeads   = campaigns.reduce((s, c) => s + c.summary.total_leads, 0)
  const totalScrapes = campaigns.reduce((s, c) => s + c.summary.scrape_count, 0)

  return (
    <Layout>
      <div className="space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-h)]">Campaigns</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
              {totalLeads > 0 && ` · ${totalLeads.toLocaleString()} leads · ${totalScrapes} scrapes`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium',
              'bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity'
            )}
          >
            <Plus className="w-4 h-4" /> New campaign
          </button>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-danger)] px-3 py-2 rounded-[var(--radius)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
            {error}
          </p>
        )}

        {/* Campaigns list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-[var(--radius)] bg-[var(--color-bg-hover)] animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center text-[var(--color-text-muted)]">
            <Database className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium text-[var(--color-text-h)]">No campaigns yet</p>
            <p className="text-sm mt-1 mb-5">Create a campaign to start scraping leads</p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> New campaign
            </button>
          </div>
        ) : (
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] overflow-hidden divide-y divide-[var(--color-border)]">
            {campaigns.map((c) => (
              <div
                key={c.id}
                onClick={() => { setCurrentCampaignId(c.id); navigate(`/campaigns/${c.id}`) }}
                className="group flex items-center gap-4 px-4 py-3 bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
              >
                {/* Icon */}
                <div className="shrink-0 w-8 h-8 rounded flex items-center justify-center bg-[var(--color-accent-bg)] text-[var(--color-accent)]">
                  <BarChart3 className="w-4 h-4" />
                </div>

                {/* Name + description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-h)] truncate">{c.name}</p>
                  {c.description && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{c.description}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-5 text-xs text-[var(--color-text-muted)] shrink-0">
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    {c.summary.total_leads.toLocaleString()} leads
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {c.summary.scrape_count} scrapes
                  </span>
                  {c.summary.date_range.last_scrape && (
                    <span>
                      {new Date(c.summary.date_range.last_scrape).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDelete(c.id, e)}
                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create campaign dialog */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div className="w-full max-w-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius)] shadow-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text-h)]">New campaign</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-h)] mb-1">
                  Name <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. Karachi Bakeries"
                  autoFocus
                  className={cn(
                    'w-full px-3 py-2 rounded-[var(--radius)] border text-sm',
                    'bg-[var(--color-bg)] border-[var(--color-border)]',
                    'focus:border-[var(--color-accent)] outline-none transition-colors',
                    'placeholder:text-[var(--color-text-muted)]'
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-h)] mb-1">
                  Description <span className="text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this campaign for?"
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 rounded-[var(--radius)] border text-sm resize-none',
                    'bg-[var(--color-bg)] border-[var(--color-border)]',
                    'focus:border-[var(--color-accent)] outline-none transition-colors',
                    'placeholder:text-[var(--color-text-muted)]'
                  )}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded-[var(--radius)] text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
