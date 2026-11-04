# MacIsland Helper

A tiny background app that reads unread-count badges from Dock icons and
streams them to MacIsland over a Unix socket (JSON lines).

- Built by `build.sh` into `.build/MacIsland Helper.app` (run automatically by
  `npm run dev` and `npm run build`).
- Launched by MacIsland through LaunchServices, so macOS asks for
  **Accessibility** permission for "MacIsland Helper" only.
- Reads badge labels, app names and icons. It cannot read notification contents.
- Exits as soon as MacIsland closes the socket.

Phase 5 adds Touch ID (LocalAuthentication) and Keychain access here.
