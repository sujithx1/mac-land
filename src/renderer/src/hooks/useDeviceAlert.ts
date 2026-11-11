import { useEffect, useState } from 'react'
import type { DeviceAlert } from '@shared/devices'
import { bridge } from '../services/bridge'

/** Long enough to read a device name and battery, short enough to stay out of the way. */
const ALERT_MS = 3500

/** The charger or headphones alert to show right now, or null. A new alert replaces the current one. */
export function useDeviceAlert(): DeviceAlert | null {
  const [alert, setAlert] = useState<DeviceAlert | null>(null)

  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = bridge.onDeviceAlert((next) => {
      window.clearTimeout(timer)
      setAlert(next)
      timer = window.setTimeout(() => setAlert(null), ALERT_MS)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  return alert
}
