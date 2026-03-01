'use client'

import { useState } from 'react'
import { Download, FileText, Check } from 'lucide-react'

// Sprint 2.3 — CSV Export client component — Wren

const RANGE_OPTIONS = [
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: '24', label: 'Last 24 months' },
]

const METRIC_OPTIONS = [
  { value: 'all', label: 'All Metrics' },
  { value: 'mrr', label: 'MRR & ARR only' },
  { value: 'subscribers', label: 'Subscribers only' },
  { value: 'churn', label: 'Churn only' },
]

export function ExportCSV() {
  const [range, setRange] = useState('12')
  const [metric, setMetric] = useState('all')
  const [downloading, setDownloading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleExport() {
    setDownloading(true)
    try {
      const url = `/api/export/csv?range=${range}&metric=${metric}`
      const res = await fetch(url)
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `metricshub-export-${range}mo-${new Date().toISOString().slice(0,10)}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-[#1c2128] border border-[#30363d] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
          <FileText className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Export Data</h2>
          <p className="text-xs text-gray-500">Download your metrics as CSV</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Date Range</label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-[#30363d] text-sm text-white focus:outline-none focus:border-blue-500/40"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Metrics</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-[#30363d] text-sm text-white focus:outline-none focus:border-blue-500/40"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Exports as <code className="text-gray-400 font-mono">CSV</code> with headers: Month, MRR, ARR, Subscribers, Churn
        </p>
        <button
          onClick={handleExport}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {done ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {downloading ? 'Downloading...' : done ? 'Downloaded!' : 'Export CSV'}
        </button>
      </div>
    </div>
  )
}
