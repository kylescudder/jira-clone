import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
  {
    variants: {
      variant: {
        default:
          'border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/14] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/22]',
        secondary:
          'border-[hsl(var(--secondary))/35] bg-[hsl(var(--secondary))/26] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))/36]',
        destructive:
          'border-[hsl(var(--destructive))/40] bg-[hsl(var(--destructive))/16] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/26]',
        outline:
          'border-border text-foreground hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]'
      },
      size: {
        default: 'px-2.5 py-0.5',
        compact: 'px-1.5 py-0.5 text-[11px] leading-tight gap-1'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({
  className,
  variant,
  size,
  ...props
}: BadgeProps & { size?: 'default' | 'compact' }) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
