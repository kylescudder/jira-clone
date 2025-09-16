'use client'

import * as React from 'react'

let idSeq = 0

export type ToastActionConfig = {
  label?: string
  onClick?: () => void
  secondaryLabel?: string
  onSecondaryClick?: () => void
}

export type ToastItem = {
  id: number
  title?: string
  description?: string | React.ReactNode
  duration?: number
  action?: ToastActionConfig
  onClose?: () => void
}

type ToastContextValue = {
  toasts: ToastItem[]
  toast: (item: Omit<ToastItem, 'id'>) => number
  dismiss: (id: number) => void
  clear: () => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProviderStore({
  children
}: {
  children: React.ReactNode
}) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const toast = React.useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = ++idSeq
    setToasts((prev) => [...prev, { id, duration: 5000, ...item }])
    return id
  }, [])

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clear = React.useCallback(() => setToasts([]), [])

  const value = React.useMemo(
    () => ({ toasts, toast, dismiss, clear }),
    [toasts, toast, dismiss, clear]
  )

  return React.createElement(ToastContext.Provider, { value }, children as any)
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProviderStore')
  return ctx
}
