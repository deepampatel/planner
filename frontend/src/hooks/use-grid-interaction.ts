'use client'

import { useCallback, useRef, useState } from 'react'
import type { CellState } from '@/lib/types'

type InteractionState =
  | { type: 'idle' }
  | { type: 'pressing'; cellKey: string; timer: ReturnType<typeof setTimeout> }
  | { type: 'dragging'; paintStatus: 'free' | 'maybe'; cells: Set<string> }

const LONG_PRESS_MS = 400
// If the finger moves more than this many pixels, it's a scroll not a tap
const TOUCH_MOVE_THRESHOLD = 8

export function useGridInteraction(
  getCellState: (cellKey: string) => CellState,
  onCellUpdate: (slotStart: string, slotEnd: string, status: CellState) => void,
) {
  const stateRef = useRef<InteractionState>({ type: 'idle' })
  const isTouchRef = useRef(false)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const touchCancelled = useRef(false)
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

  const handlePointerDown = useCallback((cellKey: string, pointerType?: string, x?: number, y?: number) => {
    // Track whether this interaction is touch-based
    isTouchRef.current = pointerType === 'touch' || pointerType === 'pen'
    touchCancelled.current = false

    if (isTouchRef.current) {
      touchStartPos.current = { x: x ?? 0, y: y ?? 0 }
    }

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

  const handlePointerMove = useCallback((x: number, y: number) => {
    // Only relevant for touch — detect if finger moved (scrolling)
    if (!isTouchRef.current || !touchStartPos.current) return
    const dx = Math.abs(x - touchStartPos.current.x)
    const dy = Math.abs(y - touchStartPos.current.y)
    if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
      // Finger moved too much — this is a scroll, cancel the tap
      touchCancelled.current = true
      if (stateRef.current.type === 'pressing') {
        clearTimeout(stateRef.current.timer)
        stateRef.current = { type: 'idle' }
      }
    }
  }, [])

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

    if (state.type === 'pressing' && !touchCancelled.current) {
      // Short tap → cycle state (only if finger didn't move)
      clearTimeout(state.timer)
      const nextState = cycleCellState(state.cellKey)
      const { start, end } = parseKey(state.cellKey)
      onCellUpdate(start, end, nextState)
    }

    // Always reset
    stateRef.current = { type: 'idle' }
    isTouchRef.current = false
    touchStartPos.current = null
    touchCancelled.current = false
    forceRender()
  }, [cycleCellState, onCellUpdate])

  const currentState = stateRef.current
  const isDragging = currentState.type === 'dragging'
  const dragMode: 'free' | 'maybe' | null = currentState.type === 'dragging' ? currentState.paintStatus : null

  return { handlePointerDown, handlePointerMove, handlePointerEnter, handlePointerUp, isDragging, dragMode }
}
