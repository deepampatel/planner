'use client'

import { memo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { CellState } from '@/lib/types'

interface GridCellProps {
  cellKey: string
  status: CellState
  onPointerDown: (cellKey: string, pointerType?: string) => void
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
  onPointerEnter,
  disabled,
  othersCount,
  cellHeight = 36,
}: GridCellProps) {
  const displayCount = othersCount ? Math.round(othersCount) : 0

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    // On touch devices: don't preventDefault (allow scroll) and don't enable drag.
    // On mouse: preventDefault to enable drag-to-paint.
    if (e.pointerType === 'mouse') {
      e.preventDefault()
    }
    onPointerDown(cellKey, e.pointerType)
  }, [disabled, cellKey, onPointerDown])

  const handlePointerEnter = useCallback(() => {
    if (disabled) return
    onPointerEnter(cellKey)
  }, [disabled, cellKey, onPointerEnter])

  return (
    <motion.div
      className={cn(
        'rounded-sm transition-colors duration-150 relative',
        statusStyles[status],
        disabled
          ? 'cursor-default opacity-70'
          : 'cursor-pointer active:shadow-inner select-none',
      )}
      style={{ minHeight: cellHeight }}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      layout
    >
      {displayCount > 0 && (
        <span
          className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-primary/50 text-white pointer-events-none"
          style={{ fontSize: 10, lineHeight: 1, padding: '0 3px' }}
        >
          {displayCount}
        </span>
      )}
    </motion.div>
  )
})
