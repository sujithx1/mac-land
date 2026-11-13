# MacIsland

A macOS Dynamic Island and app-level Face Lock, built with Electron, React,
TypeScript, Vite, Tailwind CSS v4 and Framer Motion.

**Status:** Phase 2 UI with real data only:

- Battery level and charging state from macOS (`pmset`), beside the notch.
- Music and downloads from Brave/Chrome via the MacIsland Connector extension.
- Unread counts and app icons from Dock badges, via the native MacIsland Helper.
- Works on every display: grows out of the notch on a MacBook, floats as a pill
  on external monitors, and can show on one, several or all of your screens.
- App-level lock with Touch ID (system password as fallback).
- Charger and Bluetooth headphones alerts: the island briefly widens with the
  battery level when you plug in or your earbuds connect.
- Camera and microphone in use: a green or orange dot beside the notch.

## Displays

Menu bar icon > **Show Island On** lists every connected screen by name.
Tick one or more; each ticked screen gets its own island, all showing the same
music, notifications and lock. Islands never move between screens.

- **MacBook Display** is the default; with the lid closed, the main display.
- **All Displays** puts an island on every screen, including ones you plug in
  later.
- A ticked monitor is remembered by name, so it gets its island back when you
  reconnect it. While none of your ticked screens is connected, the island
  goes back to the default.

The exact notch size of each screen comes from macOS via the helper.

## Lock (Touch ID)

Menu bar icon > **Lock MacIsland** hides music, downloads and notifications
until you click the island and authenticate with Touch ID or your Mac password.
**Lock When Mac Locks** does it automatically whenever your screen locks.

While unlocking, the island opens into a Face ID style card, as on iPhone:
the face glyph, a spinning scan, then a green face with a green check (or a red face and a shake
on failure). This is only the look. Macs have no Face ID hardware; the actual
check is always Touch ID or your password.

When you unlock the Mac itself (Touch ID or password at the macOS lock
screen), the island plays the same face and check mark animation. It only
reacts after macOS has unlocked; it never touches the lock screen. Turn it
off with **Face ID Animation on Unlock** in the menu bar menu.

With **Lock When Mac Locks** on, unlocking the Mac also opens MacIsland,
because macOS has just checked Touch ID or your password. A lock you set
yourself with **Lock MacIsland** stays locked until MacIsland's own Touch ID,
and so does a lock restored after a restart.

- The lock lives in the main process; while locked the island window never
  receives the hidden data, and play/pause or open-app requests are refused.
- MacIsland never sees or stores your password: macOS shows and checks the
  Touch ID / password sheet itself (LocalAuthentication).
- The lock survives restarts. It protects MacIsland only and never touches the
  macOS login screen.

## Charger and headphones

When you plug in the charger, the island briefly widens to show "Charging"
and the battery level, like an iPhone. When Bluetooth headphones connect
(AirPods, earbuds, a headset), it shows their name and battery; for earbuds
that is the lower of the two buds. Headphones that do not report a battery
show "Connected". Turn it off with **Show Charging and Headphones** in the
menu bar menu.

- Neither needs a permission. A small watcher (`macisland-device-watch`) asks
  Core Audio for the names of connected Bluetooth audio devices; it never
  opens a device or records audio. Battery levels come from `system_profiler`.
- Headphone names are personal, so like music they are not shown while
  MacIsland is locked. The charging alert is.

## Camera and microphone in use

While any app uses a camera, a green dot shows just right of the notch (in
the middle of the floating pill on other screens, and beside the battery in
the expanded island). While an app records from the microphone, the dot is
orange. It shows even while MacIsland is locked, because it is a privacy
signal rather than personal data.

- The same watcher reads this without any permission: CoreMediaIO reports
  whether each camera is running, and Core Audio (macOS 14.2 and later)
  reports which apps are recording. It never opens a camera or microphone.
- macOS's own always-on speech listeners ("Hey Siri", dictation, Sound
  Recognition) are ignored, as the macOS menu bar indicator does.
- It cannot tell which app is using the camera; macOS does not share that.

## Notifications (Dock badge counts)

MacIsland shows the unread counts apps put on their Dock icons (Mail 3,
Messages 12, ...) with each app's icon. Clicking one opens that app.

This needs **MacIsland Helper** turned on in System Settings > Privacy &
Security > Accessibility. MacIsland never pops up the macOS permission dialog
by itself; while access is missing, the menu bar icon's menu has **Allow
Notification Counts…**, which opens that settings page. The helper only reads
badge counts, app names and icons; it cannot read message contents.
Rebuilding the helper (only when `native/swift-helper/Sources/main.swift`
changes) means allowing it again.

