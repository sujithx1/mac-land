import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, type IslandGeometry, type MacIslandBridge } from '@shared/ipc'
import type { LockState } from '@shared/lock'
import type { BrowserState } from '@shared/media'
import type { NotificationState } from '@shared/notifications'
import type { SystemStats } from '@shared/system'

/**
 * The renderer's only window into the main process. Exposes narrow,
 * typed functions; never ipcRenderer itself or any Node.js API.
 */
const bridge: MacIslandBridge = {
  setInteractive(interactive) {
    ipcRenderer.send(IpcChannel.SetInteractive, interactive === true)
  },
  getGeometry() {
    return ipcRenderer.invoke(IpcChannel.GetGeometry) as Promise<IslandGeometry>
  },
  onGeometryChanged(listener) {
    const handler = (_event: IpcRendererEvent, geometry: IslandGeometry): void => listener(geometry)
    ipcRenderer.on(IpcChannel.GeometryChanged, handler)
    return () => ipcRenderer.off(IpcChannel.GeometryChanged, handler)
  },
  getSystemStats() {
    return ipcRenderer.invoke(IpcChannel.GetSystemStats) as Promise<SystemStats | null>
  },
  onSystemStats(listener) {
    const handler = (_event: IpcRendererEvent, stats: SystemStats): void => listener(stats)
    ipcRenderer.on(IpcChannel.SystemStatsChanged, handler)
    return () => ipcRenderer.off(IpcChannel.SystemStatsChanged, handler)
  },
  getBrowserState() {
    return ipcRenderer.invoke(IpcChannel.GetBrowserState) as Promise<BrowserState>
  },
  onBrowserState(listener) {
    const handler = (_event: IpcRendererEvent, state: BrowserState): void => listener(state)
    ipcRenderer.on(IpcChannel.BrowserStateChanged, handler)
    return () => ipcRenderer.off(IpcChannel.BrowserStateChanged, handler)
  },
  sendMediaCommand(command) {
    ipcRenderer.send(IpcChannel.SendMediaCommand, command)
  },
  getNotifications() {
    return ipcRenderer.invoke(IpcChannel.GetNotifications) as Promise<NotificationState>
  },
  onNotifications(listener) {
    const handler = (_event: IpcRendererEvent, state: NotificationState): void => listener(state)
    ipcRenderer.on(IpcChannel.NotificationsChanged, handler)
    return () => ipcRenderer.off(IpcChannel.NotificationsChanged, handler)
  },
  openBadgeApp(path) {
    ipcRenderer.send(IpcChannel.OpenBadgeApp, path)
  },
  getLockState() {
    return ipcRenderer.invoke(IpcChannel.GetLockState) as Promise<LockState>
  },
  onLockState(listener) {
    const handler = (_event: IpcRendererEvent, state: LockState): void => listener(state)
    ipcRenderer.on(IpcChannel.LockStateChanged, handler)
    return () => ipcRenderer.off(IpcChannel.LockStateChanged, handler)
  },
  requestUnlock() {
    ipcRenderer.send(IpcChannel.RequestUnlock)
  }
}

contextBridge.exposeInMainWorld('macIsland', bridge)
