'use client'

import { useCallback, useRef, useState } from 'react'
import type { CellState } from '@/lib/types'

type InteractionState =
  | { type: 'idle' }
  | { type: 'pressing'; cellKey: string }
  | { type: 'dragging'; cells: Set<string> }

const TOUCH_MOVE_THRESHOLD = 8

export function useGridInteraction(
  getCellState: (cellKey: string) => CellState,
  onCellUpdate: (slotStart: string, slotEnd: string, status: CellState) => void,
) {
  const stateRef = useRef<InteractionState>({ type: 'idle' })
  const isTouchRef = useRef(false)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const touchCancelled = useRef(false)

  // Only trigger re-render for drag indicator
  const [isDragging, setIsDragging] = useState(false)

  const cycleCellState = useCallback((cellKey: string): CellState => {
    const current = getCellState(cellKey)
    return current === 'clear' ? 'free' : 'clear'
  }, [getCellState])

  const parseKey = (key: string) => {
    const [start, end] = key.split('|')
    return { start, end }
  }

  const handlePointerDown = useCallback((cellKey: string, pointerType?: string, x?: number, y?: number) => {
    isTouchRef.current = pointerType === 'touch' || pointerType === 'pen'
    touchCancelled.current = false

    if (isTouchRef.current) {
      touchStartPos.current = { x: x ?? 0, y: y ?? 0 }
    }

    stateRef.current = { type: 'pressing', cellKey }
  }, [])

  const handlePointerMove = useCallback((x: number, y: number) => {
    if (!isTouchRef.current || !touchStartPos.current) return
    const dx = Math.abs(x - touchStartPos.current.x)
    const dy = Math.abs(y - touchStartPos.current.y)
    if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
      touchCancelled.current = true
      stateRef.current = { type: 'idle' }
    }
  }, [])

  const handlePointerEnter = useCallback((cellKey: string) => {
    if (isTouchRef.current) return

    const state = stateRef.current

    // Mouse moved to new cell while pressing → start free drag
    if (state.type === 'pressing' && cellKey !== state.cellKey) {
      const { start: s1, end: e1 } = parseKey(state.cellKey)
      const { start: s2, end: e2 } = parseKey(cellKey)
      onCellUpdate(s1, e1, 'free')
      onCellUpdate(s2, e2, 'free')
      stateRef.current = { type: 'dragging', cells: new Set([state.cellKey, cellKey]) }
      setIsDragging(true)
      return
    }

    // Continue dragging — paint new cells free
    if (state.type === 'dragging' && !state.cells.has(cellKey)) {
      const { start, end } = parseKey(cellKey)
      onCellUpdate(start, end, 'free')
      state.cells.add(cellKey)
    }
  }, [onCellUpdate])

  const handlePointerUp = useCallback(() => {
    const state = stateRef.current

    if (state.type === 'pressing' && !touchCancelled.current) {
      const nextState = cycleCellState(state.cellKey)
      const { start, end } = parseKey(state.cellKey)
      onCellUpdate(start, end, nextState)
    }

    const wasDragging = state.type === 'dragging'

    stateRef.current = { type: 'idle' }
    isTouchRef.current = false
    touchStartPos.current = null
    touchCancelled.current = false

    if (wasDragging) {
      setIsDragging(false)
    }
  }, [cycleCellState, onCellUpdate])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerEnter,
    handlePointerUp,
    isDragging,
    dragMode: isDragging ? 'free' as const : null,
  }
}
