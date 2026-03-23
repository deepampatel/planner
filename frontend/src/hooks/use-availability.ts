'use client'

import { useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api'
import type { AvailabilityUpdate, CellState } from '@/lib/types'

const DEBOUNCE_MS = 500

export function useAvailability(slug: string, editToken: string | null) {
  // All state in refs — no React re-renders for internal bookkeeping.
  // The parent reads pendingRef.current directly via getCellState.
  const pendingRef = useRef<Map<string, CellState>>(new Map())
  const batchRef = useRef<Map<string, CellState>>(new Map())
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const inflightRef = useRef(false)
  const slugRef = useRef(slug)
  const tokenRef = useRef(editToken)
  const versionRef = useRef(0) // increments on each change for external subscribers
  const subscriberRef = useRef<() => void>()
  slugRef.current = slug
  tokenRef.current = editToken

  const notify = () => {
    versionRef.current++
    subscriberRef.current?.()
  }

  const flushUpdates = useCallback(async () => {
    const currentToken = tokenRef.current
    const currentSlug = slugRef.current
    if (!currentToken || batchRef.current.size === 0) return
    if (inflightRef.current) return

    const snapshot = new Map(batchRef.current)
    batchRef.current.clear()

    const updates: AvailabilityUpdate[] = Array.from(snapshot.entries()).map(([key, status]) => {
      const [slotStart, slotEnd] = key.split('|')
      return { slotStart, slotEnd, status }
    })

    inflightRef.current = true

    try {
      await apiClient(`/plans/${currentSlug}/availability`, {
        method: 'PUT',
        body: { updates },
        editToken: currentToken,
      })
      // Don't clear pending or refetch — optimistic state is already correct.
      // Server data will sync on next manual refresh or group view load.
    } catch {
      for (const [key, status] of snapshot) {
        if (!batchRef.current.has(key)) {
          batchRef.current.set(key, status)
        }
      }
    } finally {
      inflightRef.current = false
      if (batchRef.current.size > 0) {
        debounceRef.current = setTimeout(flushUpdates, 100)
      }
    }
  }, [])

  const updateCell = useCallback((slotStart: string, slotEnd: string, status: CellState) => {
    const key = `${slotStart}|${slotEnd}`
    batchRef.current.set(key, status)
    pendingRef.current.set(key, status)

    // Notify subscriber (triggers single re-render in grid)
    notify()

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(flushUpdates, DEBOUNCE_MS)
  }, [flushUpdates])

  // Allow parent to subscribe for re-renders
  const subscribe = useCallback((cb: () => void) => {
    subscriberRef.current = cb
  }, [])

  return {
    updateCell,
    pendingRef,
    versionRef,
    subscribe,
    isSavingRef: inflightRef,
    flushUpdates,
  }
}
