'use client'

import { useCallback, useRef, useState } from 'react'
import type { CellState } from '@/lib/types'

type InteractionState =
  | { type: 'idle' }
  | { type: 'pressing'; cellKey: string; timer: ReturnType<typeof setTimeout> }
  | { type: 'dragging'; paintStatus: 'free' | 'maybe'; cells: Set<string> }

const LONG_PRESS_MS = 400

export function useGridInteraction(
  getCellState: (cellKey: string) => CellState,
  onCellUpdate: (slotStart: string, slotEnd: string, status: CellState) => void,
) {
  const stateRef = useRef<InteractionState>({ type: 'idle' })
  const isTouchRef = useRef(false)
  const [renderKey, setRenderKey] = useState(0)
  const forceRender = () => setRenderKey(n => n + 1)

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

  const handlePointerDown = useCallback((cellKey: string, pointerType?: string) => {
    // Track whether this interaction is touch-based
    isTouchRef.current = pointerType === 'touch' || pointerType === 'pen'

    // Guard: only start a new interaction from idle
    if (stateRef.current.type !== 'idle') {
      if (stateRef.current.type === 'pressing') {
        clearTimeout(stateRef.current.timer)
      }
      stateRef.current = { type: 'idle' }
    }

    // On touch: skip the long-press timer (no drag mode on mobile)
    if (isTouchRef.current) {
      stateRef.current = { type: 'pressing', cellKey, timer: setTimeout(() => {}, 0) }
      return
    }

    const timer = setTimeout(() => {
      // Long press → start maybe drag (mouse only)
      if (stateRef.current.type !== 'pressing') return
      const { start, end } = parseKey(cellKey)
      onCellUpdate(start, end, 'maybe')
      stateRef.current = { type: 'dragging', paintStatus: 'maybe', cells: new Set([cellKey]) }
      forceRender()
    }, LONG_PRESS_MS)

    stateRef.current = { type: 'pressing', cellKey, timer }
  }, [onCellUpdate])

  const handlePointerEnter = useCallback((cellKey: string) => {
    // On touch devices: no drag-to-paint. Scrolling takes priority.
    if (isTouchRef.current) return

    const state = stateRef.current

    if (state.type === 'pressing' && cellKey !== state.cellKey) {
      // Moved before long press → start free drag
      clearTimeout(state.timer)
      const { start: s1, end: e1 } = parseKey(state.cellKey)
      const { start: s2, end: e2 } = parseKey(cellKey)
      onCellUpdate(s1, e1, 'free')
      onCellUpdate(s2, e2, 'free')
      stateRef.current = { type: 'dragging', paintStatus: 'free', cells: new Set([state.cellKey, cellKey]) }
      forceRender()
      return
    }

    if (state.type === 'dragging' && !state.cells.has(cellKey)) {
      const { start, end } = parseKey(cellKey)
      onCellUpdate(start, end, state.paintStatus)
      state.cells.add(cellKey)
      forceRender()
    }
  }, [onCellUpdate])

  const handlePointerUp = useCallback(() => {
    const state = stateRef.current

    if (state.type === 'pressing') {
      // Short tap → cycle state (works on both touch and mouse)
      clearTimeout(state.timer)
      const nextState = cycleCellState(state.cellKey)
      const { start, end } = parseKey(state.cellKey)
      onCellUpdate(start, end, nextState)
    }

    // Always reset to idle
    stateRef.current = { type: 'idle' }
    isTouchRef.current = false
    forceRender()
  }, [cycleCellState, onCellUpdate])

  const currentState = stateRef.current
  const isDragging = currentState.type === 'dragging'
  const dragMode: 'free' | 'maybe' | null = currentState.type === 'dragging' ? currentState.paintStatus : null

  return { handlePointerDown, handlePointerEnter, handlePointerUp, isDragging, dragMode }
}
