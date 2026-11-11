// macisland-audio-watch: prints the connected Bluetooth audio devices as one
// JSON line on start and again whenever the list changes. MacIsland reads
// these lines to notice headphones connecting.
//
// It only lists device names through Core Audio; it never opens a device or
// records audio, so it needs no permission. It is a plain command-line tool
// (not the helper app) so that changing it never resets the helper's
// Accessibility permission.

import CoreAudio
import Foundation

func property<T>(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector, _ initial: T) -> T? {
  var address = AudioObjectPropertyAddress(
    mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  var value = initial
  var size = UInt32(MemoryLayout<T>.size)
  let status = withUnsafeMutablePointer(to: &value) { AudioObjectGetPropertyData(object, &address, 0, nil, &size, $0) }
  return status == noErr ? value : nil
}

func string(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
  guard let value = property(object, selector, Unmanaged<CFString>?.none) else { return nil }
  return value?.takeRetainedValue() as String?
}

func allDevices() -> [AudioObjectID] {
  var address = AudioObjectPropertyAddress(
    mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain)
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
  for id in allDevices() {
    guard let transport = property(id, kAudioDevicePropertyTransportType, UInt32(0)),
      transport == kAudioDeviceTransportTypeBluetooth || transport == kAudioDeviceTransportTypeBluetoothLE,
      let name = string(id, kAudioObjectPropertyName), !name.isEmpty
    else { continue }
    names.insert(name)
  }
  return names.sorted()
}

var last: [String]?
let encoder = JSONEncoder()

func report() {
  let devices = bluetoothDevices()
  guard devices != last, let data = try? encoder.encode(devices) else { return }
  last = devices
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data("\n".utf8))
}

var address = AudioObjectPropertyAddress(
  mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal,
  mElement: kAudioObjectPropertyElementMain)
AudioObjectAddPropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &address, DispatchQueue.main) { _, _ in
  report()
}

// MacIsland closes our stdin when it quits; exit with it instead of lingering.
FileHandle.standardInput.readabilityHandler = { handle in
  if handle.availableData.isEmpty { exit(0) }
}

report()
dispatchMain()
