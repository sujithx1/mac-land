# MacIsland

A macOS Dynamic Island and app-level Face Lock, built with Electron, React,
TypeScript, Vite, Tailwind CSS v4 and Framer Motion.

**Status:** Phase 2 UI with real data only:

- Battery, CPU and memory from macOS (`pmset`, `vm_stat`, CPU times).
- Music and downloads from Brave/Chrome via the MacIsland Connector extension.
- Unread counts and app icons from Dock badges, via the native MacIsland Helper.
- Works on every display: grows out of the notch on a MacBook, floats as a pill
  on external monitors, and can follow your pointer between screens.
- App-level lock with Touch ID (system password as fallback).

## Displays

Menu bar icon > **Show Island On**:

- **MacBook Display** (default): the built-in screen; falls back to the main
  display when the lid is closed.
- **Main Display**: whichever screen has the menu bar in System Settings.
- **Display with Mouse Pointer**: the island follows you after the pointer rests
  on another screen for a moment.

The exact notch size of each screen comes from macOS via the helper.

## Lock (Touch ID)

Menu bar icon > **Lock MacIsland** hides music, downloads and notifications
until you click the island and authenticate with Touch ID or your Mac password.
**Lock When Mac Locks** does it automatically whenever your screen locks.

While unlocking, the island opens into a Face ID style card, as on iPhone:
the face glyph, a spinning scan, then a check mark (or a red face and a shake
on failure). This is only the look. Macs have no Face ID hardware; the actual
check is always Touch ID or your password.

- The lock lives in the main process; while locked the island window never
  receives the hidden data, and play/pause or open-app requests are refused.
- MacIsland never sees or stores your password: macOS shows and checks the
  Touch ID / password sheet itself (LocalAuthentication).
- The lock survives restarts. It protects MacIsland only and never touches the
  macOS login screen.

## Notifications (Dock badge counts)

MacIsland shows the unread counts apps put on their Dock icons (Mail 3,
Messages 12, ...) with each app's icon. Clicking one opens that app.

The first time you run MacIsland, macOS asks to allow **MacIsland Helper** in
System Settings > Privacy & Security > Accessibility. Turn it on. The helper
only reads badge counts, app names and icons; it cannot read message contents.
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
```

MacIsland has no Dock icon. Quit it from the pill icon in the menu bar
(**Quit MacIsland**) or with Ctrl+C in the terminal running `npm run dev`.

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
    services/settings.ts        display and lock preferences (settings.json)
    windows/placement.ts        which display the island is on, follow-pointer
  preload/index.ts          contextBridge API exposed as window.macIsland
  renderer/src/
    components/
      Island.tsx            shell: shape, spring, which content is shown
      ExpandedPanel.tsx     expanded layout and menu-bar header
      MusicPlayer.tsx, SystemStatus.tsx, Notifications.tsx, TransferProgress.tsx
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
   Battery, CPU and memory match Activity Monitor and update every 2 seconds.
