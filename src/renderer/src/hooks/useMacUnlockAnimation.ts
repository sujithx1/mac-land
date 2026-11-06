import { useEffect, useState } from 'react'
import { bridge } from '../services/bridge'
import type { FaceIdStage } from '../components/island/FaceIdGlyph'

/**
 * The card opens with the face straight away, so it already covers the
 * island if MacIsland's own lock opens too. The face stays up while the
 * macOS lock screen fades away, so the check mark is actually seen.
 */
const FACE_MS = 850
/** Long enough for the circle and check mark to draw and be read. */
const SUCCESS_MS = 1200

/**
 * After the Mac is unlocked, plays face then check mark, like an iPhone
 * after Face ID. Returns the stage to show, or null when idle.
 */
export function useMacUnlockAnimation(): FaceIdStage | null {
  const [stage, setStage] = useState<FaceIdStage | null>(null)

  useEffect(() => {
    let timers: number[] = []
    const clear = (): void => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers = []
    }

    const unsubscribe = bridge.onMacUnlocked(() => {
      clear()
      setStage('face')
      const at = (ms: number, next: FaceIdStage | null): void => {
        timers.push(window.setTimeout(() => setStage(next), ms))
      }
      at(FACE_MS, 'success')
      at(FACE_MS + SUCCESS_MS, null)
    })

    return () => {
      unsubscribe()
      clear()
    }
  }, [])

  return stage
}
