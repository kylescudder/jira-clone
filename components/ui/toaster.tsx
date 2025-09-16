'use client'

import { useEffect } from 'react'
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from '@/components/ui/toast'
import { useToast } from '@/lib/use-toast'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  // Auto-dismiss toasts after duration
  useEffect(() => {
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.id), t.duration ?? 5000)
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [toasts, dismiss])

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, onClose }) => (
        <Toast key={id} onOpenChange={(open) => !open && onClose?.()}>
          <div className='grid gap-1'>
            {title ? <ToastTitle>{title}</ToastTitle> : null}
            {description ? (
              <ToastDescription>{description}</ToastDescription>
            ) : null}
          </div>
          {action ? (
            <div className='flex items-center gap-2'>
              {action.label ? (
                <ToastAction
                  altText={action.label}
                  onClick={() => {
                    action.onClick?.()
                    dismiss(id)
                  }}
                >
                  {action.label}
                </ToastAction>
              ) : null}
              {action.secondaryLabel ? (
                <ToastAction
                  altText={action.secondaryLabel}
                  onClick={() => {
                    action.onSecondaryClick?.()
                    dismiss(id)
                  }}
                >
                  {action.secondaryLabel}
                </ToastAction>
              ) : null}
              <ToastClose />
            </div>
          ) : (
            <ToastClose />
          )}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
