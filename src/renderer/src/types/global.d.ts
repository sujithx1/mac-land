import type { MacIslandBridge } from '@shared/ipc'

declare global {
  interface Window {
    /** Present when running inside Electron; absent in a plain browser preview. */
    readonly macIsland?: MacIslandBridge
  }
}

export {}
