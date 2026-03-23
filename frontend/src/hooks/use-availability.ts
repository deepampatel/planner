'use client'

import { useCallback, useRef, useState } from 'react'
import { apiClient } from '@/lib/api'
import type { AvailabilityUpdate, CellState } from '@/lib/types'

const DEBOUNCE_MS = 500 // Wait 500ms after last change before flushing

export function useAvailability(slug: string, editToken: string | null, onSaveSuccess?: () => void) {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, CellState>>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const batchRef = useRef<Map<string, CellState>>(new Map())
  const slugRef = useRef(slug)
  const tokenRef = useRef(editToken)
  const inflightRef = useRef(false)
  const onSaveSuccessRef = useRef(onSaveSuccess)
  slugRef.current = slug
  tokenRef.current = editToken
  onSaveSuccessRef.current = onSaveSuccess

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
    setIsSaving(true)

    try {
      await apiClient(`/plans/${currentSlug}/availability`, {
        method: 'PUT',
        body: { updates },
        editToken: currentToken,
      })

      setPendingUpdates(prev => {
        const next = new Map(prev)
        for (const [key, status] of snapshot) {
          if (next.get(key) === status) {
            next.delete(key)
          }
        }
        return next
      })

      onSaveSuccessRef.current?.()
    } catch {
      // On failure, put back for retry
      for (const [key, status] of snapshot) {
        if (!batchRef.current.has(key)) {
          batchRef.current.set(key, status)
        }
      }
    } finally {
      inflightRef.current = false
      setIsSaving(false)

      // Drain any updates that came in while saving
      if (batchRef.current.size > 0) {
        debounceRef.current = setTimeout(flushUpdates, 100)
      }
    }
  }, [])

  const updateCell = useCallback((slotStart: string, slotEnd: string, status: CellState) => {
    const key = `${slotStart}|${slotEnd}`

    // Merge into batch (last write wins — handles rapid taps on same cell)
    batchRef.current.set(key, status)

    // Optimistic UI
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.set(key, status)
      return next
    })

    // Reset debounce timer — waits for user to stop interacting
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(flushUpdates, DEBOUNCE_MS)
  }, [flushUpdates])

  return { updateCell, pendingUpdates, isSaving, flushUpdates }
}
