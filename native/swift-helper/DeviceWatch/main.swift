// macisland-device-watch: prints one JSON line on start and again whenever
// something MacIsland shows about devices changes:
//
//   {"bluetooth":["Sujith's AirPods Pro"],"camera":false,"microphone":true}
//
// - bluetooth:  names of connected Bluetooth audio devices (headphones connecting)
// - camera:     any camera is in use by any app
// - microphone: any app other than macOS's own speech listeners is recording
//
// It only reads device and process state through Core Audio and CoreMediaIO;
// it never opens a camera or microphone, so it needs no permission. It is a
// plain command-line tool, separate from MacIsland Helper, so changing it
// never resets the helper's Accessibility permission.

import CoreAudio
import CoreMediaIO
import Foundation

// MARK: Core Audio

func audioAddress(_ selector: AudioObjectPropertySelector) -> AudioObjectPropertyAddress {
  AudioObjectPropertyAddress(
    mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
}

func audioProperty<T>(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector, _ initial: T) -> T? {
  var address = audioAddress(selector)
  var value = initial
  var size = UInt32(MemoryLayout<T>.size)
  let status = withUnsafeMutablePointer(to: &value) { AudioObjectGetPropertyData(object, &address, 0, nil, &size, $0) }
  return status == noErr ? value : nil
}

func audioString(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
  guard let value = audioProperty(object, selector, Unmanaged<CFString>?.none) else { return nil }
  return value?.takeRetainedValue() as String?
}

func audioObjects(_ selector: AudioObjectPropertySelector) -> [AudioObjectID] {
  var address = audioAddress(selector)
  var size: UInt32 = 0
  let system = AudioObjectID(kAudioObjectSystemObject)
  guard AudioObjectGetPropertyDataSize(system, &address, 0, nil, &size) == noErr, size > 0 else { return [] }
  var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
  guard AudioObjectGetPropertyData(system, &address, 0, nil, &size, &ids) == noErr else { return [] }
  return ids
}

/// Names only. Headphones usually appear twice (output and microphone) under one name.
func bluetoothDevices() -> [String] {
  var names = Set<String>()
  for id in audioObjects(kAudioHardwarePropertyDevices) {
    guard let transport = audioProperty(id, kAudioDevicePropertyTransportType, UInt32(0)),
      transport == kAudioDeviceTransportTypeBluetooth || transport == kAudioDeviceTransportTypeBluetoothLE,
      let name = audioString(id, kAudioObjectPropertyName), !name.isEmpty
    else { continue }
    names.insert(name)
  }
  return names.sorted()
}

/// macOS keeps these listening in the background ("Hey Siri", dictation, Sound
/// Recognition). The macOS menu bar indicator ignores them, and so do we.
let backgroundListeners = [
  "com.apple.corespeech", "com.apple.siri", "com.apple.assistant", "com.apple.speech",
  "com.apple.accessibility.heard",
]

func isBackgroundListener(_ bundleID: String?) -> Bool {
  guard let id = bundleID?.lowercased() else { return false }
  return backgroundListeners.contains { id.hasPrefix($0) }
}

/// Audio processes, which macOS lists from 14.2 on; older systems report no microphone use.
func audioProcesses() -> [AudioObjectID] {
  guard #available(macOS 14.2, *) else { return [] }
  return audioObjects(kAudioHardwarePropertyProcessObjectList)
}

func microphoneInUse() -> Bool {
  guard #available(macOS 14.2, *) else { return false }
  return audioProcesses().contains { process in
    audioProperty(process, kAudioProcessPropertyIsRunningInput, UInt32(0)) == 1
      && !isBackgroundListener(audioString(process, kAudioProcessPropertyBundleID))
  }
}

// MARK: CoreMediaIO (cameras)

func cmioAddress(_ selector: Int) -> CMIOObjectPropertyAddress {
  CMIOObjectPropertyAddress(
    mSelector: CMIOObjectPropertySelector(selector),
    mScope: CMIOObjectPropertyScope(kCMIOObjectPropertyScopeWildcard),
    mElement: CMIOObjectPropertyElement(kCMIOObjectPropertyElementWildcard))
}

func cameras() -> [CMIOObjectID] {
  var address = cmioAddress(kCMIOHardwarePropertyDevices)
  let system = CMIOObjectID(kCMIOObjectSystemObject)
  var size: UInt32 = 0
  guard CMIOObjectGetPropertyDataSize(system, &address, 0, nil, &size) == 0, size > 0 else { return [] }
  var ids = [CMIOObjectID](repeating: 0, count: Int(size) / MemoryLayout<CMIOObjectID>.size)
  var used: UInt32 = 0
  guard CMIOObjectGetPropertyData(system, &address, 0, nil, size, &used, &ids) == 0 else { return [] }
  return ids
}

func cameraInUse() -> Bool {
  cameras().contains { camera in
    var address = cmioAddress(kCMIODevicePropertyDeviceIsRunningSomewhere)
    var running: UInt32 = 0
    var used: UInt32 = 0
    let status = CMIOObjectGetPropertyData(camera, &address, 0, nil, UInt32(MemoryLayout<UInt32>.size), &used, &running)
    return status == 0 && running != 0
  }
}

// MARK: Reporting

struct State: Encodable, Equatable {
  let bluetooth: [String]
  let camera: Bool
  let microphone: Bool
}

var last: State?
let encoder = JSONEncoder()
encoder.outputFormatting = .sortedKeys

func report() {
  let state = State(bluetooth: bluetoothDevices(), camera: cameraInUse(), microphone: microphoneInUse())
  guard state != last, let data = try? encoder.encode(state) else { return }
  last = state
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data("\n".utf8))
}

