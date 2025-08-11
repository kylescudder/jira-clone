import * as React from 'react'
import { cn } from '@/lib/utils'

interface KeyboardKeyProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'xs' | 'sm'
  title?: string
}

export function KeyboardKey({
  className,
  children,
  size = 'sm',
  title,
  ...props
}: KeyboardKeyProps) {
  // Style to mimic the small, rounded, outline badge used for filter counts
  const sizeClasses =
    size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'

  return (
    <span
      aria-label={
        typeof children === 'string'
          ? `Keyboard key ${children}`
          : 'Keyboard key'
      }
      title={title}
      className={cn(
        // Base layout
        'inline-flex select-none items-center justify-center align-middle',
        // Outline pill like the filter count badge
        'rounded-full border font-medium leading-none',
        // Neutral colors to blend with badges; allow parent to override via className
        'border-gray-300 bg-transparent text-gray-700',
        'dark:border-gray-700 dark:bg-transparent dark:text-gray-200',
        // Compact sizing
        sizeClasses,
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export default KeyboardKey
