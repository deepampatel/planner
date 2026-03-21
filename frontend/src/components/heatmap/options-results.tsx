'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Plan, HeatmapResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

interface OptionsResultsProps {
  plan: Plan
  heatmap: HeatmapResponse
}

export function OptionsResults({ plan, heatmap }: OptionsResultsProps) {
  // Sort cells by score descending
  const sorted = useMemo(
    () => [...heatmap.cells].sort((a, b) => b.score - a.score),
    [heatmap.cells]
  )

  const bestLabel = heatmap.bestSlot?.start

  // Compute voter names per option from participant availability data
  const voterMap = useMemo(() => {
    const map = new Map<string, { free: string[]; maybe: string[] }>()
    for (const p of plan.participants) {
      for (const slot of p.availability) {
        // Options use label as both start and end
        if (slot.slotStart === slot.slotEnd) {
          const label = slot.slotStart
          if (!map.has(label)) map.set(label, { free: [], maybe: [] })
          const entry = map.get(label)!
          if (slot.status === 'free') entry.free.push(p.displayName)
          else if (slot.status === 'maybe') entry.maybe.push(p.displayName)
        }
      }
    }
    return map
  }, [plan.participants])

  if (sorted.length === 0) {
    return (
      <p className="text-small text-muted-foreground text-center py-8">
        No votes yet. Share the plan to get responses.
      </p>
    )
  }

  const totalParticipants = sorted[0]?.totalParticipants || plan.participantCount

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-2"
    >
      {/* Best option banner */}
      {bestLabel && heatmap.bestSlot && (
        <div className="mb-4 p-3 rounded-lg border border-cell-free/30 bg-cell-free/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cell-free animate-pulse-soft" />
            <span className="text-small font-medium text-foreground">Best option</span>
          </div>
          <p className="text-small text-muted-foreground mt-1">
            {bestLabel}
            {' — '}
            {heatmap.bestSlot.freeParticipants.length} free
            {(heatmap.bestSlot.maybeParticipants?.length ?? 0) > 0 && `, ${heatmap.bestSlot.maybeParticipants.length} maybe`}
          </p>
        </div>
      )}

      {/* Ranked option cards */}
      {sorted.map((cell, idx) => {
        const label = cell.slotStart
        const isBest = label === bestLabel
        const voters = voterMap.get(label)
        const freePct = totalParticipants > 0 ? (cell.freeCount / totalParticipants) * 100 : 0
        const maybePct = totalParticipants > 0 ? (cell.maybeCount / totalParticipants) * 100 : 0

        return (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              'rounded-lg border p-4 transition-all',
              isBest ? 'border-cell-free/40 bg-cell-free/5' : 'border-border'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-small font-medium text-foreground">{label}</p>
              <span className="text-tiny text-muted-foreground">
                {cell.freeCount} free{cell.maybeCount > 0 && `, ${cell.maybeCount} maybe`}
              </span>
            </div>

            {/* Vote bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              {freePct > 0 && (
                <motion.div
                  className="h-full bg-cell-free"
                  initial={{ width: 0 }}
                  animate={{ width: `${freePct}%` }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                />
              )}
              {maybePct > 0 && (
                <motion.div
                  className="h-full bg-cell-maybe"
                  initial={{ width: 0 }}
                  animate={{ width: `${maybePct}%` }}
                  transition={{ duration: 0.4, delay: idx * 0.05 + 0.1 }}
                />
              )}
            </div>

            {/* Voter names */}
            {voters && (voters.free.length > 0 || voters.maybe.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {voters.free.map(name => (
                  <span key={name} className="text-tiny px-1.5 py-0.5 rounded bg-cell-free/15 text-emerald-800 dark:text-emerald-300">
                    {name}
                  </span>
                ))}
                {voters.maybe.map(name => (
                  <span key={name} className="text-tiny px-1.5 py-0.5 rounded bg-cell-maybe/15 text-amber-700 dark:text-amber-300">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-cell-free" />
          <span className="text-tiny text-muted-foreground">Free</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-cell-maybe" />
          <span className="text-tiny text-muted-foreground">Maybe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <span className="text-tiny text-muted-foreground">No vote</span>
        </div>
      </div>
    </motion.div>
  )
}
