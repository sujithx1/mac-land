import { ipcMain, shell, type WebContents } from 'electron'
import { IpcChannel } from '@shared/ipc'
import { visibleNotifications } from '../services/app-lock'
import type { NativeHelper } from '../services/native-helper'
import { IpcValidationError, assertTrustedSender } from './validate'

export function registerNotificationIpc(helper: NativeHelper, owner: WebContents, isLocked: () => boolean): () => void {
  ipcMain.handle(IpcChannel.GetNotifications, (event) => {
    assertTrustedSender(event, owner)
    return visibleNotifications(helper.notifications(), isLocked())
  })

  ipcMain.on(IpcChannel.OpenBadgeApp, (event, path: unknown) => {
    try {
      assertTrustedSender(event, owner)
      if (isLocked()) throw new IpcValidationError('MacIsland is locked')
      // Only apps the Dock is currently showing a badge for can be opened.
      const badge = helper.notifications().badges.find((b) => b.path !== '' && b.path === path)
      if (!badge) throw new IpcValidationError('Not a badged app')
      void shell.openPath(badge.path)
    } catch (error) {
      console.warn(`[ipc] ${IpcChannel.OpenBadgeApp}:`, (error as Error).message)
    }
  })

  return () => {
    ipcMain.removeHandler(IpcChannel.GetNotifications)
    ipcMain.removeAllListeners(IpcChannel.OpenBadgeApp)
  }
}
