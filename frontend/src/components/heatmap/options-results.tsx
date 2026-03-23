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
  const sorted = useMemo(
    () => [...heatmap.cells].sort((a, b) => b.score - a.score),
    [heatmap.cells]
  )

  const bestLabel = heatmap.bestSlot?.start

  // Compute voter names per option
  const voterMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const p of plan.participants) {
      for (const slot of p.availability) {
        if (slot.slotStart === slot.slotEnd && slot.status === 'free') {
          const label = slot.slotStart
          if (!map.has(label)) map.set(label, [])
          map.get(label)!.push(p.displayName)
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
            {bestLabel} — {heatmap.bestSlot.freeParticipants.length} free
          </p>
        </div>
      )}

      {/* Ranked option cards */}
      {sorted.map((cell, idx) => {
        const label = cell.slotStart
        const isBest = label === bestLabel
        const voters = voterMap.get(label) ?? []
        const freePct = totalParticipants > 0 ? (cell.freeCount / totalParticipants) * 100 : 0

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
                {cell.freeCount} of {totalParticipants} free
              </span>
            </div>

            {/* Vote bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              {freePct > 0 && (
                <motion.div
                  className="h-full bg-cell-free"
                  initial={{ width: 0 }}
                  animate={{ width: `${freePct}%` }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                />
              )}
            </div>

            {/* Voter names */}
            {voters.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {voters.map(name => (
                  <span key={name} className="text-tiny px-1.5 py-0.5 rounded bg-cell-free/15 text-emerald-800 dark:text-emerald-300">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )
      })}
    </motion.div>
  )
}
