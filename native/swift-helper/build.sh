#!/bin/sh
# Builds "MacIsland Helper.app" into .build/. Skips the build when the
# binary is already newer than its sources, so `npm run dev` stays fast.
#
# The helper is its own app (launched through LaunchServices) so that macOS
# asks for Accessibility permission for this helper alone, rather than for
# the terminal or editor that started MacIsland.
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
app="$here/.build/MacIsland Helper.app"
binary="$app/Contents/MacOS/macisland-helper"
target="$(uname -m)-apple-macos13"

# Device watcher (headphones, camera and microphone in use): a plain command-line
# tool, separate from the helper app so that changing it never resets the
# helper's Accessibility permission.
watcher="$here/.build/macisland-device-watch"
if ! { [ -x "$watcher" ] && [ "$watcher" -nt "$here/DeviceWatch/main.swift" ]; }; then
  mkdir -p "$here/.build"
  xcrun swiftc -O -swift-version 5 -target "$target" "$here/DeviceWatch/main.swift" -o "$watcher"
  codesign --force --sign - --identifier app.macisland.device-watch "$watcher"
  echo "Built $watcher"
fi

if [ -x "$binary" ] && [ "$binary" -nt "$here/Sources/main.swift" ] && [ "$binary" -nt "$here/Info.plist" ]; then
  exit 0
fi

mkdir -p "$app/Contents/MacOS"
cp "$here/Info.plist" "$app/Contents/Info.plist"
xcrun swiftc -O -swift-version 5 -target "$target" "$here/Sources/main.swift" -o "$binary"
# Ad-hoc signature: macOS ties the Accessibility grant to it, so rebuilding
# the helper (only when its source changes) means granting access again.
codesign --force --sign - --identifier app.macisland.helper "$app"
echo "Built $app"
