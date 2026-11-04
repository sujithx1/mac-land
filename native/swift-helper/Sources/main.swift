// MacIsland Helper
//
// Reads the unread-count badges shown on Dock icons (Mail 3, WhatsApp 5, ...)
// and streams them to MacIsland as JSON lines over a Unix socket.
// It only reads badge labels, app names and app icons; it cannot see
// notification contents. Requires Accessibility permission, which macOS
// grants to this helper app specifically.

import AppKit
import ApplicationServices

// MARK: - Arguments

let arguments = CommandLine.arguments

func argument(_ name: String) -> String? {
  guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else { return nil }
  return arguments[index + 1]
}

guard let socketPath = argument("--socket") else {
  FileHandle.standardError.write(Data("usage: macisland-helper --socket <path> [--no-prompt]\n".utf8))
  exit(64)
}
/// Tests pass --no-prompt so they never raise the system permission dialog.
let promptForAccess = !arguments.contains("--no-prompt")

// MARK: - Messages

struct Badge: Encodable, Equatable {
  let app: String
  let path: String
  let label: String
  let icon: String?
}

struct Message: Encodable {
  let type: String
  var granted: Bool?
  var badges: [Badge]?
}

// MARK: - Socket link to MacIsland

final class Link {
  private let fd: Int32

  init?(path: String) {
    fd = socket(AF_UNIX, SOCK_STREAM, 0)
    guard fd >= 0 else { return nil }

    var address = sockaddr_un()
    address.sun_family = sa_family_t(AF_UNIX)
    let bytes = Array(path.utf8)
    guard bytes.count < MemoryLayout.size(ofValue: address.sun_path) else { return nil }
    withUnsafeMutableBytes(of: &address.sun_path) { $0.copyBytes(from: bytes) }

    let connected = withUnsafePointer(to: &address) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
      }
    }
    guard connected == 0 else {
      close(fd)
      return nil
    }

    // MacIsland closes the socket when it quits; reading EOF is our cue to exit too.
    let descriptor = fd
    Thread.detachNewThread {
      var buffer = [UInt8](repeating: 0, count: 256)
      while read(descriptor, &buffer, buffer.count) > 0 {}
      exit(0)
    }
  }

  func send(_ message: Message) {
    guard var data = try? JSONEncoder().encode(message) else { return }
    data.append(0x0A)
    let delivered = data.withUnsafeBytes { raw -> Bool in
      var offset = 0
      while offset < raw.count {
        let written = write(fd, raw.baseAddress! + offset, raw.count - offset)
        if written <= 0 { return false }
        offset += written
      }
      return true
    }
    if !delivered { exit(0) }
  }
}

// MARK: - Dock badges

func attribute<T>(_ element: AXUIElement, _ name: String) -> T? {
  var value: CFTypeRef?
  guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
  return value as? T
}

/// The app's icon as a 64px PNG data URL.
func icon(forAppAt path: String) -> String? {
  guard !path.isEmpty else { return nil }
  let size = 64
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
  ) else { return nil }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  NSWorkspace.shared.icon(forFile: path).draw(in: NSRect(x: 0, y: 0, width: size, height: size))
  NSGraphicsContext.restoreGraphicsState()

  guard let png = bitmap.representation(using: .png, properties: [:]) else { return nil }
  return "data:image/png;base64," + png.base64EncodedString()
}

func readDockBadges(icon: (String) -> String?) -> [Badge] {
  guard let dock = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.dock").first else {
    return []
  }
  let root = AXUIElementCreateApplication(dock.processIdentifier)
  var badges: [Badge] = []

  for list in attribute(root, kAXChildrenAttribute) as [AXUIElement]? ?? [] {
    for item in attribute(list, kAXChildrenAttribute) as [AXUIElement]? ?? [] {
      guard
        (attribute(item, kAXSubroleAttribute) as String?) == "AXApplicationDockItem",
        let label = attribute(item, "AXStatusLabel") as String?, !label.isEmpty,
        let title = attribute(item, kAXTitleAttribute) as String?
      else { continue }
      let path = (attribute(item, kAXURLAttribute) as URL?)?.path ?? ""
      badges.append(Badge(app: title, path: path, label: label, icon: icon(path)))
    }
  }
  return badges
}

// MARK: - Main loop

signal(SIGPIPE, SIG_IGN)

guard let link = Link(path: socketPath) else {
  FileHandle.standardError.write(Data("macisland-helper: cannot connect to \(socketPath)\n".utf8))
  exit(1)
}

/// Polls permission and badges on the main thread, sending only changes.
@MainActor
final class Watcher {
  private let link: Link
  private var granted: Bool
  private var lastBadges: [Badge]?
  private var icons: [String: String] = [:]

  init(link: Link, prompt: Bool) {
    self.link = link
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary
    granted = AXIsProcessTrustedWithOptions(options)
    link.send(Message(type: "permission", granted: granted))
  }

  func tick() {
    let trusted = AXIsProcessTrusted()
    if trusted != granted {
      granted = trusted
      link.send(Message(type: "permission", granted: granted))
    }
    guard granted else { return }

    let badges = readDockBadges { path in
      if let cached = icons[path] { return cached }
      let encoded = icon(forAppAt: path)
      icons[path] = encoded
      return encoded
    }
    if badges != lastBadges {
      lastBadges = badges
      link.send(Message(type: "badges", badges: badges))
    }
  }
}

MainActor.assumeIsolated {
  let watcher = Watcher(link: link, prompt: promptForAccess)
  watcher.tick()
  Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in
    MainActor.assumeIsolated { watcher.tick() }
  }
}
RunLoop.main.run()
