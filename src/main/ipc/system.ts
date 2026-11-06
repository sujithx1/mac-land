import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { SystemMonitor } from '../services/system-monitor'
import { assertTrustedSender, type TrustedSender } from './validate'

export function registerSystemIpc(monitor: SystemMonitor, isTrusted: TrustedSender): () => void {
  ipcMain.handle(IpcChannel.GetSystemStats, (event) => {
    assertTrustedSender(event, isTrusted)
    return monitor.latest()
  })
  return () => ipcMain.removeHandler(IpcChannel.GetSystemStats)
}
