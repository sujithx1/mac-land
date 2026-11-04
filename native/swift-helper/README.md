# MacIsland Helper

A tiny background app that gives MacIsland native macOS abilities over a
private Unix socket (JSON lines):

- unread-count badges from Dock icons (Accessibility API)
- the exact notch size of every screen (NSScreen)
- Touch ID with the system password fallback (LocalAuthentication)

- Built by `build.sh` into `.build/MacIsland Helper.app` (run automatically by
  `npm run dev` and `npm run build`).
- Launched by MacIsland through LaunchServices, so macOS asks for
  **Accessibility** permission for "MacIsland Helper" only.
- Reads badge labels, app names and icons. It cannot read notification contents.
- Never sees passwords: macOS shows and checks the Touch ID / password sheet.
- Exits as soon as MacIsland closes the socket; MacIsland relaunches it if it
  stops unexpectedly.
