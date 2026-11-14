import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppLock } from '../services/app-lock'
import { assertTrustedSender, type TrustedSender } from './validate'

export function registerLockIpc(appLock: AppLock, isTrusted: TrustedSender): () => void {
  ipcMain.handle(IpcChannel.GetLockState, (event) => {
    assertTrustedSender(event, isTrusted)
    return appLock.state()
  })

  ipcMain.on(IpcChannel.RequestUnlock, (event) => {
    try {
      assertTrustedSender(event, isTrusted)
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
