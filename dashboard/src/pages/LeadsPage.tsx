import { useState, useEffect } from 'react'
import { Download, Search, Filter, CheckCircle, AlertCircle, Database, Loader2 } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Lead {
  business_name: string
  category: string
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  review_count: number
  plus_code: string | null
  hours: string | null
  gmaps_url: string | null
  search_query: string | null
  scraped_at: string
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filtered, setFiltered] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasPhone, setHasPhone] = useState(false)
  const [hasWebsite, setHasWebsite] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetchLeads()
  }, [])
  useEffect(() => {
    applyFilters()
  }, [leads, hasPhone, hasWebsite, searchTerm])

  const fetchLeads = async () => {
    try {
      const response = await fetch(`${API_URL}/leads`)
      const data = await response.json()

      if (data.leads) {
        setLeads(data.leads)
        setCount(data.leads.length)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to connect to API. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let result = leads

    if (hasPhone) {
      result = result.filter((l) => l.phone !== null && l.phone !== '')
    }
    if (hasWebsite) {
      result = result.filter((l) => l.website !== null && l.website !== '')
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      result = result.filter(
        (lead) =>
          lead.business_name.toLowerCase().includes(term) ||
          (lead.address && lead.address.toLowerCase().includes(term))
      )
    }

    setFiltered(result)
  }

  const exportData = (format: 'csv' | 'json') => {
    const filename = `leads_${new Date().toISOString().split('T')[0]}.${format}`

    if (format === 'csv') {
      const csvData = [
        Object.keys(filtered[0] || {}),
        ...filtered.map((lead) => Object.values(lead)),
      ]
        .flat()
        .join(',')

      const blob = new Blob(['﻿' + csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
    } else {
      const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.click()
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
        <p className="mt-4 text-[var(--color-text)]">Loading leads...</p>
      </div>
    )
  }

  const totalPhone = leads.filter((l) => l.phone !== null && l.phone !== '').length
  const totalWebsite = leads.filter((l) => l.website !== null && l.website !== '').length
  const avgRating = leads.length
    ? (leads.reduce((sum, l) => sum + (l.rating || 0), 0) / leads.length).toFixed(2)
    : 'N/A'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--color-text-h)] mb-2">Leads</h1>
          <p className="text-[var(--color-text)]">
            Successfully scraped {count} leads with {totalPhone} phone numbers and {totalWebsite} websites
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchLeads}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <Database className="w-4 h-4" />
            <span>Total Leads</span>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text-h)] mt-2">{count}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <CheckCircle className="w-4 h-4" />
            <span>Has Phone</span>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text-h)] mt-2">{totalPhone}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <CheckCircle className="w-4 h-4" />
            <span>Has Website</span>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text-h)] mt-2">{totalWebsite}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <span>Avg Rating</span>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text-h)] mt-2">{avgRating}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-lg font-medium text-[var(--color-text-h)] mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text)] opacity-50" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by business name or address"
                className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasPhone}
                onChange={(e) => setHasPhone(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)] text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm">Only with phone number</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasWebsite}
                onChange={(e) => setHasWebsite(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)] text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm">Only with website</span>
            </label>
          </div>

          <button
            onClick={() => {
              setHasPhone(false)
              setHasWebsite(false)
              setSearchTerm('')
            }}
            className="text-sm text-purple-600 hover:text-purple-700 underline"
          >
            Clear all filters
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--color-text-h)]">
            Results ({filtered.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => exportData('json')}
              className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-medium flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
            <button
              onClick={() => exportData('csv')}
              className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm font-medium flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text)]">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No leads found matching your filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-h)]">Business</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-h)]">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-h)]">Address</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-h)]">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-h)]">Rating</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-h)]">Web</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((lead, idx) => (
                  <tr key={`${lead.business_name}-${idx}`}>
                    <td className="px-4 py-3 font-medium">{lead.business_name}</td>
                    <td className="px-4 py-3">{lead.category}</td>
                    <td className="px-4 py-3 max-w-xs truncate" title={lead.address || ''}>
                      {lead.address || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {lead.phone || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {lead.rating ? (
                        <span className="flex items-center gap-1">
                          ★{lead.rating.toFixed(1)} ({lead.review_count})
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:underline"
                        >
                          {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}