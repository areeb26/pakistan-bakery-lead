/**
 * Real-time scrape progress bar.
 */

import { Loader2 } from 'lucide-react'

interface ProgressBarProps {
  percent: number
  leadsCollected: number
  currentQuery: string
}

export function ProgressBar({ percent, leadsCollected, currentQuery }: ProgressBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <div className="flex-1">
          <p className="text-sm font-medium">Scraping: {currentQuery}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {leadsCollected} leads collected
          </p>
        </div>
        <p className="text-sm font-semibold">{percent}%</p>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-purple-600 h-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
