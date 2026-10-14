import SwiftUI
import MacKeysCore

/// How a MacKeys view sizes itself. All drawings have a fixed size in px at scale 1.
public enum MacKeysSizing: Sendable, Equatable {
    /// A fixed scale factor (1 = 1 px per CSS px of the spec).
    case scale(CGFloat)
    /// Scales to the available width and keeps the aspect ratio.
    case fitWidth
}

/// Space around a drawing for its shadows, in px at scale 1.
struct Margins {
    var left: CGFloat, top: CGFloat, right: CGFloat, bottom: CGFloat
    static let device = Margins(left: 30, top: 16, right: 30, bottom: 80)
    static let trackpad = Margins(left: 24, top: 12, right: 24, bottom: 70)
}

/// Lays out content at a fixed natural size, scaled by `.scale` or to the available width.
struct ScaledContainer<Content: View>: View {
    let natural: CGSize
    let sizing: MacKeysSizing
    @ViewBuilder let content: (CGFloat) -> Content

    var body: some View {
        switch sizing {
        case .scale(let s):
            content(s).frame(width: natural.width * s, height: natural.height * s, alignment: .topLeading)
        case .fitWidth:
            Color.clear
                .aspectRatio(natural.width / natural.height, contentMode: .fit)
                .overlay(alignment: .topLeading) {
                    GeometryReader { g in
                        content(max(0.05, g.size.width / natural.width))
                    }
                }
        }
    }
}

/// An interactive trackpad surface (built in or standalone). The frame includes `margins`.
struct TrackpadSurfaceView: View {
    let size: CGSize
    let radius: CGFloat
    let surface: MacKeysCore.Gradient
    let shadows: [Shadow]
    let side: (MacKeysCore.Gradient, Double, [Shadow])?
    let margins: Margins
    var grain: Double = 0
    let controller: TrackpadController
    let label: String
    let scale: CGFloat

    var body: some View {
        let s = scale, m = margins, phase = controller.phase
        let frame = CGSize(width: (size.width + m.left + m.right) * s, height: (size.height + m.top + m.bottom) * s)
        TrackpadCanvas(size: size, radius: radius, surface: surface, shadows: shadows, side: side, grain: grain,
                       margins: m, scale: s, look: TrackpadLook(phase))
            .animation(TrackpadLook.animation(to: phase), value: phase)
        .frame(width: frame.width, height: frame.height)
        .contentShape(
            Path(roundedRect: CGRect(x: m.left * s, y: m.top * s, width: size.width * s, height: size.height * s), cornerRadius: radius * s)
        )
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    guard controller.phase == .up else { return }
                    let pm = PressureMonitor.shared
                    pm.begin(controller)
                    controller.press(source: .pointer, timedForce: !pm.hasPressure)
                }
                .onEnded { _ in
                    controller.release(source: .pointer)
                    PressureMonitor.shared.end()
                }
        )
        .accessibilityElement()
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
    }
}

/// The trackpad drawing. `look` animates between phases.
struct TrackpadCanvas: View, @preconcurrency Animatable {
    let size: CGSize
    let radius: CGFloat
    let surface: MacKeysCore.Gradient
    let shadows: [Shadow]
    let side: (MacKeysCore.Gradient, Double, [Shadow])?
    let grain: Double
    let margins: Margins
    let scale: CGFloat
    var look: TrackpadLook

    var animatableData: AnimatablePair<AnimatablePair<Double, Double>, AnimatablePair<AnimatablePair<Double, Double>, Double>> {
        get { look.vector }
        set { look.vector = newValue }
    }

    var body: some View {
        let s = scale, m = margins, look = look
        let surface = surface, shadows = shadows, side = side, size = size, radius = radius, grain = grain
        Canvas { ctx, _ in
            ctx.scaleBy(x: s, y: s)
            TopCaseDrawing.drawTrackpad(&ctx, rect: CGRect(x: m.left, y: m.top, width: size.width, height: size.height),
                                        radius: radius, surface: surface, shadows: shadows, side: side, grain: grain, look: look)
        }
    }
}

