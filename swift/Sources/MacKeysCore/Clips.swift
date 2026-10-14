import Foundation

// Recorded click sounds (CC0).
// Keyboard: Freesound #853602 "Typing on Laptop Keyboard #2" by justamudkip (2021 14-inch MacBook Pro).
// Trackpad: Freesound #467490 "MacBook Pro trackpad (48/24)" by neilraouf (2019 MacBook Pro).

/// A clip set: mono 16-bit little-endian PCM, base64 encoded, at sample rate `sr`.
public struct ClipSet: Sendable, Equatable {
    public var source: String
    public var sr: Double
    /// Takes by kind (`press`, `release`, `space`, `force`), base64 encoded.
    public var clips: [String: [String]]

    public init(json data: Data) throws {
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CocoaError(.coderReadCorrupt)
        }
        source = obj["source"] as? String ?? ""
        sr = (obj["sr"] as? NSNumber)?.doubleValue ?? 24000
        var c: [String: [String]] = [:]
        for (k, v) in obj { if let list = v as? [String] { c[k] = list } }
        clips = c
    }

    /// Decoded takes of one kind, as float samples in -1...1.
    public func samples(_ kind: String) -> [[Float]] {
        (clips[kind] ?? []).map(decodeClip)
    }

    static func load(_ name: String) -> ClipSet? {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? ClipSet(json: data)
    }

    /// Keyboard clicks: `press` (6 takes), `release` (6), `space` (1), at 24 kHz.
    public static let keyboard: ClipSet? = load("keyboard-clicks")
    /// Trackpad clicks: `press` (3), `release` (2), `force` (1), at 48 kHz.
    public static let trackpad: ClipSet? = load("trackpad-clicks")
}

/// Decodes one base64 clip to float samples in -1...1.
public func decodeClip(_ b64: String) -> [Float] {
    guard let d = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else { return [] }
    let n = d.count / 2
    var out = [Float](repeating: 0, count: n)
    d.withUnsafeBytes { raw in
        let b = raw.bindMemory(to: UInt8.self)
        for i in 0..<n {
            let v = Int16(bitPattern: UInt16(b[2 * i]) | (UInt16(b[2 * i + 1]) << 8))
            out[i] = Float(v) / 32768
        }
    }
    return out
}
