import { useState } from 'react'
import { MapPin, Search, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const QUERY_PRESETS = [
  { label: 'Bakeries in Karachi', query: 'bakeries in Karachi' },
  { label: 'Restaurants in Karachi', query: 'restaurants in Karachi' },
  { label: 'Bakeries in Lahore', query: 'bakeries in Lahore' },
  { label: 'Restaurants in Lahore', query: 'restaurants in Lahore' },
  { label: 'Bakeries in Islamabad', query: 'bakeries in Islamabad' },
  { label: 'Restaurants in Islamabad', query: 'restaurants in Islamabad' },
  { label: 'Travel Agencies Pakistan', query: 'travel agency Pakistan' },
  { label: 'Hajj/Umrah Operators', query: 'hajj umrah travel agency Pakistan' },
]

export default function ScrapePage() {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(50)
  const [headless, setHeadless] = useState(true)
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [leadsCount, setLeadsCount] = useState(0)

  const handleScrape = async () => {
    if (!query.trim()) {
      setMessage('Please enter a search query')
      setStatus('error')
      return
    }

    setStatus('running')
    setMessage('Starting scraper...')
    setLeadsCount(0)

    try {
      const response = await fetch(`${API_URL}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit, headless }),
      })

      const data = await response.json()

      if (data.success) {
        setLeadsCount(data.count)
        setMessage(`Successfully scraped ${data.count} leads!`)
        setStatus('success')
      } else {
        setMessage(data.error || 'Scraping failed')
        setStatus('error')
      }
    } catch (err) {
      setMessage('Failed to connect to API server. Make sure it\'s running on port 8000.')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-[var(--color-text-h)] mb-2">Scrape Leads</h1>
        <p className="text-[var(--color-text)]">Enter a Google Maps search query to scrape business leads</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-6">
          <h2 className="text-lg font-medium text-[var(--color-text-h)] mb-4 flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Query
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Custom Query</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., bakeries in Karachi, restaurants in DHA Lahore"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Quick Presets</label>
              <div className="flex flex-wrap gap-2">
                {QUERY_PRESETS.map((preset) => (
                  <button
                    key={preset.query}
                    type="button"
                    onClick={() => setQuery(preset.query)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      query === preset.query
                        ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">Max Leads</label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                  min={1}
                  max={500}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Options</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={headless}
                      onChange={(e) => setHeadless(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--color-border)] text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">Headless mode</span>
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={handleScrape}
              disabled={status === 'running'}
              className="w-full py-3 px-6 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Start Scraping
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-6">
          <h2 className="text-lg font-medium text-[var(--color-text-h)] mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Status
          </h2>

          <div className={`p-4 rounded-lg border ${
            status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
            status === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
            status === 'running' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
            'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
          }`}>
            {status === 'running' && (
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <div>
                  <p className="font-medium">Scraping in progress...</p>
                  <p className="text-sm text-[var(--color-text)]">This may take a few minutes</p>
                </div>
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">{message}</p>
                  <p className="text-sm text-[var(--color-text)]">Leads found: {leadsCount}</p>
                </div>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <p className="text-red-800 dark:text-red-300">{message}</p>
              </div>
            )}
            {status === 'idle' && (
              <div className="text-center py-8 text-[var(--color-text)]">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Enter a query and click "Start Scraping" to begin</p>
                <p className="text-sm mt-2">Results will appear in the Leads tab</p>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h3 className="font-medium text-sm mb-2">API Server Required</h3>
            <p className="text-sm text-[var(--color-text)]">
              Start the backend server in a separate terminal:
            </p>
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono overflow-x-auto">
{`cd /path/to/project
python -m uvicorn api.main:app --reload --port 8000`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}