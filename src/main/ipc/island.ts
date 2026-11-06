import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { Islands } from '../windows/islands'
import { IpcValidationError, assertBoolean, assertTrustedSender, type TrustedSender } from './validate'

/** Each island window asks about and changes only itself. */
export function registerIslandIpc(islands: Islands, isTrusted: TrustedSender): () => void {
  ipcMain.on(IpcChannel.SetInteractive, (event, interactive: unknown) => {
    try {
      assertTrustedSender(event, isTrusted)
      assertBoolean(interactive, 'interactive')
      islands.fromSender(event.sender)?.setInteractive(interactive)
    } catch (error) {
      console.warn(`[ipc] ${IpcChannel.SetInteractive}:`, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannel.GetGeometry, (event) => {
    assertTrustedSender(event, isTrusted)
    const island = islands.fromSender(event.sender)
    if (!island) throw new IpcValidationError('Not an island window')
    return island.geometry()
  })

  return () => {
    ipcMain.removeAllListeners(IpcChannel.SetInteractive)
    ipcMain.removeHandler(IpcChannel.GetGeometry)
  }
}
