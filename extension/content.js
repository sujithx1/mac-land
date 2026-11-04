// @ts-check
/**
 * Runs on supported media sites. Reports the page's player state to the
 * service worker and carries out play/pause/skip commands.
 * Uses only the page's own media elements and Media Session metadata.
 */

/** @typedef {import('../src/shared/browser-bridge').TabMedia} TabMedia */
/** @typedef {import('../src/shared/browser-bridge').ContentMessage} ContentMessage */
/** @typedef {import('../src/shared/browser-bridge').WorkerMessage} WorkerMessage */
/** @typedef {import('../src/shared/media').MediaCommand} MediaCommand */

/**
 * @typedef {object} Site
 * @property {string} name
 * @property {string | null} next      selector for the site's own next button
 * @property {string | null} previous  selector for the site's own previous button
 */

/** @type {Array<Site & { host: RegExp }>} */
const SITES = [
  { host: /^music\.youtube\.com$/, name: 'YouTube Music', next: '.next-button', previous: '.previous-button' },
  { host: /(^|\.)youtube\.com$/, name: 'YouTube', next: '.ytp-next-button', previous: '.ytp-prev-button' },
  { host: /(^|\.)soundcloud\.com$/, name: 'SoundCloud', next: '.skipControl__next', previous: '.skipControl__previous' },
  {
    host: /^open\.spotify\.com$/,
    name: 'Spotify',
    next: '[data-testid="control-button-skip-forward"]',
    previous: '[data-testid="control-button-skip-back"]'
  },
  { host: /^music\.apple\.com$/, name: 'Apple Music', next: null, previous: null }
]

const REPORT_INTERVAL_MS = 1000
/** Like a hardware "previous" key: restart the track unless we are near its start. */
const RESTART_THRESHOLD_S = 3

/** @type {{ __macIslandLoaded?: boolean }} */
const isolatedGlobal = /** @type {any} */ (globalThis)

if (!isolatedGlobal.__macIslandLoaded) {
  isolatedGlobal.__macIslandLoaded = true
  start()
}

function start() {
  /** @type {Site} */
  const site = SITES.find((s) => s.host.test(location.hostname)) ?? { name: location.hostname, next: null, previous: null }
  let lastKey = ''
  let lastPositionSent = -1
  /** Kept so a paused player rewound to 0:00 is still recognised as the one in use. */
  /** @type {HTMLMediaElement | null} */
  let lastPlayed = null

  /** The element that is (or was last) actually playing; muted previews and empty players are ignored. */
  function findMedia() {
    const elements = /** @type {HTMLMediaElement[]} */ ([...document.querySelectorAll('video, audio')])
    const usable = elements.filter((el) => el.readyState > 0 && !el.muted && (el.duration > 0 || !el.paused))
    const playing = usable.find((el) => !el.paused && !el.ended)
    if (playing) lastPlayed = playing
    if (lastPlayed && !usable.includes(lastPlayed)) lastPlayed = null
    return (
      playing ??
      lastPlayed ??
      usable.filter((el) => el.currentTime > 0).sort((a, b) => (b.duration || 0) - (a.duration || 0))[0] ??
      null
    )
  }

  /** @param {readonly MediaImage[] | undefined} artwork */
  function largestArtwork(artwork) {
    if (!artwork || artwork.length === 0) return null
    const area = (/** @type {MediaImage} */ image) => {
      const [w, h] = (image.sizes ?? '').split(/[x ]/i).map(Number)
      return (w || 0) * (h || 0)
    }
    const best = [...artwork].sort((a, b) => area(b) - area(a))[0]
    try {
      return best ? new URL(best.src, location.href).href : null
    } catch {
      return null
    }
  }

  function youtubeFallback() {
    const id = new URLSearchParams(location.search).get('v')
    const channel = document.querySelector('#owner #channel-name a, ytd-video-owner-renderer #channel-name a')
    return {
      title: document.title.replace(/^\(\d+\)\s*/, '').replace(/\s+-\s+YouTube$/, ''),
      artist: channel?.textContent?.trim() ?? '',
      artworkUrl: id ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : null
    }
  }

  /** @returns {TabMedia | null} */
  function readState() {
    const media = findMedia()
    const session = navigator.mediaSession
    const metadata = session?.metadata ?? null
    const sessionPlaying = session?.playbackState === 'playing'
    if (!media && !(metadata && sessionPlaying)) return null

    const fallback = site.name === 'YouTube' ? youtubeFallback() : { title: document.title, artist: '', artworkUrl: null }
    const title = metadata?.title?.trim() || fallback.title.trim()
    if (!title) return null

    return {
      title,
      artist: metadata?.artist?.trim() || fallback.artist,
      album: metadata?.album?.trim() ?? '',
      artworkUrl: largestArtwork(metadata?.artwork) ?? fallback.artworkUrl,
      isPlaying: media ? !media.paused && !media.ended : sessionPlaying,
      position: media && Number.isFinite(media.currentTime) ? media.currentTime : 0,
      // Live streams report Infinity.
      duration: media && Number.isFinite(media.duration) ? media.duration : 0,
      site: site.name
    }
  }

  /** @param {ContentMessage} message */
  function send(message) {
    // The extension was reloaded or removed; this copy of the script is orphaned.
    if (!chrome.runtime?.id) {
      clearInterval(timer)
      return
    }
    chrome.runtime.sendMessage(message).catch(() => undefined)
  }

  /** Sends on any change, and once a second while playing so the progress bar moves. */
  function report(force = false) {
    const state = readState()
    const key = JSON.stringify(state && { ...state, position: 0 })
    const position = Math.floor(state?.position ?? 0)
    const ticking = state?.isPlaying === true && position !== lastPositionSent
    if (!force && key === lastKey && !ticking) return
    lastKey = key
    lastPositionSent = position
    send({ type: 'media', media: state })
  }

  /** @param {string | null} selector */
  function clickControl(selector) {
    const control = selector ? document.querySelector(selector) : null
    if (!(control instanceof HTMLElement) || control.getClientRects().length === 0) return false
    if (control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return false
    control.click()
    return true
  }

  /** @param {MediaCommand} command */
  function run(command) {
    const media = findMedia()
    switch (command) {
      case 'toggle':
        if (media?.paused) media.play().catch(() => undefined)
        else media?.pause()
        break
      case 'next':
        clickControl(site.next)
        break
      case 'previous':
        if (media && media.currentTime > RESTART_THRESHOLD_S) media.currentTime = 0
        else if (!clickControl(site.previous) && media) media.currentTime = 0
        break
    }
    setTimeout(() => report(true), 250)
  }

  chrome.runtime.onMessage.addListener((/** @type {WorkerMessage} */ message) => {
    if (message?.type === 'command') run(message.command)
    else if (message?.type === 'report') report(true)
  })

  // Media events do not bubble, but they do pass through the capture phase.
  for (const type of ['play', 'pause', 'ended', 'loadedmetadata', 'durationchange', 'seeked', 'emptied', 'volumechange']) {
    document.addEventListener(type, () => report(), true)
  }
  window.addEventListener('pagehide', () => send({ type: 'media', media: null }))

  const timer = setInterval(() => report(), REPORT_INTERVAL_MS)
  report(true)
}
