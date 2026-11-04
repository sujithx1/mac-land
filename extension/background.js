// @ts-check
/**
 * Service worker: keeps a WebSocket to MacIsland on this Mac, forwards the
 * playing tab and active downloads, and routes play/pause/skip back to the tab.
 */

/** @typedef {import('../src/shared/browser-bridge').TabMedia} TabMedia */
/** @typedef {import('../src/shared/browser-bridge').BrowserDownload} BrowserDownload */
/** @typedef {import('../src/shared/browser-bridge').ExtensionMessage} ExtensionMessage */
/** @typedef {import('../src/shared/browser-bridge').ContentMessage} ContentMessage */
/** @typedef {import('../src/shared/browser-bridge').WorkerMessage} WorkerMessage */
/** @typedef {import('../src/shared/media').MediaCommand} MediaCommand */

// Keep in sync with BRIDGE_HOST, BRIDGE_PORT and PROTOCOL_VERSION in src/shared/browser-bridge.ts.
const BRIDGE_URL = 'ws://127.0.0.1:47652'
const PROTOCOL_VERSION = 1
const MEDIA_COMMANDS = ['toggle', 'next', 'previous']

/** WebSocket traffic keeps an MV3 service worker alive; Chrome idles it after 30s. */
const KEEPALIVE_MS = 20_000
const DOWNLOAD_POLL_MS = 1000
/** How long a finished download stays visible in the island. */
const FINISHED_VISIBLE_MS = 4000

/** @type {Map<number, { media: TabMedia, changedAt: number }>} */
const tabs = new Map()
/** @type {WebSocket | null} */
let socket = null
/** @type {ReturnType<typeof setInterval> | undefined} */
let keepalive
let lastMedia = ''
let lastDownloads = ''

// ---------------------------------------------------------------- connection

function browserName() {
  const brands = /** @type {{ userAgentData?: { brands?: { brand: string }[] } }} */ (navigator).userAgentData?.brands ?? []
  const names = brands.map((b) => b.brand)
  return names.find((n) => /Brave|Edge|Opera|Arc|Vivaldi/.test(n)) ?? names.find((n) => /Chrome/.test(n)) ?? 'Browser'
}

/** @param {ExtensionMessage} message */
function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return
  const ws = new WebSocket(BRIDGE_URL)
  socket = ws

  ws.onopen = () => {
    send({ type: 'hello', version: PROTOCOL_VERSION, browser: browserName() })
    publishMedia(true)
    void refreshDownloads(true)
    clearInterval(keepalive)
    keepalive = setInterval(() => send({ type: 'ping' }), KEEPALIVE_MS)
  }

  ws.onmessage = (event) => {
    let message
    try {
      message = JSON.parse(String(event.data))
    } catch {
      return
    }
    if (message?.type === 'command' && MEDIA_COMMANDS.includes(message.command)) {
      routeCommand(/** @type {MediaCommand} */ (message.command))
    }
  }

  // MacIsland not running is the normal case; the alarm below retries quietly.
  ws.onerror = () => undefined
  ws.onclose = () => {
    if (socket === ws) socket = null
    clearInterval(keepalive)
  }
}

chrome.alarms.create('reconnect', { periodInMinutes: 0.5 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'reconnect') connect()
})

// --------------------------------------------------------------------- media

/** The tab that is playing wins; otherwise the one that changed most recently. */
function activeTab() {
  /** @type {[number, { media: TabMedia, changedAt: number }] | null} */
  let best = null
  for (const entry of tabs) {
    const current = best?.[1]
    const candidate = entry[1]
    const better =
      !current ||
      (candidate.media.isPlaying && !current.media.isPlaying) ||
      (candidate.media.isPlaying === current.media.isPlaying && candidate.changedAt > current.changedAt)
    if (better) best = entry
  }
  return best
}

function publishMedia(force = false) {
  const media = activeTab()?.[1].media ?? null
  const serialized = JSON.stringify(media)
  if (!force && serialized === lastMedia) return
  lastMedia = serialized
  send({ type: 'media', media })
}

/** @param {MediaCommand} command */
function routeCommand(command) {
  const active = activeTab()
  if (!active) return
  /** @type {WorkerMessage} */
  const message = { type: 'command', command }
  chrome.tabs.sendMessage(active[0], message).catch(() => tabs.delete(active[0]))
}

