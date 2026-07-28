/**
 * Export utilities for leads data.
 */

import type { Lead } from '../services'

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportAsJSON(leads: Lead[], _projectName: string, _scrapeQuery: string) {
  const data = {
    metadata: {
      project_name: _projectName,
      query: _scrapeQuery,
      scraped_at: new Date().toISOString(),
      leads_count: leads.length,
    },
    leads,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const filename = `leads_${new Date().toISOString().split('T')[0]}.json`
  downloadFile(blob, filename)
}

export function exportAsCSV(leads: Lead[], _projectName: string, _scrapeQuery: string) {
  if (leads.length === 0) {
    alert('No leads to export')
    return
  }

  // Get all field names
  const fields = Object.keys(leads[0])

  // Create CSV header
  const header = fields.join(',')

  // Create CSV rows
  const rows = leads.map((lead) =>
    fields
      .map((field) => {
        const value = (lead as any)[field]
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value || ''
      })
      .join(',')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const filename = `leads_${new Date().toISOString().split('T')[0]}.csv`
  downloadFile(blob, filename)
}