// MARK: Listeners

// Each audio process and camera gets a listener once; the lists themselves are
// watched so that apps and cameras appearing later are covered too.
var watchedProcesses = Set<AudioObjectID>()
var watchedCameras = Set<CMIOObjectID>()

func watchProcesses() {
  guard #available(macOS 14.2, *) else { return }
  for process in audioProcesses() where watchedProcesses.insert(process).inserted {
    var address = audioAddress(kAudioProcessPropertyIsRunningInput)
    AudioObjectAddPropertyListenerBlock(process, &address, DispatchQueue.main) { _, _ in report() }
  }
}

func watchCameras() {
  for camera in cameras() where watchedCameras.insert(camera).inserted {
    var address = cmioAddress(kCMIODevicePropertyDeviceIsRunningSomewhere)
    CMIOObjectAddPropertyListenerBlock(camera, &address, DispatchQueue.main) { _, _ in report() }
  }
}

let audioSystem = AudioObjectID(kAudioObjectSystemObject)
var devicesAddress = audioAddress(kAudioHardwarePropertyDevices)
AudioObjectAddPropertyListenerBlock(audioSystem, &devicesAddress, DispatchQueue.main) { _, _ in report() }

if #available(macOS 14.2, *) {
  var processesAddress = audioAddress(kAudioHardwarePropertyProcessObjectList)
  AudioObjectAddPropertyListenerBlock(audioSystem, &processesAddress, DispatchQueue.main) { _, _ in
    watchProcesses()
    report()
  }
}

var camerasAddress = cmioAddress(kCMIOHardwarePropertyDevices)
CMIOObjectAddPropertyListenerBlock(CMIOObjectID(kCMIOObjectSystemObject), &camerasAddress, DispatchQueue.main) { _, _ in
  watchCameras()
  report()
}

// MacIsland closes our stdin when it quits; exit with it instead of lingering.
FileHandle.standardInput.readabilityHandler = { handle in
  if handle.availableData.isEmpty { exit(0) }
}

watchProcesses()
watchCameras()
report()
dispatchMain()
