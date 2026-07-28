/**
 * Scrape history and diff comparison page.
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { GitCompare } from 'lucide-react'
import { Layout } from '../components'
import type { DiffResult, ScrapeHistoryItem } from '../services'
import { scrapeApi, diffApi } from '../services'

export function ScrapeHistoryPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const projectId = campaignId  // alias for existing code below

  const [scrapes, setScrapes] = useState<ScrapeHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Diff state
  const [compareScrape1, setCompareScrape1] = useState<string | null>(null)
  const [compareScrape2, setCompareScrape2] = useState<string | null>(null)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  // Load scrape history — always call hooks before any early return
  useEffect(() => {
    if (!projectId) return
    loadHistory()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!campaignId) return <div>Invalid campaign</div>

  async function loadHistory() {
    try {
      setLoading(true)
      const response = await scrapeApi.history(projectId!, 0, 100)
      setScrapes(response.data.scrapes)
      setError('')
    } catch (err) {
      setError('Failed to load scrape history')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCompareScrapes() {
    if (!compareScrape1 || !compareScrape2) return

    try {
      setDiffLoading(true)
      const response = await diffApi.compute(compareScrape1, compareScrape2)
      setDiffResult(response.data)
      setError('')
    } catch (err) {
      setError('Failed to compute diff')
      console.error(err)
    } finally {
      setDiffLoading(false)
    }
  }

  void 0 // layout no longer uses per-page sidebar

  if (loading) {
    return (
      <Layout>
        <p>Loading...</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Link to="/campaigns" className="hover:text-[var(--color-text-h)]">Campaigns</Link>
          <span>/</span>
          <Link to={`/campaigns/${campaignId}`} className="hover:text-[var(--color-text-h)]">Campaign</Link>
          <span>/</span>
          <span className="text-[var(--color-text-h)]">History</span>
        </nav>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold mb-1">Scrape History</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {scrapes.length} scrapes recorded
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Scrape list */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-4">
              <h2 className="font-semibold mb-4">All Scrapes</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scrapes.length === 0 ? (
                  <p className="text-sm text-gray-500">No scrapes yet</p>
                ) : (
                  scrapes.map((scrape) => (
                    <div
                      key={scrape._id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded border border-[var(--color-border)] hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{scrape.query}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {scrape.leads_count} leads
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(scrape.scraped_at).toLocaleString()}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setCompareScrape1(scrape._id)}
                          className={`flex-1 text-xs py-1 px-2 rounded ${
                            compareScrape1 === scrape._id
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Pick 1
                        </button>
                        <button
                          onClick={() => setCompareScrape2(scrape._id)}
                          className={`flex-1 text-xs py-1 px-2 rounded ${
                            compareScrape2 === scrape._id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Pick 2
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Diff comparison */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <GitCompare size={20} /> Compare Scrapes
              </h2>

              {/* Selection info */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Scrape 1</p>
                    {compareScrape1 ? (
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        {scrapes.find((s) => s._id === compareScrape1)?.query}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Not selected</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Scrape 2</p>
                    {compareScrape2 ? (
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {scrapes.find((s) => s._id === compareScrape2)?.query}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Not selected</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleCompareScrapes}
                  disabled={!compareScrape1 || !compareScrape2 || diffLoading}
                  className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {diffLoading ? 'Computing...' : 'Compare'}
                </button>
              </div>

              {/* Diff results */}
              {diffResult && (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded">
                      <p className="text-xs text-green-600 dark:text-green-400">Added</p>
                      <p className="text-2xl font-bold text-green-600">
                        {diffResult.stats.added}
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">Updated</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {diffResult.stats.updated}
                      </p>
                    </div>
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded">
                      <p className="text-xs text-red-600 dark:text-red-400">Deleted</p>
                      <p className="text-2xl font-bold text-red-600">
                        {diffResult.stats.deleted}
                      </p>
                    </div>
                  </div>

                  {/* Changes table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Change</th>
                          <th className="px-3 py-2 text-left font-semibold">Business</th>
                          <th className="px-3 py-2 text-left font-semibold">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {/* New leads */}
                        {diffResult.new_leads.map((lead) => (
                          <tr key={`new-${lead.lead_id}`} className="bg-green-50 dark:bg-green-900/10">
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 bg-green-200 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                                NEW
                              </span>
                            </td>
                            <td className="px-3 py-2">{lead.business_name}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {lead.address}
                            </td>
                          </tr>
                        ))}

                        {/* Updated leads */}
                        {diffResult.updated_leads.map((lead) => (
                          <tr key={`updated-${lead.lead_id}`} className="bg-yellow-50 dark:bg-yellow-900/10">
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 bg-yellow-200 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs font-medium">
                                UPDATED
                              </span>
                            </td>
                            <td className="px-3 py-2">{lead.business_name}</td>
                            <td className="px-3 py-2 text-xs">
                              {lead.changes &&
                                Object.entries(lead.changes).map(([field, change]) => (
                                  <p key={field} className="text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">{field}:</span>{' '}
                                    {String(change.old)} → {String(change.new)}
                                  </p>
                                ))}
                            </td>
                          </tr>
                        ))}

                        {/* Deleted leads */}
                        {diffResult.deleted_leads.map((lead) => (
                          <tr key={`deleted-${lead.lead_id}`} className="bg-red-50 dark:bg-red-900/10">
                            <td className="px-3 py-2">
                              <span className="px-2 py-1 bg-red-200 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium">
                                DELETED
                              </span>
                            </td>
                            <td className="px-3 py-2">{lead.business_name}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {lead.address}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