## Browser extension (music and downloads)

1. Open `brave://extensions` (or `chrome://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `extension/` folder in this project.
3. Play something on YouTube, YouTube Music, SoundCloud, Spotify Web or Apple Music web.

The extension talks only to MacIsland on this Mac (`ws://127.0.0.1:47652`), and
MacIsland accepts connections only from this extension's fixed ID. If Brave asks
whether the extension may access local network devices, allow it.

## Commands

```bash
npm install
npm run dev        # run with hot reload
npm run typecheck  # strict TypeScript for main/preload, renderer and extension
npm run build      # typecheck + production bundle into out/
npm run preview    # run the production bundle
npm run dist       # build MacIsland.app and dist/MacIsland-<version>-arm64.dmg
```

MacIsland has no Dock icon. Quit it from the pill icon in the menu bar
(**Quit MacIsland**) or with Ctrl+C in the terminal running `npm run dev`.

## Install on your Mac

1. `npm run dist`, then open `dist/MacIsland-<version>-arm64.dmg` and drag
   **MacIsland** into Applications (or copy `dist/mac-arm64/MacIsland.app`).
2. Quit any copy started with `npm run dev`; only one MacIsland runs at a time.
3. Open MacIsland from Applications, then allow **MacIsland Helper** in
   System Settings > Privacy & Security > Accessibility. The installed helper
   is a different app from the development one, so it needs its own approval.
4. Menu bar icon > **Open at Login** starts it automatically (installed app only).

The app is signed ad-hoc, which is enough on the Mac that built it. A copy
downloaded on another Mac shows "cannot verify the developer" until it is
allowed once under System Settings > Privacy & Security > **Open Anyway**;
a paid Apple Developer ID with notarization removes that step.

## Layout

```
src/
  shared/ipc.ts             IPC channel names and payload types (single source of truth)
  main/
    index.ts                app lifecycle, single-instance lock, Dock hiding
    security.ts             permission denial, navigation and popup blocking
    tray.ts                 menu bar icon with Quit
    ipc/                    IPC handlers + sender and input validation
    windows/island.ts       transparent NSPanel-style host window
    windows/geometry.ts     display -> island geometry (notch vs floating)
    services/system-monitor.ts  battery, CPU and memory sampling
    services/browser-bridge.ts  local WebSocket server for the extension
    services/native-helper.ts   launches the Swift helper: badges, screens, Touch ID
    services/app-lock.ts        lock state machine and data gating
    services/settings.ts        display, lock and alert preferences (settings.json)
    services/device-alerts.ts   charger and headphones connecting, camera and mic in use
    windows/islands.ts          one island window per chosen display
  preload/index.ts          contextBridge API exposed as window.macIsland
  renderer/src/
    components/
      Island.tsx            shell: shape, spring, which content is shown
      ExpandedPanel.tsx     expanded layout and menu-bar header
      MusicPlayer.tsx, Notifications.tsx, TransferProgress.tsx
      island/               compact ears, equalizer, notch shoulders
      ui/                   artwork, progress bar/ring, icon button
    hooks/                  geometry sync, activity snapshot, hover/expand/collapse
    services/
      activity/             live data source (system stats from main)
      island-layout.ts      pure size rules for idle/compact/expanded
      island-interaction.ts pure expand/collapse state machine
      presentation.ts       what the compact island and header show
    types/activity.ts       the snapshot every component reads
extension/                  Brave/Chrome extension: media + downloads
native/swift-helper/        MacIsland Helper (Swift): Dock badges, screen notch sizes, Touch ID
native/swift-helper/DeviceWatch/ macisland-device-watch: Bluetooth audio devices, camera and mic in use
```

## Testing on macOS

1. `npm run dev`. A black island appears at the top centre of the main display.
   On a notched MacBook it extends the camera housing; elsewhere it floats as a pill.
2. Hover it: it widens and deepens with a spring. Move away: it settles back.
3. Click the menu bar items to the left and right of the island: they still work,
   because transparent areas of the window pass clicks through.
4. Switch to a full-screen app and to another Space: the island stays visible.
5. Change the display resolution in System Settings > Displays: the island re-centres.
6. Click the island to expand it; move the pointer away to collapse.
   The battery percentage beside the notch matches the one in the menu bar.
