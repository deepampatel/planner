'use client'

import { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { CellState } from '@/lib/types'

interface GridCellProps {
  cellKey: string
  status: CellState
  onPointerDown: (cellKey: string, pointerType?: string, x?: number, y?: number) => void
  onPointerMove: (x: number, y: number) => void
  onPointerEnter: (cellKey: string) => void
  disabled?: boolean
  othersCount?: number
  cellHeight?: number
}

const statusStyles: Record<CellState, string> = {
  free: 'bg-cell-free shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]',
  maybe: 'bg-cell-maybe shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]',
  clear: 'bg-cell-empty',
}

export const GridCell = memo(function GridCell({
  cellKey,
  status,
  onPointerDown,
  onPointerMove,
  onPointerEnter,
  disabled,
  othersCount,
  cellHeight = 36,
}: GridCellProps) {
  const displayCount = othersCount ? Math.round(othersCount) : 0

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    if (e.pointerType === 'mouse') {
      e.preventDefault()
    }
    onPointerDown(cellKey, e.pointerType, e.clientX, e.clientY)
  }, [disabled, cellKey, onPointerDown])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    onPointerMove(e.clientX, e.clientY)
  }, [disabled, onPointerMove])

  const handlePointerEnter = useCallback(() => {
    if (disabled) return
    onPointerEnter(cellKey)
  }, [disabled, cellKey, onPointerEnter])

  return (
    <div
      className={cn(
        'rounded-sm transition-colors duration-100 relative',
        statusStyles[status],
        disabled
          ? 'cursor-default opacity-70'
          : 'cursor-pointer active:scale-95 active:shadow-inner select-none',
      )}
      style={{ minHeight: cellHeight }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
    >
      {displayCount > 0 && (
        <span
          className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-primary/50 text-white pointer-events-none"
          style={{ fontSize: 10, lineHeight: 1, padding: '0 3px' }}
        >
          {displayCount}
        </span>
      )}
    </div>
  )
})
