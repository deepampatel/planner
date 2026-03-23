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

  const handleToggle = useCallback((label: string) => {
    if (disabled) return
    const key = `${label}|${label}`
    const current = cellStates.get(key)
    const newStatus: CellState = current === 'free' ? 'clear' : 'free'
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
                <button
                  type="button"
                  onClick={() => handleToggle(opt.label)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-tiny font-medium transition-all duration-fast',
                    status === 'free'
                      ? 'bg-cell-free text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-cell-free/15 hover:text-emerald-800 dark:hover:text-emerald-300'
                  )}
                >
                  {status === 'free' ? '✓ Free' : 'Free'}
                </button>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
