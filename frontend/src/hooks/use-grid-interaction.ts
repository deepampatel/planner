'use client'

import { useCallback, useRef, useState } from 'react'
import type { CellState } from '@/lib/types'

type InteractionState =
  | { type: 'idle' }
  | { type: 'pressing'; cellKey: string; timer: ReturnType<typeof setTimeout> }
  | { type: 'dragging'; paintStatus: 'free' | 'maybe'; cells: Set<string> }

const LONG_PRESS_MS = 400
const TOUCH_MOVE_THRESHOLD = 8

export function useGridInteraction(
  getCellState: (cellKey: string) => CellState,
  onCellUpdate: (slotStart: string, slotEnd: string, status: CellState) => void,
) {
  const stateRef = useRef<InteractionState>({ type: 'idle' })
  const isTouchRef = useRef(false)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const touchCancelled = useRef(false)

  // Only trigger re-render for drag indicator (visual feedback)
  const [dragInfo, setDragInfo] = useState<{ active: boolean; mode: 'free' | 'maybe' | null }>({
    active: false,
    mode: null,
  })

  const cycleCellState = useCallback((cellKey: string): CellState => {
    const current = getCellState(cellKey)
    switch (current) {
      case 'clear': return 'free'
      case 'free': return 'maybe'
      case 'maybe': return 'clear'
    }
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

    // Clean up stale state
    if (stateRef.current.type === 'pressing') {
      clearTimeout(stateRef.current.timer)
    }
    stateRef.current = { type: 'idle' }

    // Touch: tap only, no timers for drag
    if (isTouchRef.current) {
      stateRef.current = { type: 'pressing', cellKey, timer: setTimeout(() => {}, 0) }
      return
    }

    // Mouse: long-press starts "maybe" drag
    const timer = setTimeout(() => {
      if (stateRef.current.type !== 'pressing') return
      const { start, end } = parseKey(cellKey)
      onCellUpdate(start, end, 'maybe')
      stateRef.current = { type: 'dragging', paintStatus: 'maybe', cells: new Set([cellKey]) }
      setDragInfo({ active: true, mode: 'maybe' })
    }, LONG_PRESS_MS)

    stateRef.current = { type: 'pressing', cellKey, timer }
  }, [onCellUpdate])

  const handlePointerMove = useCallback((x: number, y: number) => {
    if (!isTouchRef.current || !touchStartPos.current) return
    const dx = Math.abs(x - touchStartPos.current.x)
    const dy = Math.abs(y - touchStartPos.current.y)
    if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
      touchCancelled.current = true
      if (stateRef.current.type === 'pressing') {
        clearTimeout(stateRef.current.timer)
        stateRef.current = { type: 'idle' }
      }
    }
  }, [])

  const handlePointerEnter = useCallback((cellKey: string) => {
    if (isTouchRef.current) return

    const state = stateRef.current

    if (state.type === 'pressing' && cellKey !== state.cellKey) {
      clearTimeout(state.timer)
      const { start: s1, end: e1 } = parseKey(state.cellKey)
      const { start: s2, end: e2 } = parseKey(cellKey)
      onCellUpdate(s1, e1, 'free')
      onCellUpdate(s2, e2, 'free')
      stateRef.current = { type: 'dragging', paintStatus: 'free', cells: new Set([state.cellKey, cellKey]) }
      setDragInfo({ active: true, mode: 'free' })
      return
    }

    if (state.type === 'dragging' && !state.cells.has(cellKey)) {
      const { start, end } = parseKey(cellKey)
      onCellUpdate(start, end, state.paintStatus)
      state.cells.add(cellKey)
    }
  }, [onCellUpdate])

  const handlePointerUp = useCallback(() => {
    const state = stateRef.current

    if (state.type === 'pressing' && !touchCancelled.current) {
      clearTimeout(state.timer)
      const nextState = cycleCellState(state.cellKey)
      const { start, end } = parseKey(state.cellKey)
      onCellUpdate(start, end, nextState)
    }

    const wasDragging = state.type === 'dragging'

    stateRef.current = { type: 'idle' }
    isTouchRef.current = false
    touchStartPos.current = null
    touchCancelled.current = false

    // Only trigger re-render if drag indicator was showing
    if (wasDragging) {
      setDragInfo({ active: false, mode: null })
    }
  }, [cycleCellState, onCellUpdate])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerEnter,
    handlePointerUp,
    isDragging: dragInfo.active,
    dragMode: dragInfo.mode,
  }
}
