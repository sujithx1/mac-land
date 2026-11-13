import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { InUse } from '@shared/devices'
import type { SystemMonitor } from '../services/system-monitor'
import { assertTrustedSender, type TrustedSender } from './validate'

export function registerSystemIpc(monitor: SystemMonitor, inUse: () => InUse, isTrusted: TrustedSender): () => void {
  ipcMain.handle(IpcChannel.GetSystemStats, (event) => {
    assertTrustedSender(event, isTrusted)
    return monitor.latest()
  })
  ipcMain.handle(IpcChannel.GetInUse, (event) => {
    assertTrustedSender(event, isTrusted)
    return inUse()
  })
  return () => {
    ipcMain.removeHandler(IpcChannel.GetSystemStats)
    ipcMain.removeHandler(IpcChannel.GetInUse)
  }
}
