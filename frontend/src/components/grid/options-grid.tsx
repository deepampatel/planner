'use client'

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Plan, CellState } from '@/lib/types'

interface OptionsGridProps {
  plan: Plan
  cellStates: Map<string, CellState>
  onCellUpdate: (slotStart: string, slotEnd: string, status: CellState) => void
  disabled?: boolean
}

export function OptionsGrid({ plan, cellStates, onCellUpdate, disabled }: OptionsGridProps) {
  const options = plan.customOptions ?? []

  const handleVote = useCallback((label: string, vote: 'free' | 'maybe') => {
    if (disabled) return
    const key = `${label}|${label}`
    const current = cellStates.get(key)
    // Toggle: if already this vote, clear it. Otherwise set it.
    const newStatus: CellState = current === vote ? 'clear' : vote
    onCellUpdate(label, label, newStatus)
  }, [disabled, cellStates, onCellUpdate])

  return (
    <div className="space-y-2">
      {options.map((opt, idx) => {
        const key = `${opt.label}|${opt.label}`
        const status = cellStates.get(key) || 'clear'

        return (
          <motion.div
            key={opt.label}
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              'rounded-lg border p-4 transition-all duration-fast',
              status === 'free' && 'border-cell-free/40 bg-cell-free/5',
              status === 'maybe' && 'border-cell-maybe/40 bg-cell-maybe/5',
              status === 'clear' && 'border-border',
              disabled && 'opacity-70'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-small font-medium text-foreground">{opt.label}</p>
                {opt.description && (
                  <p className="text-tiny text-muted-foreground mt-0.5">{opt.description}</p>
                )}
              </div>

              {!disabled && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleVote(opt.label, 'free')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-tiny font-medium transition-all duration-fast',
                      status === 'free'
                        ? 'bg-cell-free text-white shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-cell-free/15 hover:text-emerald-800 dark:hover:text-emerald-300'
                    )}
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVote(opt.label, 'maybe')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-tiny font-medium transition-all duration-fast',
                      status === 'maybe'
                        ? 'bg-cell-maybe text-white shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-cell-maybe/15 hover:text-amber-700 dark:hover:text-amber-300'
                    )}
                  >
                    Maybe
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-tiny text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-cell-free" />
          <span>Free</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-cell-maybe" />
          <span>Maybe</span>
        </div>
      </div>
    </div>
  )
}
