'use client'

import { useState } from 'react'
import { Bell, Mail, Plus, Trash2, Save, Check, TrendingDown, TrendingUp, Users, DollarSign, AlertTriangle, ChevronDown } from 'lucide-react'

// Sprint 2.2 — Email Alerts (Resend) — Wren

// ─── Types ─────────────────────────────────────────────────────────────────────

type AlertMetric = 'mrr_drop' | 'mrr_increase' | 'churn_spike' | 'new_subscribers' | 'revenue_drop' | 'trial_ending'
type AlertFrequency = 'instant' | 'hourly' | 'daily' | 'weekly'
type AlertOperator = 'drops_below' | 'rises_above' | 'changes_by'

interface AlertRule {
  id: string
  enabled: boolean
  metric: AlertMetric
  operator: AlertOperator
  threshold: string
  frequency: AlertFrequency
  emails: string[]
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const METRIC_CONFIG: Record<AlertMetric, { label: string; icon: React.ElementType; unit: string; color: string; description: string }> = {
  mrr_drop:          { label: 'MRR Drop',           icon: TrendingDown,  unit: '$',  color: 'text-red-400',   description: 'Alert when Monthly Recurring Revenue drops' },
  mrr_increase:      { label: 'MRR Increase',       icon: TrendingUp,    unit: '$',  color: 'text-green-400', description: 'Alert when MRR reaches a new milestone' },
  churn_spike:       { label: 'Churn Spike',        icon: AlertTriangle, unit: '%',  color: 'text-amber-400', description: 'Alert when churn rate exceeds a threshold' },
  new_subscribers:   { label: 'New Subscribers',    icon: Users,         unit: '',   color: 'text-blue-400',  description: 'Alert when new subscribers milestone is hit' },
  revenue_drop:      { label: 'Revenue Drop',       icon: DollarSign,    unit: '$',  color: 'text-red-400',   description: 'Alert when revenue drops by a percentage' },
  trial_ending:      { label: 'Trial Ending',       icon: Bell,          unit: '',   color: 'text-purple-400', description: 'Alert X days before trials expire' },
}

const INITIAL_RULES: AlertRule[] = [
  { id: '1', enabled: true,  metric: 'mrr_drop',       operator: 'drops_below',   threshold: '5000',  frequency: 'instant', emails: ['founder@acme.io'] },
  { id: '2', enabled: true,  metric: 'churn_spike',    operator: 'rises_above',   threshold: '5',     frequency: 'daily',   emails: ['founder@acme.io', 'growth@acme.io'] },
  { id: '3', enabled: false, metric: 'new_subscribers',operator: 'rises_above',   threshold: '100',   frequency: 'instant', emails: ['founder@acme.io'] },
]

const NEW_RULE: AlertRule = {
  id: '',
  enabled: true,
  metric: 'mrr_drop',
  operator: 'drops_below',
  threshold: '',
  frequency: 'instant',
  emails: [],
}

// ─── Alert Rule Card ────────────────────────────────────────────────────────────

function AlertCard({
  rule,
  onChange,
  onDelete,
}: {
  rule: AlertRule
  onChange: (updated: AlertRule) => void
  onDelete: (id: string) => void
}) {
  const [emailInput, setEmailInput] = useState('')
  const cfg = METRIC_CONFIG[rule.metric]
  const MetricIcon = cfg.icon

  function addEmail() {
    const email = emailInput.trim()
    if (email && !rule.emails.includes(email)) {
      onChange({ ...rule, emails: [...rule.emails, email] })
      setEmailInput('')
    }
  }

  return (
    <div className={`rounded-xl border bg-[#161b22] p-5 transition-opacity ${rule.enabled ? 'border-white/10' : 'border-white/[0.05] opacity-60'}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0`}>
            <MetricIcon className={`w-4 h-4 ${cfg.color}`} />
          </div>
          <div>
            <p className="font-medium text-sm text-white">{cfg.label}</p>
            <p className="text-xs text-gray-500">{cfg.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onChange({ ...rule, enabled: !rule.enabled })}
            className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${rule.enabled ? 'bg-blue-600' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${rule.enabled ? 'left-5' : 'left-0.5'}`} />
          </button>
          {rule.id && (
            <button onClick={() => onDelete(rule.id)} className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Metric */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Metric</label>
          <div className="relative">
            <select
              value={rule.metric}
              onChange={(e) => onChange({ ...rule, metric: e.target.value as AlertMetric })}
              className="w-full px-3 py-2 pr-8 rounded-lg bg-[#0d1117] border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/40 appearance-none"
            >
              {Object.entries(METRIC_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>
        </div>
        {/* Operator */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Condition</label>
          <div className="relative">
            <select
              value={rule.operator}
              onChange={(e) => onChange({ ...rule, operator: e.target.value as AlertOperator })}
              className="w-full px-3 py-2 pr-8 rounded-lg bg-[#0d1117] border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/40 appearance-none"
            >
              <option value="drops_below">Drops below</option>
              <option value="rises_above">Rises above</option>
              <option value="changes_by">Changes by</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>
        </div>
        {/* Threshold */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Threshold <span className="text-gray-600">{cfg.unit ? `(${cfg.unit})` : ''}</span>
          </label>
          <div className="relative">
            {cfg.unit && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{cfg.unit}</span>}
            <input
              type="number"
              value={rule.threshold}
              onChange={(e) => onChange({ ...rule, threshold: e.target.value })}
              placeholder="e.g. 5000"
              className={`w-full py-2 pr-3 rounded-lg bg-[#0d1117] border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 ${cfg.unit ? 'pl-7' : 'pl-3'}`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Frequency */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Alert Frequency</label>
          <div className="flex gap-1.5 flex-wrap">
            {(['instant', 'hourly', 'daily', 'weekly'] as AlertFrequency[]).map((f) => (
              <button
                key={f}
                onClick={() => onChange({ ...rule, frequency: f })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${rule.frequency === f ? 'bg-blue-600/30 border border-blue-500/40 text-blue-400' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Email recipients */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Send to</label>
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                placeholder="add@email.com"
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
              />
              <button onClick={addEmail} className="px-2.5 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors text-xs">
                Add
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {rule.emails.map((email) => (
                <span key={email} className="inline-flex items-center gap-1 bg-white/[0.07] border border-white/10 rounded-full px-2.5 py-0.5 text-xs text-gray-300">
                  {email}
                  <button onClick={() => onChange({ ...rule, emails: rule.emails.filter(e => e !== email) })} className="text-gray-500 hover:text-white ml-0.5">×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>(INITIAL_RULES)
  const [saved, setSaved] = useState(false)
  const [resendKey, setResendKey] = useState('re_••••••••••••••••••')
  const [testEmail, setTestEmail] = useState('')
  const [testSent, setTestSent] = useState(false)

  function updateRule(updated: AlertRule) {
    setRules((rs) => rs.map((r) => r.id === updated.id ? updated : r))
  }

  function deleteRule(id: string) {
    setRules((rs) => rs.filter((r) => r.id !== id))
  }

  function addRule() {
    const newRule = { ...NEW_RULE, id: `rule-${Date.now()}` }
    setRules((rs) => [...rs, newRule])
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function sendTestEmail() {
    if (!testEmail.trim()) return
    await new Promise(r => setTimeout(r, 800))
    setTestSent(true)
    setTimeout(() => setTestSent(false), 3000)
    setTestEmail('')
  }

  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Email Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Get notified via email when your metrics hit critical thresholds
          </p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors">
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Resend config */}
      <div className="rounded-xl bg-[#161b22] border border-white/10 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Resend Configuration</p>
            <p className="text-xs text-gray-500">Email delivery powered by Resend</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400 bg-green-500/15 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Connected
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Resend API Key</label>
            <input
              type="password"
              value={resendKey}
              onChange={(e) => setResendKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Send Test Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-3 py-2 rounded-lg bg-[#0d1117] border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40"
              />
              <button
                onClick={sendTestEmail}
                className="px-3 py-2 rounded-lg bg-white/[0.08] border border-white/10 text-sm text-gray-300 hover:bg-white/15 transition-colors whitespace-nowrap"
              >
                {testSent ? '✓ Sent!' : 'Send Test'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert rules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-white">
            Alert Rules
            <span className="ml-2 text-xs text-gray-500">{enabledCount} active</span>
          </p>
          <button
            onClick={addRule}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] border border-white/10 text-sm text-gray-300 hover:bg-white/15 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
        <div className="space-y-3">
          {rules.map((rule) => (
            <AlertCard key={rule.id} rule={rule} onChange={updateRule} onDelete={deleteRule} />
          ))}
          {rules.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
              <Bell className="w-8 h-8 mx-auto mb-3 text-gray-600" />
              <p className="text-sm text-gray-400 mb-3">No alert rules yet</p>
              <button onClick={addRule} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-sm text-blue-400 hover:bg-blue-600/30 transition-colors mx-auto">
                <Plus className="w-4 h-4" />
                Create your first alert
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-4 text-xs text-amber-400/80 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p>Alert emails are sent from <span className="font-mono text-amber-400">alerts@metricshub.io</span>. Instant alerts fire within 60 seconds of threshold being crossed. Daily/weekly digests are sent at 08:00 UTC.</p>
      </div>
    </div>
  )
}
