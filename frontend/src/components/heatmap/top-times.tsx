'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import type { Plan, BestSlot, HeatmapResponse } from '@/lib/types'
import { apiClient } from '@/lib/api'
import { getToken } from '@/lib/token-store'
import { DAY_PERIODS } from '@/lib/constants'

interface TopTimesProps {
  plan: Plan
  isHost: boolean
  onLocked: () => void
}

function formatSlot(slot: BestSlot, granularity: string, timezone: string): string {
  const start = new Date(slot.start)
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (granularity === 'day') {
    // Day blocks are defined by their start hour in the PLAN's timezone —
    // without the period label, two windows on the same day look identical
    const hour = parseInt(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone || 'UTC' }).format(start),
      10
    )
    const period = DAY_PERIODS.slice().reverse().find(p => hour >= p.startHour)?.label
    return period ? `${day} · ${period}` : day
  }
  const end = new Date(slot.end)
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${fmt(start)} – ${fmt(end)}`
}

// "Payal, Shradha +3" instead of a five-name blame list; the +N expands
function NameList({ names, expanded, onToggle, max = 2 }: {
  names: string[]
  expanded: boolean
  onToggle: () => void
  max?: number
}) {
  if (names.length <= max) return <>{names.join(', ')}</>
  if (!expanded) {
    return (
      <>
        {names.slice(0, max).join(', ')}{' '}
        <button onClick={onToggle} className="underline hover:text-foreground transition-colors">
          +{names.length - max}
        </button>
      </>
    )
  }
  return (
    <>
      {names.join(', ')}{' '}
      <button onClick={onToggle} className="underline hover:text-foreground transition-colors">
        less
      </button>
    </>
  )
}

export function TopTimes({ plan, isHost, onLocked }: TopTimesProps) {
  const [slots, setSlots] = useState<BestSlot[]>([])
  const [lockingIdx, setLockingIdx] = useState<number | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    apiClient<HeatmapResponse>(`/plans/${plan.slug}/heatmap`)
      .then(data => setSlots(data.topSlots || []))
      .catch(() => {})
  }, [plan.slug, plan.updatedAt])

  const respondedCount = plan.participants.filter(p => p.hasResponded).length
  if (plan.granularity === 'options' || plan.participantCount < 2 || respondedCount < 2 || slots.length === 0) {
    return null
  }

  const allNames = plan.participants.map(p => p.displayName)

  const handleLock = async (slot: BestSlot, idx: number) => {
    if (!confirm(`Lock in ${formatSlot(slot, plan.granularity, plan.timezone)}? No more changes after this.`)) return
    setLockingIdx(idx)
    try {
      const hostToken = getToken(`planfast_host_${plan.slug}`)
      await apiClient(`/plans/${plan.slug}/lock`, {
        method: 'POST',
        body: { slotStart: slot.start, slotEnd: slot.end },
        editToken: hostToken || '',
      })
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
      toast.success('Locked in! 🎉')
      onLocked()
    } catch {
      toast.error('Failed to lock plan')
    } finally {
      setLockingIdx(null)
    }
  }

  return (
    <div className="mb-6">
      <p className="text-tiny font-medium text-tertiary uppercase tracking-wider mb-2">Top times</p>
      <div className="space-y-2">
        {slots.map((slot, idx) => {
          const covered = new Set([...slot.freeParticipants, ...slot.maybeParticipants])
          const missing = allNames.filter(n => !covered.has(n))
          const everyone = slot.freeParticipants.length === plan.participantCount

          return (
            <motion.div
              key={`${slot.start}|${slot.end}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                everyone ? 'border-cell-free/40 bg-cell-free/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-small font-medium text-foreground">
                  {formatSlot(slot, plan.granularity, plan.timezone)}
                </p>
                <p className="text-tiny text-muted-foreground mt-0.5">
                  {everyone ? (
                    <span className="text-emerald-700 dark:text-emerald-400">Everyone&apos;s free ✓</span>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{slot.freeParticipants.length} of {plan.participantCount} free</span>
                      {slot.maybeParticipants.length > 0 && (
                        <>
                          {' · '}
                          <NameList
                            names={slot.maybeParticipants}
                            expanded={expandedIdx === idx}
                            onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                          />
                          {' maybe'}
                        </>
                      )}
                      {missing.length > 0 && (
                        <>
                          {' · missing '}
                          <NameList
                            names={missing}
                            expanded={expandedIdx === idx}
                            onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                          />
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
              {isHost && (
                <button
                  onClick={() => handleLock(slot, idx)}
                  disabled={lockingIdx !== null}
                  className="shrink-0 text-tiny font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {lockingIdx === idx ? 'Locking…' : 'Lock it in'}
                </button>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
