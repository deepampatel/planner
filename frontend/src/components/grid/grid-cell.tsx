'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { CellState } from '@/lib/types'

interface GridCellProps {
  cellKey: string
  status: CellState
  onPointerDown: (cellKey: string) => void
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
      onPointerDown={(e) => {
        if (disabled) return
        e.preventDefault()
        onPointerDown(cellKey)
      }}
      onPointerEnter={() => {
        if (disabled) return
        onPointerEnter(cellKey)
      }}
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
