'use client'

import { Button } from '@/components/ui/button'
import { useUiVersion, setUiVersion } from '@/lib/ui-version'

export function DesignToggle({ className }: { className?: string }) {
  const [ui, setUi] = useUiVersion()

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      className={className}
      onClick={() => setUi(ui === 'v2' ? 'v1' : 'v2')}
      title={`Switch to ${ui === 'v2' ? 'V1' : 'V2'} design`}
      aria-label='Toggle design version'
    >
      {ui === 'v2' ? 'Design: V2' : 'Design: V1'}
    </Button>
  )
}

export function ensureUiVersionAttribute() {
  // If consumers want to set programmatically without hook
  const ui =
    (typeof localStorage !== 'undefined'
      ? (localStorage.getItem('ui-version') as 'v1' | 'v2')
      : 'v2') || 'v2'
  try {
    document?.body?.setAttribute('data-ui', ui)
  } catch {}
}
