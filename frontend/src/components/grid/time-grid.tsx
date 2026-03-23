'use client'

import { useMemo } from 'react'
import type { Plan, CellState } from '@/lib/types'
import { generateTimeSlots, getDatesInRange } from '@/lib/slot-utils'
import { GridCell } from './grid-cell'

interface TimeGridProps {
  plan: Plan
  cellStates: Map<string, CellState>
  othersMap?: Map<string, number>
  onPointerDown: (cellKey: string, pointerType?: string, x?: number, y?: number) => void
  onPointerMove: (x: number, y: number) => void
  onPointerEnter: (cellKey: string) => void
  onPointerUp: () => void
  disabled?: boolean
}

export function TimeGrid({
  plan,
  cellStates,
  othersMap,
  onPointerDown,
  onPointerMove,
  onPointerEnter,
  onPointerUp,
  disabled,
}: TimeGridProps) {
  const dates = useMemo(() => getDatesInRange(plan.dateRangeStart, plan.dateRangeEnd), [plan.dateRangeStart, plan.dateRangeEnd])
  const slots = useMemo(() => generateTimeSlots(plan.dateRangeStart, plan.dateRangeEnd), [plan.dateRangeStart, plan.dateRangeEnd])

  // Group slots by time row
  const timeLabels = useMemo(() => {
    const labels: string[] = []
    for (let hour = 8; hour < 22; hour++) {
      for (const min of [0, 30]) {
        const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
        const ampm = hour >= 12 ? 'PM' : 'AM'
        labels.push(`${h}:${min === 0 ? '00' : '30'} ${ampm}`)
      }
    }
    return labels
  }, [])

  // Build grid: rows = time slots, columns = dates
  const slotsPerDay = 28 // (22-8)*2 = 28 half-hour slots

  return (
    <div
      className="grid-canvas overflow-x-auto"
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Date headers */}
      <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: `48px repeat(${dates.length}, 1fr)` }}>
        <div /> {/* Empty corner */}
        {dates.map((date, i) => (
          <div key={i} className="text-tiny text-muted-foreground text-center font-medium py-1">
            <div>{date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</div>
            <div>{date.getUTCDate()}</div>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `48px repeat(${dates.length}, 1fr)` }}>
        {timeLabels.map((label, rowIdx) => (
          <div key={rowIdx} className="contents">
            {/* Time label */}
            <div className="text-tiny text-tertiary text-right pr-2 flex items-center justify-end" style={{ height: 36 }}>
              {rowIdx % 2 === 0 ? label : ''}
            </div>

            {/* Cells for each day */}
            {dates.map((_, colIdx) => {
              const slotIdx = colIdx * slotsPerDay + rowIdx
              const slot = slots[slotIdx]
              if (!slot) return <div key={colIdx} />

              const cellKey = `${slot.start}|${slot.end}`
              const status = cellStates.get(cellKey) || 'clear'

              return (
                <GridCell
                  key={cellKey}
                  cellKey={cellKey}
                  status={status}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerEnter={onPointerEnter}
                  disabled={disabled}
                  othersCount={othersMap?.get(cellKey)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
