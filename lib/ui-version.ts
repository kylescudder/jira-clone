'use client'

import { useEffect, useState } from 'react'

export type UiVersion = 'v1' | 'v2'
export const UI_VERSION_KEY = 'ui-version'

// Lock the app to V2 only
export function readUiVersion(): UiVersion {
  return 'v2'
}

export function applyUiVersionToDom(v: UiVersion) {
  if (typeof document === 'undefined') return
  try {
    document.body?.setAttribute('data-ui', 'v2')
  } catch {}
}

export function setUiVersion(_v: UiVersion) {
  try {
    // Always enforce V2
    localStorage.setItem(UI_VERSION_KEY, 'v2')
    applyUiVersionToDom('v2')
    // Notify any listeners in this tab (detail is always 'v2')
    window.dispatchEvent(new CustomEvent('ui-version-change', { detail: 'v2' }))
  } catch {}
}

export function useUiVersion(): [UiVersion, (v: UiVersion) => void] {
  const [v, setV] = useState<UiVersion>('v2')

  useEffect(() => {
    // Ensure DOM attribute is set once to V2
    const init = readUiVersion()
    setV('v2')
    applyUiVersionToDom(init)

    const onStorage = (e: StorageEvent) => {
      if (e.key === UI_VERSION_KEY) {
        // Force V2 on any storage change
        setV('v2')
        applyUiVersionToDom('v2')
      }
    }
    const onCustom = (_e: Event) => {
      // Force V2 on any custom change
      setV('v2')
      applyUiVersionToDom('v2')
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('ui-version-change', onCustom as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('ui-version-change', onCustom as EventListener)
    }
  }, [])

  const update = (_nv: UiVersion) => {
    setUiVersion('v2')
    setV('v2')
  }

  return [v, update]
}
