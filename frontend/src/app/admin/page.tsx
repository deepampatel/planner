'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AdminStats {
  totalPlans: number
  activePlans: number
  lockedPlans: number
  expiredPlans: number
  plansToday: number
  plansThisWeek: number
  totalParticipants: number
  avgParticipantsPerPlan: number
  responseRate: number
  totalUsers: number
  totalAvailabilityMarks: number
  completionRate: number
  recentPlans: {
    slug: string
    title: string
    status: string
    participantCount: number
    createdAt: string
  }[]
}

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [authed, setAuthed] = useState(false)

  const fetchStats = async (adminToken?: string) => {
    const t = adminToken || token
    if (!t) { setError('Enter admin token'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.status === 401) {
        setError('Invalid token')
        setLoading(false)
        return
      }
      const data = await res.json()
      setStats(data)
      setAuthed(true)
      // Remember token for refresh
      sessionStorage.setItem('admin_token', t)
    } catch {
      setError('Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }

  // Auto-load from sessionStorage
  if (!authed && !loading && typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('admin_token')
    if (saved) {
      fetchStats(saved)
    }
  }

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`

  const statusColor: Record<string, string> = {
    active: 'text-cell-free',
    locked: 'text-primary',
    expired: 'text-tertiary',
  }

  if (!authed) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-sm mx-auto px-4 pt-24">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h1 className="text-heading text-foreground mb-4">Admin</h1>
            <form onSubmit={e => { e.preventDefault(); fetchStats() }} className="space-y-4">
              <Input
                type="password"
                placeholder="Admin token"
                value={token}
                onChange={e => setToken(e.target.value)}
                autoFocus
              />
              {error && <p className="text-tiny text-red-500">{error}</p>}
              <Button type="submit" variant="primary" className="w-full" loading={loading}>
                View dashboard
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="min-h-screen">
      <Header />
      <motion.div
        className="max-w-3xl mx-auto px-4 pt-8 pb-12"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-title text-foreground">Dashboard</h1>
          <Button variant="ghost" size="sm" onClick={() => fetchStats()}>
            Refresh
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total plans" value={stats.totalPlans} />
          <StatCard label="Active" value={stats.activePlans} accent="green" />
          <StatCard label="Locked" value={stats.lockedPlans} accent="primary" />
          <StatCard label="Expired" value={stats.expiredPlans} />
          <StatCard label="Plans today" value={stats.plansToday} />
          <StatCard label="This week" value={stats.plansThisWeek} />
          <StatCard label="Participants" value={stats.totalParticipants} />
          <StatCard label="Signed-in users" value={stats.totalUsers} />
        </div>

        {/* Rates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <RateCard label="Avg per plan" value={stats.avgParticipantsPerPlan.toFixed(1)} />
          <RateCard label="Response rate" value={pct(stats.responseRate)} />
          <RateCard label="Completion rate" value={pct(stats.completionRate)} subtitle="locked / (locked + expired)" />
        </div>

        {/* Recent plans */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
          <h2 className="text-heading text-foreground mb-4">Recent plans</h2>
          <div className="space-y-1">
            {stats.recentPlans.map(plan => (
              <a
                key={plan.slug}
                href={`/plan/${plan.slug}`}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium text-foreground truncate">{plan.title}</p>
                  <p className="text-tiny text-tertiary">
                    {new Date(plan.createdAt + 'Z').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-tiny text-muted-foreground">{plan.participantCount} people</span>
                  <span className={`text-tiny font-medium ${statusColor[plan.status] || 'text-muted-foreground'}`}>
                    {plan.status}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-tiny text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-heading font-bold ${accent === 'green' ? 'text-cell-free' : accent === 'primary' ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}

function RateCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-tiny text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className="text-heading font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-tiny text-tertiary mt-0.5">{subtitle}</p>}
    </div>
  )
}
