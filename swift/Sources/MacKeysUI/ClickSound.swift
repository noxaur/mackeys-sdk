import AVFoundation
import MacKeysCore

/// Plays the recorded clicks with AVAudioEngine. A key press plays its key class's soft or hard recording
/// (hard with the chance `hardness`), with a small random rate and level change. A release uses the force of
/// the last press of that class. Trackpad clicks go through a high shelf
/// (2 kHz, -14 dB) and a low-pass (5 kHz, Q 0.5). The engine starts on the first sound.
/// Audio is optional: when the engine cannot start, every call does nothing.
@MainActor
public final class ClickSound: SoundSink {
    /// One instance shared by every view.
    public static let shared = ClickSound()

    public var enabled = true
    /// Master volume, 0 to 1.
    public var volume: Float = 1
    /// The chance, 0 to 1, that a key press uses the hard recording.
    public var hardness: Double = 0.2

    private struct Voice {
        let player: AVAudioPlayerNode
        let varispeed: AVAudioUnitVarispeed
    }

    private var engine: AVAudioEngine?
    private var failed = false
    private var buffers: [String: [AVAudioPCMBuffer]] = [:]
    private var keyVoices: [Voice] = []
    private var padVoices: [Voice] = []
    private var nextKey = 0, nextPad = 0
    private var force: [KeySound: KeyForce] = [:]
    private let poolSize = 6
    private var observer: NSObjectProtocol?

    public init(volume: Float = 1, hardness: Double = 0.2) {
        self.volume = volume
        self.hardness = hardness
    }

    public func key(_ kind: KeySound, up: Bool) {
        guard enabled, let _ = ready() else { return }
        if !up { force[kind] = Double.random(in: 0..<1) < hardness ? .hard : .soft }
        let list = buffers[keyClipName(kind, force[kind] ?? .soft, up: up)] ?? []
        guard !list.isEmpty, !keyVoices.isEmpty else { return }
        let v = keyVoices[nextKey]
        nextKey = (nextKey + 1) % keyVoices.count
        play(v, list[Int.random(in: 0..<list.count)], rate: Float(0.985 + Double.random(in: 0..<1) * 0.03), gain: volume * 0.85 * Float(0.85 + Double.random(in: 0..<1) * 0.15))
    }

    public func trackpad(_ kind: TrackpadSound) {
        guard enabled, let _ = ready() else { return }
        let list = buffers["tp-" + kind.rawValue] ?? []
        guard !list.isEmpty, !padVoices.isEmpty else { return }
        let v = padVoices[nextPad]
        nextPad = (nextPad + 1) % padVoices.count
        let rate = (kind == .force ? 0.9 : 1) * (0.99 + Double.random(in: 0..<1) * 0.02)
        play(v, list[Int.random(in: 0..<list.count)], rate: Float(rate), gain: volume * (kind == .force ? 0.85 : 0.75))
    }

    /// Stops the engine and frees the buffers.
    public func close() {
        engine?.stop()
        engine = nil
        keyVoices = []
        padVoices = []
        buffers = [:]
        if let observer { NotificationCenter.default.removeObserver(observer) }
        observer = nil
    }

    private func play(_ v: Voice, _ buf: AVAudioPCMBuffer, rate: Float, gain: Float) {
        v.varispeed.rate = rate
        v.player.volume = gain
        v.player.stop()
        v.player.scheduleBuffer(buf, at: nil, options: [], completionHandler: nil)
        v.player.play()
    }

    private func ready() -> AVAudioEngine? {
        if failed { return nil }
        if let engine {
            if !engine.isRunning {
                do { try engine.start() } catch { return nil }
            }
            return engine
        }
        guard let kb = ClipSet.keyboard, let tp = ClipSet.trackpad,
              let kbFormat = AVAudioFormat(standardFormatWithSampleRate: kb.sr, channels: 1),
              let tpFormat = AVAudioFormat(standardFormatWithSampleRate: tp.sr, channels: 1) else {
            failed = true
            return nil
        }
        func make(_ set: ClipSet, _ kind: String, _ format: AVAudioFormat) -> [AVAudioPCMBuffer] {
            set.samples(kind).compactMap { s in
                guard let b = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(s.count)),
                      let ch = b.floatChannelData else { return nil }
                b.frameLength = AVAudioFrameCount(s.count)
                s.withUnsafeBufferPointer { src in ch[0].update(from: src.baseAddress!, count: s.count) }
                return b
            }
        }
        buffers = [
            "tp-press": make(tp, "press", tpFormat), "tp-release": make(tp, "release", tpFormat), "tp-force": make(tp, "force", tpFormat)
        ]
        for name in kb.clips.keys { buffers[name] = make(kb, name, kbFormat) }

        let e = AVAudioEngine()
        let main = e.mainMixerNode
        for _ in 0..<poolSize {
            let v = Voice(player: AVAudioPlayerNode(), varispeed: AVAudioUnitVarispeed())
            e.attach(v.player); e.attach(v.varispeed)
            e.connect(v.player, to: v.varispeed, format: kbFormat)
            e.connect(v.varispeed, to: main, format: kbFormat)
            keyVoices.append(v)
        }
        // Trackpad chain: voices -> submix -> high shelf + low-pass EQ -> main mixer.
        let sub = AVAudioMixerNode()
        let eq = AVAudioUnitEQ(numberOfBands: 2)
        let shelf = eq.bands[0]
        shelf.filterType = .highShelf
        shelf.frequency = 2000
        shelf.gain = -14
        shelf.bypass = false
        let lp = eq.bands[1]
        lp.filterType = .lowPass
        lp.frequency = 5000
        lp.bandwidth = 2.54 // octaves, about Q 0.5
        lp.bypass = false
        e.attach(sub); e.attach(eq)
        e.connect(sub, to: eq, format: tpFormat)
        e.connect(eq, to: main, format: tpFormat)
        for _ in 0..<poolSize {
            let v = Voice(player: AVAudioPlayerNode(), varispeed: AVAudioUnitVarispeed())
            e.attach(v.player); e.attach(v.varispeed)
            e.connect(v.player, to: v.varispeed, format: tpFormat)
            e.connect(v.varispeed, to: sub, format: tpFormat)
            padVoices.append(v)
        }
        e.prepare()
        do {
            try e.start()
        } catch {
            failed = true
            keyVoices = []
            padVoices = []
            return nil
        }
        engine = e
        observer = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: e, queue: .main) { _ in
            MainActor.assumeIsolated { [weak self] in
                guard let self, let engine = self.engine, !engine.isRunning else { return }
                try? engine.start()
            }
        }
        return e
    }
}