chrome.runtime.onMessage.addListener((/** @type {ContentMessage} */ message, sender) => {
  const tabId = sender.tab?.id
  if (tabId === undefined || sender.id !== chrome.runtime.id || message?.type !== 'media') return

  const previous = tabs.get(tabId)
  if (message.media) {
    const changed = !previous || previous.media.isPlaying !== message.media.isPlaying || previous.media.title !== message.media.title
    tabs.set(tabId, { media: message.media, changedAt: changed ? Date.now() : previous.changedAt })
  } else {
    tabs.delete(tabId)
  }
  connect()
  publishMedia()
})

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabs.delete(tabId)) publishMedia()
})

// ----------------------------------------------------------------- downloads

/** @type {Map<number, { bytes: number, at: number, rate: number }>} */
const progress = new Map()
/** @type {Map<number, number>} */
const finishedAt = new Map()
/** @type {ReturnType<typeof setInterval> | undefined} */
let downloadTimer

/** @param {string} path */
const basename = (path) => path.split(/[\\/]/).filter(Boolean).pop() ?? ''

async function refreshDownloads(force = false) {
  const items = await chrome.downloads.search({ orderBy: ['-startTime'], limit: 20 })
  const now = Date.now()
  /** @type {BrowserDownload[]} */
  const downloads = []

  for (const item of items) {
    if (item.state === 'interrupted') continue
    const done = item.state === 'complete'
    const previous = progress.get(item.id)

    if (done) {
      // Only show completions we watched happen, and only briefly.
      if (!previous) continue
      const at = finishedAt.get(item.id) ?? now
      finishedAt.set(item.id, at)
      if (now - at > FINISHED_VISIBLE_MS) {
        progress.delete(item.id)
        finishedAt.delete(item.id)
        continue
      }
    }

    let rate = previous?.rate ?? 0
    if (!done) {
      const seconds = previous ? (now - previous.at) / 1000 : 0
      const instant = previous && seconds > 0 ? Math.max(0, (item.bytesReceived - previous.bytes) / seconds) : 0
      rate = previous ? previous.rate * 0.6 + instant * 0.4 : 0
      progress.set(item.id, { bytes: item.bytesReceived, at: now, rate })
    }

    downloads.push({
      id: item.id,
      name: basename(item.filename) || basename(new URL(item.finalUrl || item.url).pathname) || 'Download',
      bytesReceived: item.bytesReceived,
      totalBytes: item.totalBytes > 0 ? item.totalBytes : 0,
      bytesPerSecond: done ? 0 : Math.round(rate),
      done
    })
  }

  const serialized = JSON.stringify(downloads)
  if (force || serialized !== lastDownloads) {
    lastDownloads = serialized
    send({ type: 'downloads', downloads })
  }

  // Poll only while there is something to show.
  if (downloads.length > 0 && downloadTimer === undefined) {
    downloadTimer = setInterval(() => void refreshDownloads(), DOWNLOAD_POLL_MS)
  } else if (downloads.length === 0 && downloadTimer !== undefined) {
    clearInterval(downloadTimer)
    downloadTimer = undefined
  }
}

chrome.downloads.onCreated.addListener(() => {
  connect()
  void refreshDownloads()
})
chrome.downloads.onChanged.addListener(() => void refreshDownloads())

// ------------------------------------------------------------------ lifecycle

/** Content scripts declared in the manifest only reach tabs opened after install. */
async function injectIntoOpenTabs() {
  const matches = chrome.runtime.getManifest().content_scripts?.flatMap((script) => script.matches ?? []) ?? []
  const openTabs = await chrome.tabs.query({ url: matches })
  for (const tab of openTabs) {
    if (tab.id === undefined) continue
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).catch(() => undefined)
  }
}

/** A restarted worker has lost what tabs reported; ask them again. */
async function requestReports() {
  const matches = chrome.runtime.getManifest().content_scripts?.flatMap((script) => script.matches ?? []) ?? []
  /** @type {WorkerMessage} */
  const message = { type: 'report' }
  for (const tab of await chrome.tabs.query({ url: matches })) {
    if (tab.id !== undefined) chrome.tabs.sendMessage(tab.id, message).catch(() => undefined)
  }
}

chrome.runtime.onInstalled.addListener(() => void injectIntoOpenTabs())
connect()
void requestReports()
void refreshDownloads()
