'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'
import type { AvailabilityUpdate, CellState } from '@/lib/types'

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
    if (inflightRef.current) return // Don't send while already in-flight

    // Snapshot the current batch and clear it
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

      // On success, remove the saved entries from pending.
      // If new updates came in while we were saving, keep those.
      setPendingUpdates(prev => {
        const next = new Map(prev)
        for (const [key, status] of snapshot) {
          // Only remove if the pending value hasn't changed since we flushed
          if (next.get(key) === status) {
            next.delete(key)
          }
        }
        return next
      })

      // Refresh plan data so we see others' latest availability
      onSaveSuccessRef.current?.()
      toast.success('Availability saved')
    } catch {
      // On failure, put the snapshot back into batchRef for retry
      for (const [key, status] of snapshot) {
        if (!batchRef.current.has(key)) {
          batchRef.current.set(key, status)
        }
      }
      // Keep pending updates visible so cells don't flash back
    } finally {
      inflightRef.current = false
      setIsSaving(false)

      // If new updates accumulated while we were saving, flush again
      if (batchRef.current.size > 0) {
        debounceRef.current = setTimeout(() => {
          flushUpdates()
        }, 100)
      }
    }
  }, [])

  const updateCell = useCallback((slotStart: string, slotEnd: string, status: CellState) => {
    const key = `${slotStart}|${slotEnd}`

    batchRef.current.set(key, status)

    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.set(key, status)
      return next
    })

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      flushUpdates()
    }, 300)
  }, [flushUpdates])

  return { updateCell, pendingUpdates, isSaving, flushUpdates }
}
