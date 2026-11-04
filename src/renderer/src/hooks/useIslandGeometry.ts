import { useEffect, useState } from 'react'
import type { IslandGeometry } from '@shared/ipc'
import { bridge } from '../services/bridge'

/** Current island geometry from main, kept in sync with display changes. */
export function useIslandGeometry(): IslandGeometry | null {
  const [geometry, setGeometry] = useState<IslandGeometry | null>(null)

  useEffect(() => {
    let active = true
    bridge
      .getGeometry()
      .then((initial) => {
        if (active) setGeometry(initial)
      })
      .catch((error: unknown) => console.error('Failed to read island geometry:', error))

    const unsubscribe = bridge.onGeometryChanged(setGeometry)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return geometry
}
