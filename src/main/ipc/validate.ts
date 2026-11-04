import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'

export class IpcValidationError extends Error {
  override name = 'IpcValidationError'
}

/**
 * Only the island's own top-level frame may talk to main. Rejects messages
 * from subframes, other windows, or anything navigated away from our page.
 */
export function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent, owner: WebContents): void {
  if (event.sender !== owner || event.senderFrame !== owner.mainFrame) {
    throw new IpcValidationError('IPC message from an untrusted sender was rejected')
  }
}

export function assertBoolean(value: unknown, name: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new IpcValidationError(`Expected "${name}" to be a boolean, received ${typeof value}`)
  }
}
