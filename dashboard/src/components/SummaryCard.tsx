/**
 * Campaign summary stats card.
 */

import type { CampaignSummary } from '../services'

interface SummaryCardProps {
  summary: CampaignSummary
}

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="bg-[var(--color-bg-hover)] p-2 rounded-[var(--radius)]">
        <p className="text-[var(--color-text-muted)] text-xs">Total Leads</p>
        <p className="text-lg font-semibold text-[var(--color-text-h)]">{summary.total_leads}</p>
      </div>
      <div className="bg-[var(--color-bg-hover)] p-2 rounded-[var(--radius)]">
        <p className="text-[var(--color-text-muted)] text-xs">Scrapes</p>
        <p className="text-lg font-semibold text-[var(--color-text-h)]">{summary.scrape_count}</p>
      </div>
      <div className="bg-[var(--color-bg-hover)] p-2 rounded-[var(--radius)]">
        <p className="text-[var(--color-text-muted)] text-xs">Avg Rating</p>
        <p className="text-lg font-semibold text-[var(--color-text-h)]">
          {summary.avg_rating ? `${summary.avg_rating.toFixed(1)}★` : '—'}
        </p>
      </div>
      <div className="bg-[var(--color-bg-hover)] p-2 rounded-[var(--radius)]">
        <p className="text-[var(--color-text-muted)] text-xs">Has Phone</p>
        <p className="text-lg font-semibold text-[var(--color-text-h)]">{summary.leads_with_phone}</p>
      </div>
    </div>
  )
}