/// Draws one device (top case, keys and the built-in trackpad) and wires pointer and keyboard input.
struct DeviceView: View {
    let device: MacDevice
    let keyboard: KeyboardController
    let trackpad: TrackpadController?
    let captureKeyboard: Bool
    /// Draw the open lid (full MacBook top cases only).
    var lid: Bool = false
    let scale: CGFloat
    // Explicit State (not @State): the macOS 27 SDK makes @State a macro that Command Line Tools cannot expand.
    private let captureState = State(initialValue: KeyCaptureMonitor())
    @Environment(\.displayScale) private var displayScale

    static func natural(_ tc: TopCaseGeometry, lid: Bool = false) -> CGSize {
        let m = Margins.device
        let showLid = lid && tc.full
        let side = showLid ? lidSide : 0, top = showLid ? lidSpace : 0
        return CGSize(width: tc.width + m.left + m.right + 2 * side, height: tc.height + 10 + m.top + m.bottom + top)
    }

    /// Where the deck's top-left corner sits in the view, in px at scale 1.
    static func deckOrigin(_ tc: TopCaseGeometry, lid: Bool) -> CGPoint {
        let m = Margins.device
        let showLid = lid && tc.full
        return CGPoint(x: m.left + (showLid ? lidSide : 0), y: m.top + (showLid ? lidSpace : 0))
    }

    var body: some View {
        let s = scale, tc = device.topCase, kb = device.keyboard, theme = device.theme
        let o = DeviceView.deckOrigin(tc, lid: lid)
        let m = Margins(left: o.x, top: o.y, right: 0, bottom: 0)
        let size = DeviceView.natural(tc, lid: lid)
        let down = keyboard.down, caps = keyboard.caps
        ZStack(alignment: .topLeading) {
            if lid && tc.full {
                LidView(finish: kb.finish, width: tc.width, height: tc.height, scale: s)
                    .offset(x: m.left * s, y: (m.top - tc.height) * s)
            }
            Canvas { ctx, _ in
                ctx.scaleBy(x: s, y: s)
                ctx.translateBy(x: m.left, y: m.top)
                TopCaseDrawing.drawBack(&ctx, tc)
            }
            .frame(width: size.width * s, height: size.height * s)
            .allowsHitTesting(false)

            if let rect = tc.trackpad, let trackpad {
                let tp = MacKeysCore.trackpad(finish: kb.finish)
                let ox = (m.left + rect.x - 4) * s, oy = (m.top + rect.y - 4) * s
                let rx = pixelRound(ox), ry = pixelRound(oy)
                let pm = Margins(left: 4 + (ox - rx) / s, top: 4 + (oy - ry) / s, right: 4, bottom: 6)
                TrackpadSurfaceView(size: CGSize(width: rect.w, height: rect.h), radius: rect.radius, surface: tp.surface,
                                    shadows: trackpadShadows(finish: kb.finish.rawValue), side: nil, margins: pm,
                                    controller: trackpad, label: tp.label, scale: s)
                    .offset(x: rx, y: ry)
            }

            Canvas { ctx, _ in
                ctx.scaleBy(x: s, y: s)
                ctx.translateBy(x: m.left, y: m.top)
                TopCaseDrawing.drawFront(&ctx, tc)
            }
            .frame(width: size.width * s, height: size.height * s)
            .allowsHitTesting(false)

            ForEach(kb.keys) { k in
                // Place each key layer on whole device pixels (a layer at a fractional offset is resampled and
                // blurs); the canvas draws the fractional rest.
                let ox = (m.left + tc.keyboard.x + k.x - keyPad) * s, oy = (m.top + tc.keyboard.y + k.y - keyPad) * s
                let rx = pixelRound(ox), ry = pixelRound(oy)
                KeyCapView(key: k, theme: theme, pressed: down.contains(k.id), caps: caps, scale: s, art: KeyArt(k),
                           face: snapped(CGRect(x: k.x, y: k.y, width: k.w, height: k.h),
                                         origin: CGPoint(x: m.left + tc.keyboard.x, y: m.top + tc.keyboard.y), scale: s),
                           shift: CGSize(width: (ox - rx) / s, height: (oy - ry) / s),
                           onDown: { keyboard.press(k.id, source: .pointer) },
                           onUp: { keyboard.release(k.id, source: .pointer) })
                    .offset(x: rx, y: ry)
            }
        }
        .frame(width: size.width * s, height: size.height * s, alignment: .topLeading)
        .background {
            // Only with capture on: ImageRenderer cannot draw an NSViewRepresentable.
            if captureKeyboard { WindowReader { w in captureState.wrappedValue.window = w } }
        }
        .onAppear {
            captureState.wrappedValue.controller = keyboard
            if captureKeyboard { captureState.wrappedValue.start() }
        }
        .onDisappear { captureState.wrappedValue.stop() }
        .onChange(of: captureKeyboard) { _, on in
            captureState.wrappedValue.controller = keyboard
            if on { captureState.wrappedValue.start() } else { captureState.wrappedValue.stop() }
        }
    }
}

