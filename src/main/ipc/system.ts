import { ipcMain, type WebContents } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { SystemMonitor } from '../services/system-monitor'
import { assertTrustedSender } from './validate'

export function registerSystemIpc(monitor: SystemMonitor, owner: WebContents): () => void {
  ipcMain.handle(IpcChannel.GetSystemStats, (event) => {
    assertTrustedSender(event, owner)
    return monitor.latest()
  })
  return () => ipcMain.removeHandler(IpcChannel.GetSystemStats)
}
