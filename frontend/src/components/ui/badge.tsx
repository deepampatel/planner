import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'free' | 'maybe' | 'locked'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-tiny font-medium',
        {
          default: 'bg-muted text-muted-foreground',
          free: 'bg-cell-free/20 text-cell-free',
          maybe: 'bg-cell-maybe/20 text-cell-maybe',
          locked: 'bg-primary/10 text-primary',
        }[variant],
        className
      )}
      {...props}
    />
  )
}