extension DeviceView {
    /// Blink paints boxes with their edges rounded to device pixels. Returns `r` (relative to `origin`, px at
    /// scale 1) snapped that way, in the coordinates of `r` itself (origin at r's unsnapped top-left).
    /// Rounds a view offset (points) to whole device pixels.
    func pixelRound(_ v: CGFloat) -> CGFloat {
        let d = max(displayScale, 1)
        return (v * d).rounded() / d
    }

    func snapped(_ r: CGRect, origin: CGPoint, scale s: CGFloat) -> CGRect {
        let p = s * max(displayScale, 1)
        func snap(_ v: CGFloat) -> CGFloat { (v * p).rounded() / p }
        let x0 = origin.x + r.minX, y0 = origin.y + r.minY
        let sx0 = snap(x0), sy0 = snap(y0), sx1 = snap(x0 + r.width), sy1 = snap(y0 + r.height)
        return CGRect(x: sx0 - x0, y: sy0 - y0, width: sx1 - sx0, height: sy1 - sy0)
    }
}

/// A Mac keyboard deck (top case parts `keyboard`): the keys in their well on the aluminium deck.
/// Click keys with the pointer; when `captureKeyboard` is true, the physical keyboard presses them too.
public struct MacKeyboardView: View {
    let finish: FinishID
    let layout: LayoutID
    let custom: CustomLayout?
    let backlight: BacklightOptions
    let sound: Bool
    let captureKeyboard: Bool
    let idleOff: IdleDelay
    let sizing: MacKeysSizing
    let external: KeyboardController?
    private let ownState = State(initialValue: KeyboardController())

    /// - Parameters:
    ///   - controller: an optional controller to observe or drive the keys. A view makes its own when nil.
    public init(finish: FinishID = .proSpaceBlack, layout: LayoutID = .enUS, custom: CustomLayout? = nil,
                backlight: BacklightOptions = BacklightOptions(), sound: Bool = true, captureKeyboard: Bool = true,
                idleOff: IdleDelay = .never, sizing: MacKeysSizing = .scale(1), controller: KeyboardController? = nil) {
        self.finish = finish; self.layout = layout; self.custom = custom; self.backlight = backlight
        self.sound = sound; self.captureKeyboard = captureKeyboard; self.idleOff = idleOff; self.sizing = sizing
        self.external = controller
    }

    public var body: some View {
        DeviceHost(finish: finish, layout: layout, custom: custom, backlight: backlight, sound: sound,
                   captureKeyboard: captureKeyboard, idleOff: idleOff, sizing: sizing, parts: .keyboard,
                   keyboard: external ?? ownState.wrappedValue, trackpad: nil)
    }
}

/// A MacBook top case (parts `full`): deck, keyboard well, speaker grilles, hinge, built-in Force Touch
/// trackpad, the front notch and (with `showLid`, the default) the open lid with its screen.
/// The lid needs 200 px above the deck and 120 px on each side. Magic Keyboard finishes draw the keyboard only.
public struct MacBookView: View {
    let finish: FinishID
    let layout: LayoutID
    let custom: CustomLayout?
    let backlight: BacklightOptions
    let sound: Bool
    let captureKeyboard: Bool
    let idleOff: IdleDelay
    let sizing: MacKeysSizing
    let showLid: Bool
    let externalKeyboard: KeyboardController?
    let externalTrackpad: TrackpadController?
    private let ownKeyboardState = State(initialValue: KeyboardController())
    private let ownTrackpadState = State(initialValue: TrackpadController())

