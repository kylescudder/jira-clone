'use client'

import { useEffect } from 'react'
import { applyUiVersionToDom, readUiVersion } from '@/lib/ui-version'

export default function DesignInit() {
  useEffect(() => {
    const v = readUiVersion()
    applyUiVersionToDom(v)
  }, [])
  return null
}
