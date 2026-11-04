import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { IslandWindow } from '../windows/island'
import { assertBoolean, assertTrustedSender } from './validate'

export function registerIslandIpc(island: IslandWindow): () => void {
  const owner = island.window.webContents

  ipcMain.on(IpcChannel.SetInteractive, (event, interactive: unknown) => {
    try {
      assertTrustedSender(event, owner)
      assertBoolean(interactive, 'interactive')
      island.setInteractive(interactive)
    } catch (error) {
      console.warn(`[ipc] ${IpcChannel.SetInteractive}:`, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannel.GetGeometry, (event) => {
    assertTrustedSender(event, owner)
    return island.geometry()
  })

  return () => {
    ipcMain.removeAllListeners(IpcChannel.SetInteractive)
    ipcMain.removeHandler(IpcChannel.GetGeometry)
  }
}
