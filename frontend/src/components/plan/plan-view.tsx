'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Plan, AuditEntry } from '@/lib/types'
import { apiClient } from '@/lib/api'
import { getToken } from '@/lib/token-store'
import { usePlan } from '@/hooks/use-plan'
import { useEditToken } from '@/hooks/use-edit-token'
import { Header } from '@/components/layout/header'
import { PlanHeader } from './plan-header'
import { JoinForm } from './join-form'
import { ShareSheet } from './share-sheet'
import { AvailabilityGrid } from '@/components/grid/availability-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateRange } from '@/lib/timezone'

interface PlanViewProps {
  initialData: Plan
  slug: string
}

export function PlanView({ initialData, slug }: PlanViewProps) {
  const { editToken, isHost, loaded, setEditToken } = useEditToken(slug)
  const { plan, isRefreshing, refetch } = usePlan({ slug, initialData, editToken })
  const [showShare, setShowShare] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [activity, setActivity] = useState<AuditEntry[]>([])

  // Progress stats
  const respondedCount = useMemo(
    () => plan.participants.filter(p => p.hasResponded).length,
    [plan.participants]
  )
  const totalCount = plan.participantCount

  if (!loaded) return null

  const needsJoin = !editToken
  const isLocked = plan.status === 'locked'

  const handleJoined = () => {
    // Re-read token from localStorage after join sets it
    const newToken = getToken(`planfast_token_${slug}`)
    if (newToken) {
      setEditToken(newToken)
    }
    refetch()
  }

  const fetchActivity = async () => {
    try {
      const data = await apiClient<AuditEntry[]>(`/plans/${slug}/activity`)
      setActivity(data)
    } catch { /* ignore */ }
  }

  const handleActivityToggle = () => {
    if (!showActivity) fetchActivity()
    setShowActivity(prev => !prev)
  }

  const formatAction = (entry: AuditEntry): string => {
    switch (entry.action) {
      case 'plan_created':
        return `${entry.actorName} created this plan`
      case 'plan_locked':
        return 'Plan was locked'
      case 'plan_renamed':
        return `${entry.actorName || 'Host'} renamed to "${entry.details}"`
      case 'participant_joined':
        return `${entry.actorName} joined`
      case 'availability_updated':
        return `${entry.actorName} updated availability`
      default:
        return entry.action
    }
  }

  const timeAgo = (dateStr: string): string => {
    const now = Date.now()
    const then = new Date(dateStr + 'Z').getTime()
    const diff = now - then
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="min-h-screen">
      <Header />

      <motion.div
        className="max-w-2xl mx-auto px-4 pb-12"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 sm:p-6">
        <PlanHeader plan={plan} isHost={isHost} onShare={() => setShowShare(true)} onRefetch={refetch} />

        {/* Meta info with icons */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 mb-5">
          {plan.granularity !== 'options' && (
            <span className="flex items-center gap-1 text-small text-muted-foreground">
              <svg className="w-3.5 h-3.5 text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {formatDateRange(plan.dateRangeStart, plan.dateRangeEnd)}
            </span>
          )}
          {plan.location && (
            <span className="flex items-center gap-1 text-small text-muted-foreground">
              <svg className="w-3.5 h-3.5 text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {plan.location}
            </span>
          )}
          <span className="flex items-center gap-1 text-small text-muted-foreground">
            <svg className="w-3.5 h-3.5 text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            {plan.participantCount} {plan.participantCount === 1 ? 'person' : 'people'}
          </span>
          {isLocked && <Badge variant="locked">Locked</Badge>}
        </div>

        {/* Response progress bar — show when 2+ participants */}
        {totalCount >= 2 && !needsJoin && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-tiny font-medium text-muted-foreground">
                {respondedCount} of {totalCount} responded
              </span>
              {respondedCount < totalCount && isHost && (
                <button
                  onClick={() => setShowShare(true)}
                  className="text-tiny font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Nudge
                </button>
              )}
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary/70 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(respondedCount / totalCount) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Participants with response status */}
        {plan.participants.length > 0 && (
          <div className="mb-6">
            <p className="text-tiny font-medium text-tertiary uppercase tracking-wider mb-2">Who&apos;s in</p>
            <div className="flex flex-wrap gap-1.5">
              {plan.participants.map(p => (
                <span
                  key={p.id}
                  className={`text-tiny px-2.5 py-1 rounded-full ${
                    p.hasResponded
                      ? 'bg-cell-free/15 text-emerald-800 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {p.hasResponded && (
                    <svg className="w-3 h-3 inline-block mr-0.5 -mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                  {p.displayName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="border-b border-border mb-6" />

        {needsJoin && !isLocked ? (
          <JoinForm slug={slug} onJoined={handleJoined} />
        ) : (
          <>
            {/* Identity indicator */}
            {plan.myParticipantId && (() => {
              const me = plan.participants.find(p => p.id === plan.myParticipantId)
              return me ? (
                <p className="text-tiny text-tertiary mb-4">
                  Editing as <span className="font-medium text-muted-foreground">{me.displayName}</span>
                </p>
              ) : null
            })()}
            <AvailabilityGrid plan={plan} editToken={editToken} isHost={isHost} onRefresh={refetch} isRefreshing={isRefreshing} />
          </>
        )}

        {/* Activity log */}
        <div className="mt-6 pt-4 border-t border-border">
          <button
            onClick={handleActivityToggle}
            className="flex items-center gap-1.5 text-tiny text-tertiary hover:text-muted-foreground transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Activity
            <svg className={`w-3 h-3 transition-transform ${showActivity ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showActivity && (
            <div className="mt-3 relative">
              {activity.length === 0 ? (
                <p className="text-tiny text-tertiary">No activity yet.</p>
              ) : (
                <div className="relative pl-4">
                  {/* Timeline line */}
                  <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-border" />
                  <div className="space-y-0.5">
                    {activity.map(entry => (
                      <div key={entry.id} className="relative flex items-baseline gap-3 py-1">
                        {/* Timeline dot */}
                        <div className="absolute left-[-13px] top-[7px] w-[7px] h-[7px] rounded-full bg-border shrink-0" />
                        <span className="text-tiny text-muted-foreground flex-1">{formatAction(entry)}</span>
                        <span className="text-tiny text-tertiary whitespace-nowrap shrink-0">{timeAgo(entry.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Post-lock: Plan your next thing */}
        {isLocked && (
          <motion.div
            className="mt-6 pt-6 border-t border-border text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-body font-medium text-foreground mb-1">
              That was easy.
            </p>
            <p className="text-small text-muted-foreground mb-4">
              Plan your next thing with the same group?
            </p>
            <Link href="/">
              <Button variant="primary">
                Create another plan
              </Button>
            </Link>
          </motion.div>
        )}
        </div>

        {/* Viral CTA — for non-host participants who have responded */}
        {!isHost && !needsJoin && !isLocked && (
          <motion.div
            className="mt-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <Link
              href="/"
              className="text-small text-muted-foreground hover:text-foreground transition-colors"
            >
              Planning something yourself? <span className="underline">Create your own plan</span> &rarr;
            </Link>
          </motion.div>
        )}
      </motion.div>

      {showShare && (
        <ShareSheet
          slug={slug}
          title={plan.title}
          participants={plan.participants}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}
