import { ipcMain, type WebContents } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppLock } from '../services/app-lock'
import { assertTrustedSender } from './validate'

export function registerLockIpc(appLock: AppLock, owner: WebContents): () => void {
  ipcMain.handle(IpcChannel.GetLockState, (event) => {
    assertTrustedSender(event, owner)
    return appLock.state()
  })

  ipcMain.on(IpcChannel.RequestUnlock, (event) => {
    try {
      assertTrustedSender(event, owner)
      void appLock.unlock()
    } catch (error) {
      console.warn(`[ipc] ${IpcChannel.RequestUnlock}:`, (error as Error).message)
    }
  })

  return () => {
    ipcMain.removeHandler(IpcChannel.GetLockState)
    ipcMain.removeAllListeners(IpcChannel.RequestUnlock)
  }
}
