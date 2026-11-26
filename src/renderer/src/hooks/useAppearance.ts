import { useEffect, useState } from 'react'
import type { Appearance } from '@shared/ipc'
import { bridge } from '../services/bridge'

/** Appearance choices from the menu bar menu; no character shows until main has answered. */
export function useAppearance(): Appearance {
  const [appearance, setAppearance] = useState<Appearance>({ character: 'none' })

  useEffect(() => {
    let active = true
    const unsubscribe = bridge.onAppearance(setAppearance)
    bridge
      .getAppearance()
      .then((value) => {
        if (active) setAppearance(value)
      })
      .catch((error: unknown) => console.error('Failed to read appearance:', error))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return appearance
}
