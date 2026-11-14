import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import { MEDIA_COMMANDS, type MediaCommand } from '@shared/media'
import { visibleBrowserState } from '../services/app-lock'
import type { BrowserBridge } from '../services/browser-bridge'
import { IpcValidationError, assertTrustedSender, type TrustedSender } from './validate'

function assertMediaCommand(value: unknown): asserts value is MediaCommand {
  if (!MEDIA_COMMANDS.includes(value as MediaCommand)) {
    throw new IpcValidationError(`Unknown media command: ${String(value)}`)
  }
}

export function registerBrowserIpc(bridge: BrowserBridge, isTrusted: TrustedSender, isLocked: () => boolean): () => void {
  ipcMain.handle(IpcChannel.GetBrowserState, (event) => {
    assertTrustedSender(event, isTrusted)
    return visibleBrowserState(bridge.state(), isLocked())
  })

  ipcMain.on(IpcChannel.SendMediaCommand, (event, command: unknown) => {
    try {
      assertTrustedSender(event, isTrusted)
      assertMediaCommand(command)
      if (isLocked()) throw new IpcValidationError('MacIsland is locked')
      bridge.sendCommand(command)
    } catch (error) {
      console.warn(`[ipc] ${IpcChannel.SendMediaCommand}:`, (error as Error).message)
    }
  })

  return () => {
    ipcMain.removeHandler(IpcChannel.GetBrowserState)
    ipcMain.removeAllListeners(IpcChannel.SendMediaCommand)
  }
}
