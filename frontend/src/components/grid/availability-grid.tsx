'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Plan, CellState } from '@/lib/types'
import { useAvailability } from '@/hooks/use-availability'
import { useGridInteraction } from '@/hooks/use-grid-interaction'
import { TimeGrid } from './time-grid'
import { DayGrid } from './day-grid'
import { OptionsGrid } from './options-grid'
import { HeatmapOverlay } from '@/components/heatmap/heatmap-overlay'
import { daysBetween } from '@/lib/slot-utils'
import { motion, AnimatePresence } from 'framer-motion'

interface AvailabilityGridProps {
  plan: Plan
  editToken: string | null
  isHost: boolean
  onRefresh?: () => void
  isRefreshing?: boolean
  previewMode?: boolean
  onPreviewTap?: (cellKey: string) => void
}

export function AvailabilityGrid({ plan, editToken, isHost, onRefresh, isRefreshing, previewMode, onPreviewTap }: AvailabilityGridProps) {
  const [viewMode, setViewMode] = useState<'my' | 'group'>('my')
  const isLocked = plan.status === 'locked'

  const { updateCell, pendingRef, versionRef, subscribe } = useAvailability(plan.slug, editToken)

  // Subscribe to pending changes — triggers re-render only when cells change
  const [, setVersion] = useState(0)
  useEffect(() => {
    subscribe(() => setVersion(v => v + 1))
  }, [subscribe])

  // Build cell state map: server data + optimistic overlays from ref
  const cellStates = useMemo(() => {
    const map = new Map<string, CellState>()

    if (plan.myParticipantId) {
      const myParticipant = plan.participants.find(p => p.id === plan.myParticipantId)
      if (myParticipant) {
        for (const slot of myParticipant.availability) {
          const key = `${slot.slotStart}|${slot.slotEnd}`
          map.set(key, slot.status as CellState)
        }
      }
    }

    // Overlay pending (ref, not state — no extra re-render chain)
    for (const [key, status] of pendingRef.current) {
      if (status === 'clear') {
        map.delete(key)
      } else {
        map.set(key, status)
      }
    }

    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.participants, plan.myParticipantId, versionRef.current])

  // Others' counts — only recalc when plan data changes (not on local taps)
  const othersMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const participant of plan.participants) {
      if (participant.id === plan.myParticipantId) continue
      for (const slot of participant.availability) {
        const key = `${slot.slotStart}|${slot.slotEnd}`
        const weight = slot.status === 'free' ? 1 : 0.5
        map.set(key, (map.get(key) || 0) + weight)
      }
    }
    return map
  }, [plan.participants, plan.myParticipantId])

  const getCellState = useCallback((cellKey: string): CellState => {
    // Read directly from pending ref for instant, flicker-free access
    const pending = pendingRef.current.get(cellKey)
    if (pending) return pending === 'clear' ? 'clear' : pending
    return cellStates.get(cellKey) || 'clear'
  }, [cellStates, pendingRef])

  const handleCellUpdate = useCallback((slotStart: string, slotEnd: string, status: CellState) => {
    // Preview mode: intercept tap → trigger join modal
    if (previewMode && onPreviewTap) {
      onPreviewTap(`${slotStart}|${slotEnd}`)
      return
    }
    if (isLocked || !editToken) return
    updateCell(slotStart, slotEnd, status)
  }, [isLocked, editToken, updateCell, previewMode, onPreviewTap])

  const { handlePointerDown, handlePointerMove, handlePointerEnter, handlePointerUp, isDragging, dragMode } = useGridInteraction(
    getCellState,
    handleCellUpdate
  )

  const isOptions = plan.granularity === 'options'
  const days = isOptions ? 0 : daysBetween(plan.dateRangeStart, plan.dateRangeEnd)
  const useTimeGrid = plan.granularity === 'time' || days <= 3

  return (
    <div>
      {/* View toggle — hidden in preview mode */}
      {!previewMode && (
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex rounded-lg bg-muted p-0.5">
          <motion.div
            className="absolute inset-y-0.5 rounded-md bg-background shadow-subtle"
            style={{ width: 'calc(50% - 2px)' }}
            animate={{ x: viewMode === 'my' ? 2 : 'calc(100% + 2px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
          <button
            onClick={() => setViewMode('my')}
            className={`relative z-10 px-3 py-1.5 text-small font-medium rounded-md transition-colors duration-fast ${
              viewMode === 'my' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            My availability
          </button>
          <button
            onClick={() => setViewMode('group')}
            className={`relative z-10 px-3 py-1.5 text-small font-medium rounded-md transition-colors duration-fast ${
              viewMode === 'group' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Group view
          </button>
        </div>

        <div className="flex items-center gap-2">
          <AnimatePresence>
            {!isOptions && isDragging && (
              <motion.span
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                className="text-tiny font-medium px-2 py-0.5 rounded-sm bg-cell-free/15 text-emerald-800 dark:text-emerald-300"
              >
                ● Free
              </motion.span>
            )}
          </AnimatePresence>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-fast disabled:opacity-50"
              title="Refresh"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
      )}

      {/* Interaction hint */}
      {!previewMode && viewMode === 'my' && editToken && !isLocked && (
        <p className="text-tiny text-tertiary mb-3">
          {isOptions ? 'Tap to vote' : 'Tap where you\u2019re free'}
        </p>
      )}

      {viewMode === 'group' ? (
        <HeatmapOverlay plan={plan} />
      ) : isOptions ? (
        <OptionsGrid
          plan={plan}
          cellStates={cellStates}
          onCellUpdate={handleCellUpdate}
          disabled={previewMode ? false : (isLocked || !editToken)}
        />
      ) : useTimeGrid ? (
        <TimeGrid
          plan={plan}
          cellStates={cellStates}
          othersMap={othersMap}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerEnter={handlePointerEnter}
          onPointerUp={handlePointerUp}
          disabled={previewMode ? false : (isLocked || !editToken)}
        />
      ) : (
        <DayGrid
          plan={plan}
          cellStates={cellStates}
          othersMap={othersMap}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerEnter={handlePointerEnter}
          onPointerUp={handlePointerUp}
          disabled={previewMode ? false : (isLocked || !editToken)}
        />
      )}

      {/* Legend */}
      {viewMode === 'my' && !isOptions && (
        <div className="flex items-center gap-4 mt-4 text-tiny text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-cell-free" />
            <span>Free</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-cell-empty" />
            <span>Not set</span>
          </div>
        </div>
      )}
    </div>
  )
}
