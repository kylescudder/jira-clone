import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Compact, semantic chip used across V2 for filters/labels
const chipVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-md border',
    'text-[11px] font-medium',
    'transition-colors select-none',
    'focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2'
  ].join(' '),
  {
    variants: {
      variant: {
        subtle: 'bg-muted/20 text-muted-foreground border-border',
        outline: 'bg-transparent text-foreground border-border',
        solid: 'bg-primary text-primary-foreground border-transparent'
      },
      size: {
        xs: 'px-1.5 py-0.5',
        sm: 'px-2 py-0.5'
      }
    },
    defaultVariants: {
      variant: 'subtle',
      size: 'xs'
    }
  }
)

export interface ChipProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chipVariants> {
  asChild?: boolean
}

export function Chip({ className, variant, size, ...props }: ChipProps) {
  return (
    <div
      className={cn(chipVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { chipVariants }
