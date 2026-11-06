// MacIsland Helper
//
// A small background app that gives MacIsland native macOS abilities:
//   - unread-count badges shown on Dock icons (Accessibility API)
//   - exact notch size of every screen (NSScreen)
//   - Touch ID with the system password fallback (LocalAuthentication)
//
// It talks to MacIsland over a private Unix socket using JSON lines. It only
// reads badge labels, app names, app icons and screen geometry; it cannot see
// notification contents, and it never sees or stores passwords (macOS shows
// and checks the Touch ID / password prompt itself).

import AppKit
import ApplicationServices
import LocalAuthentication

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

struct ScreenInfo: Encodable, Equatable {
  /// CGDirectDisplayID; matches Electron's display.id.
  let id: UInt32
  let notchWidth: Double
  let notchHeight: Double
}

/// helper -> MacIsland
struct Message: Encodable {
  let type: String
  var granted: Bool?
  var badges: [Badge]?
  var screens: [ScreenInfo]?
  var biometry: String?
  var id: String?
  var success: Bool?
  var error: String?
}

/// MacIsland -> helper
struct Request: Decodable {
  let type: String
  let id: String?
  let reason: String?
}

// MARK: - Socket link to MacIsland

final class Link: @unchecked Sendable {
  private let fd: Int32
  private let writeLock = NSLock()

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
  }

  /// Reads newline-delimited requests until MacIsland closes the socket, then exits.
  func listen(_ handle: @escaping @Sendable (Request) -> Void) {
    let descriptor = fd
    Thread.detachNewThread {
      var pending = Data()
      var buffer = [UInt8](repeating: 0, count: 4096)
      while true {
        let count = read(descriptor, &buffer, buffer.count)
        if count <= 0 { exit(0) }
        pending.append(contentsOf: buffer[0..<count])
        // Requests are tiny; anything this large is not from MacIsland.
        if pending.count > 64 * 1024 { exit(0) }
        while let newline = pending.firstIndex(of: 0x0A) {
          let line = pending[pending.startIndex..<newline]
          pending.removeSubrange(pending.startIndex...newline)
          if let request = try? JSONDecoder().decode(Request.self, from: Data(line)) { handle(request) }
        }
      }
    }
  }

  func send(_ message: Message) {
    guard var data = try? JSONEncoder().encode(message) else { return }
    data.append(0x0A)
    writeLock.lock()
    defer { writeLock.unlock() }
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

// MARK: - Screens

/// Notch size per display, from the menu bar areas either side of the camera housing.
func readScreens() -> [ScreenInfo] {
  NSScreen.screens.map { screen in
    let id = (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value ?? 0
    var notchWidth = 0.0
    if let left = screen.auxiliaryTopLeftArea, let right = screen.auxiliaryTopRightArea {
      notchWidth = max(0, screen.frame.width - left.width - right.width)
    }
    return ScreenInfo(id: id, notchWidth: notchWidth, notchHeight: notchWidth > 0 ? screen.safeAreaInsets.top : 0)
  }
}

// MARK: - Touch ID

func biometryName() -> String {
  let context = LAContext()
  _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
  return context.biometryType == .touchID ? "touchID" : "none"
}

func authErrorName(_ error: Error?) -> String {
  guard let code = (error as? LAError)?.code else { return "failed" }
  switch code {
  case .userCancel, .appCancel, .systemCancel: return "cancelled"
  case .authenticationFailed: return "failed"
  case .biometryLockout: return "lockout"
  case .passcodeNotSet: return "unavailable"
  default: return "failed"
  }
}

// MARK: - Main

@MainActor
final class Helper {
  private let link: Link
  private var granted: Bool
  private var lastBadges: [Badge]?
  private var lastScreens: [ScreenInfo]?
  private var icons: [String: String] = [:]
  private var authenticating = false

  init(link: Link, prompt: Bool) {
    self.link = link
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary
    granted = AXIsProcessTrustedWithOptions(options)
    link.send(Message(type: "permission", granted: granted))
    link.send(Message(type: "auth-capability", biometry: biometryName()))
  }

  func tick() {
    let screens = readScreens()
    if screens != lastScreens {
      lastScreens = screens
      link.send(Message(type: "screens", screens: screens))
    }

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

  /// Shows the system Touch ID sheet; macOS offers the account password as fallback.
  func authenticate(id: String, reason: String) {
    guard !authenticating else {
      link.send(Message(type: "auth-result", id: id, success: false, error: "busy"))
      return
    }
    let context = LAContext()
    guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else {
      link.send(Message(type: "auth-result", id: id, success: false, error: "unavailable"))
      return
    }
    authenticating = true
    let link = self.link
    context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, error in
      let failure = success ? nil : authErrorName(error)
      DispatchQueue.main.async {
        MainActor.assumeIsolated { self.authenticating = false }
        link.send(Message(type: "auth-result", id: id, success: success, error: failure))
      }
    }
  }
}

signal(SIGPIPE, SIG_IGN)

guard let link = Link(path: socketPath) else {
  FileHandle.standardError.write(Data("macisland-helper: cannot connect to \(socketPath)\n".utf8))
  exit(1)
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)

MainActor.assumeIsolated {
  let helper = Helper(link: link, prompt: promptForAccess)

  link.listen { request in
    guard request.type == "authenticate",
          let id = request.id, !id.isEmpty, id.count <= 64,
          let reason = request.reason, !reason.isEmpty, reason.count <= 120
    else { return }
    DispatchQueue.main.async {
      MainActor.assumeIsolated { helper.authenticate(id: id, reason: reason) }
    }
  }

  helper.tick()
  Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in
    MainActor.assumeIsolated { helper.tick() }
  }
}

// A running app loop keeps NSScreen current when displays change.
application.run()
