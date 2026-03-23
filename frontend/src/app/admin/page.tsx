'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// --- Types ---

interface DayCount { date: string; count: number }
interface Stats {
  totalPlans: number; activePlans: number; lockedPlans: number; expiredPlans: number
  plansToday: number; plansThisWeek: number
  totalParticipants: number; avgParticipantsPerPlan: number; responseRate: number
  totalUsers: number; totalAvailabilityMarks: number; completionRate: number
  dailyPlans: DayCount[]; dailyParticipants: DayCount[]
}
interface AdminPlan {
  slug: string; title: string; status: string; granularity: string
  location: string; participantCount: number; respondedCount: number; createdAt: string
}
interface PlansResponse { plans: AdminPlan[]; total: number; page: number; pages: number }
interface ActivityEntry {
  id: number; actor: string; action: string; details: string
  createdAt: string; planTitle: string; planSlug: string
}

// --- Auth wrapper ---

function useAdminToken() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_token')
    if (saved) { setToken(saved); setAuthed(true) }
  }, [])

  const login = (t: string) => {
    sessionStorage.setItem('admin_token', t)
    setToken(t)
    setAuthed(true)
  }

  const headers = { Authorization: `Bearer ${token}` }
  return { token, authed, login, headers }
}

async function adminFetch<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers })
  if (res.status === 401) throw new Error('unauthorized')
  return res.json()
}

// --- Main page ---

export default function AdminPage() {
  const { authed, login, headers } = useAdminToken()
  const [loginToken, setLoginToken] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginToken) return
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${loginToken}` } })
      if (res.status === 401) { setLoginError('Invalid token'); setLoginLoading(false); return }
      login(loginToken)
    } catch {
      setLoginError('Failed to connect')
    } finally {
      setLoginLoading(false)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-sm mx-auto px-4 pt-24">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h1 className="text-heading text-foreground mb-4">Admin</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input type="password" placeholder="Admin token" value={loginToken} onChange={e => setLoginToken(e.target.value)} autoFocus />
              {loginError && <p className="text-tiny text-red-500">{loginError}</p>}
              <Button type="submit" variant="primary" className="w-full" loading={loginLoading}>View dashboard</Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return <Dashboard headers={headers} />
}

// --- Dashboard ---

type Tab = 'overview' | 'plans' | 'activity'

function Dashboard({ headers }: { headers: Record<string, string> }) {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-12">
        <h1 className="text-title text-foreground mb-6">Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(['overview', 'plans', 'activity'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-small font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab headers={headers} />}
        {tab === 'plans' && <PlansTab headers={headers} />}
        {tab === 'activity' && <ActivityTab headers={headers} />}
      </div>
    </div>
  )
}

// --- Overview Tab ---

function OverviewTab({ headers }: { headers: Record<string, string> }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    adminFetch<Stats>('/api/admin/stats', headers).then(setStats).catch(() => {})
  }, [headers])

  if (!stats) return <div className="text-muted-foreground">Loading...</div>

  const pct = (n: number) => `${(n * 100).toFixed(0)}%`
  const maxDaily = Math.max(...stats.dailyPlans.map(d => d.count), 1)
  const maxDailyP = Math.max(...stats.dailyParticipants.map(d => d.count), 1)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total plans" value={stats.totalPlans} />
        <StatCard label="Active" value={stats.activePlans} color="text-cell-free" />
        <StatCard label="Locked" value={stats.lockedPlans} color="text-primary" />
        <StatCard label="Expired" value={stats.expiredPlans} color="text-tertiary" />
        <StatCard label="Today" value={stats.plansToday} />
        <StatCard label="This week" value={stats.plansThisWeek} />
        <StatCard label="Participants" value={stats.totalParticipants} />
        <StatCard label="Auth users" value={stats.totalUsers} />
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <RateCard label="Avg per plan" value={stats.avgParticipantsPerPlan.toFixed(1)} />
        <RateCard label="Response rate" value={pct(stats.responseRate)} bar={stats.responseRate} />
        <RateCard label="Completion rate" value={pct(stats.completionRate)} bar={stats.completionRate} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BarChart title="Plans / day (30d)" data={stats.dailyPlans} max={maxDaily} />
        <BarChart title="Participants / day (30d)" data={stats.dailyParticipants} max={maxDailyP} />
      </div>
    </motion.div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-tiny text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-heading font-bold ${color || 'text-foreground'}`}>{value}</p>
    </div>
  )
}

