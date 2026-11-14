import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'

export class IpcValidationError extends Error {
  override name = 'IpcValidationError'
}

/** True for the web contents of one of our island windows. */
export type TrustedSender = (contents: WebContents) => boolean

/**
 * Only an island window's own top-level frame may talk to main. Rejects
 * messages from subframes, other windows, or anything navigated away.
 */
export function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent, isTrusted: TrustedSender): void {
  if (!isTrusted(event.sender) || event.senderFrame !== event.sender.mainFrame) {
    throw new IpcValidationError('IPC message from an untrusted sender was rejected')
  }
}

export function assertBoolean(value: unknown, name: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new IpcValidationError(`Expected "${name}" to be a boolean, received ${typeof value}`)
  }
}
