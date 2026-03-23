'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Plan, HeatmapResponse, HeatmapCell } from '@/lib/types'
import { apiClient } from '@/lib/api'
import { getDatesInRange, generateTimeSlots, generateDayBlocks } from '@/lib/slot-utils'
import { DAY_PERIODS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { OptionsResults } from './options-results'

interface HeatmapOverlayProps {
  plan: Plan
}

function scoreToColor(score: number): string {
  if (score === 0) return 'bg-cell-none'
  if (score < 0.25) return 'bg-heatmap-low'
  if (score < 0.5) return 'bg-heatmap-medium-low'
  if (score < 0.75) return 'bg-heatmap-medium-high'
  return 'bg-heatmap-high'
}

function scoreToOpacity(score: number): number {
  if (score === 0) return 0.3
  return 0.4 + score * 0.6
}

export function HeatmapOverlay({ plan }: HeatmapOverlayProps) {
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(plan.participants.map(p => p.id))
  )

  const toggleParticipant = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const fetchHeatmap = useCallback(async () => {
    try {
      const params = selectedIds.size < plan.participants.length
        ? `?participants=${Array.from(selectedIds).join(',')}`
        : ''
      const data = await apiClient<HeatmapResponse>(`/plans/${plan.slug}/heatmap${params}`)
      setHeatmap(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [plan.slug, selectedIds, plan.participants.length])

  useEffect(() => {
    fetchHeatmap()
  }, [fetchHeatmap])

  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>()
    if (!heatmap) return map
    for (const cell of heatmap.cells) {
      map.set(`${cell.slotStart}|${cell.slotEnd}`, cell)
    }
    return map
  }, [heatmap])

  const dates = useMemo(() => getDatesInRange(plan.dateRangeStart, plan.dateRangeEnd), [plan.dateRangeStart, plan.dateRangeEnd])
  const useTimeGrid = plan.granularity === 'time' || dates.length <= 3

  if (loading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-7 w-full" />
        ))}
      </div>
    )
  }

  if (!heatmap) return null

  // Options mode — ranked results instead of heatmap grid
  if (plan.granularity === 'options') {
    return <OptionsResults plan={plan} heatmap={heatmap} />
  }

  const filterChips = plan.participants.length >= 3 && (
    <div className="mb-4">
      <p className="text-tiny text-tertiary mb-2">
        {selectedIds.size < plan.participants.length
          ? `Best slot for ${selectedIds.size} of ${plan.participants.length} people`
          : 'Showing all participants'
        }
      </p>
      <div className="flex flex-wrap gap-1.5">
        {plan.participants.map(p => (
          <button
            key={p.id}
            onClick={() => toggleParticipant(p.id)}
            className={`text-tiny px-2.5 py-1 rounded-full transition-colors ${
              selectedIds.has(p.id)
                ? 'bg-primary/15 text-primary font-medium'
                : 'bg-muted text-tertiary line-through'
            }`}
          >
            {p.displayName}
          </button>
        ))}
      </div>
    </div>
  )

  // Render time grid heatmap
  if (useTimeGrid) {
    const slots = generateTimeSlots(plan.dateRangeStart, plan.dateRangeEnd, plan.timezone)
    const slotsPerDay = 48 // 24 hours × 2 slots/hour
    // Generate time labels from actual slot UTC times, displayed in viewer's timezone
    const firstDaySlots = slots.slice(0, slotsPerDay)
    const timeLabels = firstDaySlots.map(slot =>
      new Date(slot.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    )

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {filterChips}

        {/* Best slot */}
        {heatmap.bestSlot && (
          <div className="mb-4 p-3 rounded-lg border border-cell-free/30 bg-cell-free/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cell-free animate-pulse-soft" />
              <span className="text-small font-medium text-foreground">Best slot found</span>
            </div>
            <p className="text-small text-muted-foreground mt-1">
              {new Date(heatmap.bestSlot.start).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              {' — '}
              {heatmap.bestSlot.freeParticipants.length} free
                          </p>
          </div>
        )}

        <div className="overflow-x-auto -mx-1 px-1">
        {/* Headers */}
        <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: `48px repeat(${dates.length}, minmax(36px, 1fr))` }}>
          <div />
          {dates.map((date, i) => (
            <div key={i} className="text-tiny text-muted-foreground text-center font-medium py-1">
              <div>{date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</div>
              <div>{date.getUTCDate()}</div>
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `48px repeat(${dates.length}, minmax(36px, 1fr))` }}>
          {timeLabels.map((label, rowIdx) => (
            <div key={rowIdx} className="contents">
              <div className="text-tiny text-tertiary text-right pr-2 flex items-center justify-end" style={{ height: 36 }}>
                {rowIdx % 2 === 0 ? label : ''}
              </div>
              {dates.map((_, colIdx) => {
                const slotIdx = colIdx * slotsPerDay + rowIdx
                const slot = slots[slotIdx]
                if (!slot) return <div key={colIdx} />
                const cellKey = `${slot.start}|${slot.end}`
                const cell = cellMap.get(cellKey)
                const score = cell?.score ?? 0

                return (
                  <div
                    key={cellKey}
                    className={cn('rounded-sm transition-colors duration-slow', scoreToColor(score))}
                    style={{ minHeight: 36, opacity: scoreToOpacity(score) }}
                    title={cell ? `${cell.freeCount} of ${cell.totalParticipants} free` : 'No data'}
                  />
                )
              })}
            </div>
          ))}
        </div>

        </div>{/* end overflow-x-auto */}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4">
          <span className="text-tiny text-tertiary">Less</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 rounded-sm bg-cell-none opacity-30" />
            <div className="w-4 h-4 rounded-sm bg-heatmap-low" />
            <div className="w-4 h-4 rounded-sm bg-heatmap-medium-low" />
            <div className="w-4 h-4 rounded-sm bg-heatmap-medium-high" />
            <div className="w-4 h-4 rounded-sm bg-heatmap-high" />
          </div>
          <span className="text-tiny text-tertiary">More available</span>
        </div>
      </motion.div>
    )
  }

  // Day grid heatmap (similar structure but with AM/PM/Eve rows)
  const blocks = generateDayBlocks(plan.dateRangeStart, plan.dateRangeEnd, plan.timezone)
  const periodsPerDay = DAY_PERIODS.length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {filterChips}

      {heatmap.bestSlot && (
        <div className="mb-4 p-3 rounded-lg border border-cell-free/30 bg-cell-free/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cell-free animate-pulse-soft" />
            <span className="text-small font-medium text-foreground">Best slot found</span>
          </div>
          <p className="text-small text-muted-foreground mt-1">
            {new Date(heatmap.bestSlot.start).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            {' — '}
            {heatmap.bestSlot.freeParticipants.length} free
          </p>
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
      <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: `64px repeat(${dates.length}, minmax(36px, 1fr))` }}>
        <div />
        {dates.map((date, i) => (
          <div key={i} className="text-tiny text-muted-foreground text-center font-medium py-1">
            <div>{date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</div>
            <div>{date.getUTCDate()}</div>
          </div>
        ))}
      </div>

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
              const cell = cellMap.get(cellKey)
              const score = cell?.score ?? 0

              return (
                <div
                  key={cellKey}
                  className={cn('rounded-sm transition-colors duration-slow', scoreToColor(score))}
                  style={{ minHeight: 48, opacity: scoreToOpacity(score) }}
                  title={cell ? `${cell.freeCount} of ${cell.totalParticipants} free` : 'No data'}
                />
              )
            })}
          </div>
        ))}
      </div>
      </div>{/* end overflow-x-auto */}

      <div className="flex items-center gap-3 mt-4">
        <span className="text-tiny text-tertiary">Less</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-4 rounded-sm bg-cell-none opacity-30" />
          <div className="w-4 h-4 rounded-sm bg-heatmap-low" />
          <div className="w-4 h-4 rounded-sm bg-heatmap-medium-low" />
          <div className="w-4 h-4 rounded-sm bg-heatmap-medium-high" />
          <div className="w-4 h-4 rounded-sm bg-heatmap-high" />
        </div>
        <span className="text-tiny text-tertiary">More available</span>
      </div>
    </motion.div>
  )
}
