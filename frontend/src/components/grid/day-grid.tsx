'use client'

import { useMemo } from 'react'
import type { Plan, CellState } from '@/lib/types'
import { generateDayBlocks, getDatesInRange } from '@/lib/slot-utils'
import { GridCell } from './grid-cell'
import { DAY_PERIODS } from '@/lib/constants'

interface DayGridProps {
  plan: Plan
  cellStates: Map<string, CellState>
  othersMap?: Map<string, number>
  onPointerDown: (cellKey: string) => void
  onPointerEnter: (cellKey: string) => void
  onPointerUp: () => void
  disabled?: boolean
}

export function DayGrid({
  plan,
  cellStates,
  othersMap,
  onPointerDown,
  onPointerEnter,
  onPointerUp,
  disabled,
}: DayGridProps) {
  const dates = useMemo(() => getDatesInRange(plan.dateRangeStart, plan.dateRangeEnd), [plan.dateRangeStart, plan.dateRangeEnd])
  const blocks = useMemo(() => generateDayBlocks(plan.dateRangeStart, plan.dateRangeEnd), [plan.dateRangeStart, plan.dateRangeEnd])

  const periodsPerDay = DAY_PERIODS.length

  return (
    <div
      className="grid-canvas overflow-x-auto"
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Date headers */}
      <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: `64px repeat(${dates.length}, minmax(36px, 1fr))` }}>
        <div />
        {dates.map((date, i) => (
          <div key={i} className="text-tiny text-muted-foreground text-center font-medium py-1">
            <div>{date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</div>
            <div>{date.getUTCDate()}</div>
          </div>
        ))}
      </div>

      {/* Grid body: 3 rows (AM, PM, Eve) x N days */}
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `64px repeat(${dates.length}, minmax(36px, 1fr))` }}>
        {DAY_PERIODS.map((period, rowIdx) => (
          <div key={rowIdx} className="contents">
            <div className="text-tiny text-tertiary text-right pr-2 flex items-center justify-end" style={{ height: 48 }}>
              {period.label}
            </div>

            {dates.map((_, colIdx) => {
              const blockIdx = colIdx * periodsPerDay + rowIdx
              const block = blocks[blockIdx]
              if (!block) return <div key={colIdx} />

              const cellKey = `${block.start}|${block.end}`
              const status = cellStates.get(cellKey) || 'clear'

              return (
                <GridCell
                  key={cellKey}
                  cellKey={cellKey}
                  status={status}
                  onPointerDown={onPointerDown}
                  onPointerEnter={onPointerEnter}
                  disabled={disabled}
                  othersCount={othersMap?.get(cellKey)}
                  cellHeight={48}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
