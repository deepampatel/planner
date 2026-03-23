'use client'

import { useMemo, useRef, useEffect } from 'react'
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

const SLOTS_PER_DAY = 48 // 24 hours × 2 slots/hour
const DEFAULT_SCROLL_ROW = 16 // 8 AM = row 16 (8 hours × 2 slots/hour)
const ROW_HEIGHT = 36

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
  const slots = useMemo(() => generateTimeSlots(plan.dateRangeStart, plan.dateRangeEnd, plan.timezone), [plan.dateRangeStart, plan.dateRangeEnd, plan.timezone])
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  // Generate time labels from actual slot UTC times, displayed in viewer's timezone
  const timeLabels = useMemo(() => {
    if (slots.length === 0) return []
    const firstDaySlots = slots.slice(0, SLOTS_PER_DAY)
    return firstDaySlots.map(slot => {
      const d = new Date(slot.start)
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    })
  }, [slots])

  // Auto-scroll to 8 AM on first render
  useEffect(() => {
    if (hasScrolled.current || !scrollRef.current) return
    hasScrolled.current = true
    scrollRef.current.scrollTop = DEFAULT_SCROLL_ROW * (ROW_HEIGHT + 2) // row height + gap
  }, [timeLabels])

  return (
    <div
      ref={scrollRef}
      className="grid-canvas overflow-x-auto overflow-y-auto"
      style={{ maxHeight: `${14 * (ROW_HEIGHT + 2)}px` }} // Show ~14 rows (7 hours) at a time
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Date headers — sticky at top */}
      <div className="grid gap-0.5 mb-1 sticky top-0 bg-card z-10" style={{ gridTemplateColumns: `48px repeat(${dates.length}, 1fr)` }}>
        <div />
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
            {/* Time label — show every hour */}
            <div className="text-tiny text-tertiary text-right pr-2 flex items-center justify-end" style={{ height: ROW_HEIGHT }}>
              {rowIdx % 2 === 0 ? label : ''}
            </div>

            {/* Cells for each day */}
            {dates.map((_, colIdx) => {
              const slotIdx = colIdx * SLOTS_PER_DAY + rowIdx
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