    public init(finish: FinishID = .proSpaceBlack, layout: LayoutID = .enUS, custom: CustomLayout? = nil,
                backlight: BacklightOptions = BacklightOptions(), sound: Bool = true, captureKeyboard: Bool = true,
                idleOff: IdleDelay = .never, sizing: MacKeysSizing = .scale(1), showLid: Bool = true,
                controller: KeyboardController? = nil, trackpadController: TrackpadController? = nil) {
        self.finish = finish; self.layout = layout; self.custom = custom; self.backlight = backlight
        self.sound = sound; self.captureKeyboard = captureKeyboard; self.idleOff = idleOff; self.sizing = sizing
        self.showLid = showLid
        self.externalKeyboard = controller; self.externalTrackpad = trackpadController
    }

    public var body: some View {
        DeviceHost(finish: finish, layout: layout, custom: custom, backlight: backlight, sound: sound,
                   captureKeyboard: captureKeyboard, idleOff: idleOff, sizing: sizing, parts: .full, lid: showLid,
                   keyboard: externalKeyboard ?? ownKeyboardState.wrappedValue, trackpad: externalTrackpad ?? ownTrackpadState.wrappedValue)
    }
}

/// Shared host of `MacKeyboardView` and `MacBookView`: builds the model and configures the controllers.
struct DeviceHost: View {
    let finish: FinishID
    let layout: LayoutID
    let custom: CustomLayout?
    let backlight: BacklightOptions
    let sound: Bool
    let captureKeyboard: Bool
    let idleOff: IdleDelay
    let sizing: MacKeysSizing
    let parts: Parts
    var lid: Bool = false
    let keyboard: KeyboardController
    let trackpad: TrackpadController?

    var body: some View {
        var bl = backlight
        bl.idle = (bl.idle ?? false) || keyboard.idle
        let device = macDevice(finish: finish, layout: layout, custom: custom, parts: parts, backlight: bl)
        return ScaledContainer(natural: DeviceView.natural(device.topCase, lid: lid), sizing: sizing) { s in
            DeviceView(device: device, keyboard: keyboard, trackpad: trackpad, captureKeyboard: captureKeyboard, lid: lid, scale: s)
        }
        .onAppear { configure(device.keyboard) }
        .onChange(of: ConfigKey(finish: finish, layout: layout, custom: custom, sound: sound, idleOff: idleOff)) { _, _ in
            configure(device.keyboard)
        }
    }

    private func configure(_ kb: KeyboardGeometry) {
        keyboard.setKeys(kb.keys)
        keyboard.sound = sound ? ClickSound.shared : nil
        trackpad?.sound = sound ? ClickSound.shared : nil
        if keyboard.idleOffMs != idleOff.milliseconds { keyboard.setIdleOff(idleOff.milliseconds) }
    }

    struct ConfigKey: Equatable {
        var finish: FinishID
        var layout: LayoutID
        var custom: CustomLayout?
        var sound: Bool
        var idleOff: IdleDelay
    }
}

/// The standalone Force Touch trackpad of a MacBook finish. Click it; hold for a force click
/// (real pressure on Force Touch hardware, a 500 ms timer otherwise).
public struct MacTrackpadView: View {
    let finish: FinishID
    let sound: Bool
    let sizing: MacKeysSizing
    let external: TrackpadController?
    private let ownPadState = State(initialValue: TrackpadController())

    public init(finish: FinishID = .proSpaceBlack, sound: Bool = true, sizing: MacKeysSizing = .scale(1), controller: TrackpadController? = nil) {
        self.finish = finish; self.sound = sound; self.sizing = sizing; self.external = controller
    }

    public var body: some View {
        let c = external ?? ownPadState.wrappedValue
        let tp = trackpad(finish: finish)
        let m = Margins.trackpad
        let natural = CGSize(width: tp.width + m.left + m.right, height: tp.height + m.top + m.bottom)
        return ScaledContainer(natural: natural, sizing: sizing) { s in
            TrackpadSurfaceView(size: CGSize(width: tp.width, height: tp.height), radius: tp.radius, surface: tp.surface,
                                shadows: tp.shadows, side: (tp.side, tp.sideDepth, tp.sideShadows), margins: m, grain: tp.grain,
                                controller: c, label: tp.label, scale: s)
        }
        .onAppear { c.sound = sound ? ClickSound.shared : nil }
        .onChange(of: sound) { _, on in c.sound = on ? ClickSound.shared : nil }
    }
}