function RateCard({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-tiny text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className="text-heading font-bold text-foreground mb-2">{value}</p>
      {bar !== undefined && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${bar * 100}%` }} />
        </div>
      )}
    </div>
  )
}

function BarChart({ title, data, max }: { title: string; data: DayCount[]; max: number }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-small font-medium text-foreground mb-3">{title}</p>
      <div className="flex items-end gap-0.5 h-24">
        {data.map(d => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-primary/60 rounded-sm" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }} title={`${d.date}: ${d.count}`} />
          </div>
        ))}
        {data.length === 0 && <p className="text-tiny text-tertiary w-full text-center">No data</p>}
      </div>
      {data.length > 0 && (
        <div className="flex justify-between mt-1">
          <span className="text-tiny text-tertiary">{data[0]?.date.slice(5)}</span>
          <span className="text-tiny text-tertiary">{data[data.length - 1]?.date.slice(5)}</span>
        </div>
      )}
    </div>
  )
}

// --- Plans Tab ---

function PlansTab({ headers }: { headers: Record<string, string> }) {
  const [data, setData] = useState<PlansResponse | null>(null)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchPlans = useCallback(() => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (search) params.set('q', search)
    params.set('page', String(page))
    adminFetch<PlansResponse>(`/api/admin/plans?${params}`, headers).then(setData).catch(() => {})
  }, [headers, status, search, page])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const statusColors: Record<string, string> = {
    active: 'bg-cell-free/15 text-emerald-800 dark:text-emerald-300',
    locked: 'bg-primary/15 text-primary',
    expired: 'bg-muted text-tertiary',
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="Search plans..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {['', 'active', 'locked', 'expired'].map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-md text-tiny font-medium transition-colors ${
                status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-tiny text-tertiary font-medium uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3 text-tiny text-tertiary font-medium uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-tiny text-tertiary font-medium uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-tiny text-tertiary font-medium uppercase tracking-wider">Responses</th>
                <th className="px-4 py-3 text-tiny text-tertiary font-medium uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {data?.plans.map(plan => (
                <tr key={plan.slug} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/plan/${plan.slug}`} className="text-foreground font-medium hover:underline">
                      {plan.title}
                    </Link>
                    {plan.location && <p className="text-tiny text-tertiary">{plan.location}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-tiny font-medium px-2 py-0.5 rounded-full ${statusColors[plan.status] || ''}`}>
                      {plan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{plan.granularity}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {plan.respondedCount}/{plan.participantCount}
                  </td>
                  <td className="px-4 py-3 text-tiny text-tertiary whitespace-nowrap">
                    {new Date(plan.createdAt + 'Z').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
              {data?.plans.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No plans found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-tiny text-tertiary">{data.total} plans total</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded text-tiny text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                ← Prev
              </button>
              <span className="px-3 py-1 text-tiny text-muted-foreground">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-3 py-1 rounded text-tiny text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// --- Activity Tab ---

interface ActivityResponse { entries: ActivityEntry[]; total: number; page: number; pages: number }

function ActivityTab({ headers }: { headers: Record<string, string> }) {
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  const fetchActivity = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (action) params.set('action', action)
    adminFetch<ActivityResponse>(`/api/admin/activity?${params}`, headers).then(setData).catch(() => {})
  }, [headers, action, page])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  const actionLabels: Record<string, string> = {
    plan_created: 'created',
    plan_locked: 'locked',
    plan_renamed: 'renamed',
    participant_joined: 'joined',
    availability_updated: 'updated',
  }

  const actionColors: Record<string, string> = {
    plan_created: 'bg-cell-free/15 text-emerald-800 dark:text-emerald-300',
    plan_locked: 'bg-primary/15 text-primary',
    participant_joined: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    availability_updated: 'bg-muted text-muted-foreground',
    plan_renamed: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  }

  const actionFilters = ['', 'plan_created', 'participant_joined', 'availability_updated', 'plan_locked', 'plan_renamed']
  const filterLabels: Record<string, string> = {
    '': 'All', plan_created: 'Created', participant_joined: 'Joined',
    availability_updated: 'Updated', plan_locked: 'Locked', plan_renamed: 'Renamed',
  }

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr + 'Z').getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Action filter */}
      <div className="flex flex-wrap gap-1 mb-4">
        {actionFilters.map(a => (
          <button
            key={a}
            onClick={() => { setAction(a); setPage(1) }}
            className={`px-3 py-1.5 rounded-md text-tiny font-medium transition-colors ${
              action === a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {filterLabels[a] || a}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {!data || data.entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-muted-foreground">No activity yet</p>
        ) : (
          <div className="divide-y divide-border/50">
            {data.entries.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                <span className={`text-tiny font-medium px-2 py-0.5 rounded-full shrink-0 ${actionColors[entry.action] || 'bg-muted text-muted-foreground'}`}>
                  {actionLabels[entry.action] || entry.action}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-small text-foreground">
                    {entry.actor && <span className="font-medium">{entry.actor} </span>}
                    {actionLabels[entry.action] || entry.action}{' '}
                    <Link href={`/plan/${entry.planSlug}`} className="text-primary hover:underline">
                      {entry.planTitle}
                    </Link>
                  </span>
                  {entry.details && <span className="text-tiny text-tertiary ml-1">({entry.details})</span>}
                </div>
                <span className="text-tiny text-tertiary whitespace-nowrap shrink-0">{timeAgo(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-tiny text-tertiary">{data.total} entries</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded text-tiny text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                ← Prev
              </button>
              <span className="px-3 py-1 text-tiny text-muted-foreground">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-3 py-1 rounded text-tiny text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
