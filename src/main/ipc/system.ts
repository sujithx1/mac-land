import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { InUse } from '@shared/devices'
import type { Appearance } from '@shared/ipc'
import type { SystemMonitor } from '../services/system-monitor'
import { assertTrustedSender, type TrustedSender } from './validate'

export function registerSystemIpc(
  monitor: SystemMonitor,
  inUse: () => InUse,
  appearance: () => Appearance,
  isTrusted: TrustedSender
): () => void {
  ipcMain.handle(IpcChannel.GetSystemStats, (event) => {
    assertTrustedSender(event, isTrusted)
    return monitor.latest()
  })
  ipcMain.handle(IpcChannel.GetInUse, (event) => {
    assertTrustedSender(event, isTrusted)
    return inUse()
  })
  ipcMain.handle(IpcChannel.GetAppearance, (event) => {
    assertTrustedSender(event, isTrusted)
    return appearance()
  })
  return () => {
    ipcMain.removeHandler(IpcChannel.GetSystemStats)
    ipcMain.removeHandler(IpcChannel.GetInUse)
    ipcMain.removeHandler(IpcChannel.GetAppearance)
  }
}
