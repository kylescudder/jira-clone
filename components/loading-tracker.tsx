'use client'

import { useEffect } from 'react'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TrackerStatus = 'loading' | 'success' | 'error'

interface LoadingTrackerProps {
  visible: boolean
  current: number
  total: number
  message?: string
  status?: TrackerStatus
  onClose?: () => void
  autoCloseMs?: number // used when status is success
}

export function LoadingTracker({
  visible,
  message,
  status = 'loading',
  onClose,
  autoCloseMs = 2000
}: LoadingTrackerProps) {
  useEffect(() => {
    if (!visible) return
    if (status === 'success' && autoCloseMs > 0) {
      const t = setTimeout(() => onClose?.(), autoCloseMs)
      return () => clearTimeout(t)
    }
  }, [visible, status, autoCloseMs, onClose])

  if (!visible) return null

  const isDone = status === 'success'
  const isError = status === 'error'

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-[320px] select-none',
        'shadow-lg rounded-md border',
        'bg-white text-gray-900 border-gray-200',
        'dark:bg-gray-900 dark:text-gray-100 dark:border-gray-800'
      )}
      role='status'
      aria-live='polite'
    >
      <div className='p-3 flex items-start gap-3'>
        <div className='mt-0.5'>
          {isDone ? (
            <CheckCircle2 className='h-5 w-5 text-green-500' />
          ) : isError ? (
            <X className='h-5 w-5 text-red-500' />
          ) : (
            <Loader2 className='h-5 w-5 animate-spin text-blue-500' />
          )}
        </div>
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-medium truncate'>
            {isDone
              ? 'All set!'
              : isError
                ? 'Something went wrong'
                : 'Loading data'}
          </div>
          <div className='text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate'>
            {message || (isDone ? 'Finished loading' : 'Please wait...')}
          </div>
        </div>
        <button
          aria-label='Close'
          className='ml-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800'
          onClick={onClose}
        >
          <X className='h-4 w-4' />
        </button>
      </div>
    </div>
  )
}
