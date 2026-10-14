import SwiftUI
import MacKeysCore

/// Space around a key cap for its shadows and glow, in px at scale 1.
let keyPad: CGFloat = 14

/// Precomputed paths of one key's icon and ISO shape.
struct KeyArt {
    var iconStroke = Path()
    var iconFill = Path()
    var iconLineWidth: CGFloat = 0
    var isoPath = Path()
    var isoHighlight = Path()

    init(_ k: KeyCap) {
        if let i = k.icon, i.viewBox.count == 4 {
            let vb = i.viewBox
            let s = min(i.w / vb[2], i.h / vb[3])
            let tx = i.x + (i.w - vb[2] * s) / 2 - vb[0] * s
            let ty = i.y + (i.h - vb[3] * s) / 2 - vb[1] * s
            let t = CGAffineTransform(translationX: tx, y: ty).scaledBy(x: s, y: s)
            iconStroke = svgPath(i.stroke).applying(t)
            iconFill = svgPath(i.fill).applying(t)
            iconLineWidth = i.strokeWidth * s
        }
        if let iso = k.iso {
            isoPath = svgPath(iso.path)
            isoHighlight = svgPath(iso.highlight)
        }
    }
}

/// Draws one key cap per the SPEC rendering contract. The frame includes `keyPad` on each side.
/// `press` (0 = up, 1 = down) animates the pressed look: the CSS `.mk-k.mk-dn` transform
/// `translateY(.45px) scale(.986)`, `filter: brightness(pressedBrightness)` and the top highlight fading out.
/// The canvas draws the transform itself, so the cap stays sharp (a scaled layer would be resampled).
struct KeyCapCanvas: View, @preconcurrency Animatable {
    let key: KeyCap
    let theme: KeyboardTheme
    var press: Double
    let caps: Bool
    let scale: CGFloat
    let art: KeyArt
    /// The face rect in key coordinates, snapped to device pixels (as Blink snaps boxes). Nil = unsnapped.
    var face: CGRect? = nil
    /// Sub-pixel rest of the key position, in px at scale 1.
    var shift: CGSize = .zero

    var animatableData: Double {
        get { press }
        set { press = newValue }
    }

    var body: some View {
        let k = key, t = theme, p = press, c = caps, a = art, s = scale, f = face, sh = shift
        Canvas { ctx, _ in
            ctx.scaleBy(x: s, y: s)
            ctx.translateBy(x: keyPad + sh.width, y: keyPad + sh.height)
            if p <= 0.0001 {
                KeyCapCanvas.draw(&ctx, k, t, highlight: 1, caps: c, art: a, face: f)
                return
            }
            // transform-origin is the key center; brightness covers the shadows and glows too.
            let b = 1 - (1 - t.pressedBrightness) * p
            ctx.drawLayer { l in
                l.addFilter(.colorMultiply(Color(white: b)))
                let sc = 1 - 0.014 * p
                l.translateBy(x: k.w / 2, y: k.h / 2 + 0.45 * p)
                l.scaleBy(x: sc, y: sc)
                l.translateBy(x: -k.w / 2, y: -k.h / 2)
                KeyCapCanvas.draw(&l, k, t, highlight: 1 - p, caps: c, art: a, face: f)
            }
        }
        .frame(width: (k.w + 2 * keyPad) * s, height: (k.h + 2 * keyPad) * s)
    }

    /// `highlight` is the opacity of the box key's top highlight (it fades out as the key goes down).
    static func draw(_ ctx: inout GraphicsContext, _ k: KeyCap, _ t: KeyboardTheme, highlight: Double, caps: Bool, art: KeyArt, face: CGRect? = nil) {
        let rect = face ?? CGRect(x: 0, y: 0, width: k.w, height: k.h)
        let face1 = Color(mk: t.face1), face0 = Color(mk: t.face0)
        let legend = Color(mk: t.legend)

        if k.iso != nil {
            // ISO and JIS return: the L-shaped path, drop shadow, face gradient, outline and highlight strokes.
            let dark = t.touchId == .dark
            var sh = ctx
            sh.addFilter(.blur(radius: 0.5))
            sh.translateBy(x: 0, y: 1)
            sh.fill(art.isoPath, with: .color(dark ? Color(white: 0, opacity: 0.4) : Color(white: 0, opacity: 0.14)))
            ctx.fillElliptical(art.isoPath, center: CGPoint(x: k.w / 2, y: k.h), rx: k.w * 0.9, ry: k.h * 0.9, inner: face1, outer: face0)
            ctx.stroke(art.isoPath, with: .color(Color(mk: t.outline)), lineWidth: 1)
            // The web keeps the ISO highlight stroke on press (only the box shadow of box keys changes).
            ctx.stroke(art.isoHighlight, with: .color(Color(mk: t.highlight)), lineWidth: 0.8)
        } else {
            let box = BoxShape(rect: rect, radii: Array(repeating: k.radius, count: 4))
            ctx.drawOuterShadows(t.capShadows, box, under: 0.5)
            ctx.fillElliptical(box.path(), center: CGPoint(x: rect.midX, y: rect.maxY), rx: rect.width * 1.25, ry: rect.height * 1.1, inner: face1, outer: face0)
            var inset = [MacKeysCore.shadow(0, 0, 0, 1, t.outline, true)]
            if highlight > 0.001 {
                let hl = (try? parseColor(t.highlight)) ?? RGBA(r: 0, g: 0, b: 0, a: 0)
                inset.append(MacKeysCore.shadow(0, 1.8, 0, 0, rgba(hl.r, hl.g, hl.b, hl.a * highlight), true))
            }
            ctx.drawInsetShadows(inset, box)
        }

        // Legends.
        for l in k.legends {
            let text = CSSText(l.text, size: l.size, tracking: l.tracking * l.size)
            let x: CGFloat
            switch l.align {
            case .center: x = (k.w - text.width) / 2
            case .left: x = l.inset
            case .right: x = k.w - l.inset - text.width
            }
            let origin = CGPoint(x: x, y: l.top)
            ctx.drawGlows(t.legendGlow) { g, color in text.draw(&g, at: origin, color: color) }
            text.draw(&ctx, at: origin, color: t.legend)
        }

        // Icon.
        if k.icon != nil {
            let lw = art.iconLineWidth
            let style = StrokeStyle(lineWidth: lw, lineCap: .round, lineJoin: .round)
            func icon(_ g: inout GraphicsContext, _ color: Color) {
                if !art.iconFill.isEmpty { g.fill(art.iconFill, with: .color(color)) }
                if !art.iconStroke.isEmpty, lw > 0 { g.stroke(art.iconStroke, with: .color(color), style: style) }
            }
            ctx.drawGlows(t.iconGlow) { g, color in icon(&g, Color(mk: color)) }
            icon(&ctx, legend)
        }

        // Caps lock LED.
        if let led = k.capsLed {
            let r = CGRect(x: led.x, y: led.y, width: led.d, height: led.d)
            if caps {
                ctx.drawGlows(t.capsLedGlow) { g, color in g.fill(Path(ellipseIn: r), with: .color(Color(mk: color))) }
                ctx.fill(Path(ellipseIn: r), with: .color(Color(mk: t.capsLedOn)))
            } else {
                ctx.fill(Path(ellipseIn: r), with: .color(Color(mk: t.capsLedOff)))
            }
        }

        // Home bar (F and J).
        if let hb = k.homeBar {
            ctx.fill(roundedRect(CGRect(x: hb.x, y: hb.y, width: hb.w, height: hb.h), [1, 1, 1, 1]), with: .color(Color(mk: t.homeBar)))
        }

        // Touch ID.
        if let tid = k.touchId {
            let d = tid.d
            let r = CGRect(x: k.w / 2 - d / 2, y: k.h / 2 - d / 2, width: d, height: d)
            ctx.drawLayer { g in
                if t.touchIdBrightness != 1 { g.addFilter(.colorMultiply(Color(white: t.touchIdBrightness))) }
                drawTouchId(&g, r, t)
            }
        }
    }

    static func drawTouchId(_ g: inout GraphicsContext, _ r: CGRect, _ t: KeyboardTheme) {
        let disc = BoxShape(rect: r, radii: [], ellipse: true)
        switch t.touchId {
        case .dark:
            g.drawOuterShadows([MacKeysCore.shadow(0, 0, 0, 0.5, "rgba(0,0,0,.65)")], disc)
            let stops: [SwiftUI.Gradient.Stop] = [
                .init(color: Color(mk: "#5a5a5e"), location: 0), .init(color: Color(mk: "#48484c"), location: 60.0 / 360),
                .init(color: Color(mk: "#3a3a3d"), location: 140.0 / 360), .init(color: Color(mk: "#444448"), location: 215.0 / 360),
                .init(color: Color(mk: "#3a3a3d"), location: 290.0 / 360), .init(color: Color(mk: "#5a5a5e"), location: 1)
            ]
            g.fill(disc.path(), with: .conicGradient(SwiftUI.Gradient(stops: stops), center: CGPoint(x: r.midX, y: r.midY), angle: .degrees(-90)))
            let inner = BoxShape(rect: r.insetBy(dx: 0.7, dy: 0.7), radii: [], ellipse: true)
            g.fill(inner.path(), with: .color(Color(mk: "#1b1b1d")))
            g.drawInsetShadows([MacKeysCore.shadow(0, 0.8, 1, 0, "rgba(0,0,0,.45)", true)], inner)
        case .light:
            g.drawOuterShadows([MacKeysCore.shadow(0, 0, 0, 0.6, "rgba(60,60,66,.55)")], disc)
            g.fill(disc.path(), with: .color(Color(mk: "#c4c4c8")))
            let inner = BoxShape(rect: r.insetBy(dx: 1.1, dy: 1.1), radii: [], ellipse: true)
            g.fill(inner.path(), with: .color(Color(mk: "#eeeef0")))
            g.drawInsetShadows([MacKeysCore.shadow(0, 0, 0, 0.5, "rgba(70,70,76,.45)", true), MacKeysCore.shadow(0, 1, 1, 0, "rgba(0,0,0,.06)", true)], inner)
        case .flush:
            g.drawOuterShadows([MacKeysCore.shadow(0, 0.6, 0, 0, "rgba(255,255,255,.5)"), MacKeysCore.shadow(0, -0.4, 0, 0, "rgba(0,0,0,.08)")], disc)
            g.fill(disc.path(), with: .color(Color(mk: t.face1)))
            g.drawInsetShadows([MacKeysCore.shadow(0, 1, 1, 0, "rgba(0,0,0,.10)", true), MacKeysCore.shadow(0, -0.8, 0, 0, "rgba(255,255,255,.6)", true)], disc)
        }
    }
}

/// One interactive key: the canvas plus the pressed transform, brightness and pointer gesture.
struct KeyCapView: View {
    let key: KeyCap
    let theme: KeyboardTheme
    let pressed: Bool
    let caps: Bool
    let scale: CGFloat
    let art: KeyArt
    var face: CGRect? = nil
    var shift: CGSize = .zero
    let onDown: () -> Void
    let onUp: () -> Void

    var body: some View {
        let s = scale
        let hit: AnyShape = key.iso != nil
            ? AnyShape(art.isoPath.applying(CGAffineTransform(scaleX: s, y: s).translatedBy(x: keyPad, y: keyPad)))
            : AnyShape(Rectangle().inset(by: keyPad * s))
        KeyCapCanvas(key: key, theme: theme, press: pressed ? 1 : 0, caps: caps, scale: s, art: art, face: face, shift: shift)
            .animation(.timingCurve(0.2, 0.75, 0.3, 1, duration: pressed ? 0.026 : 0.095), value: pressed)
            .contentShape(hit)
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { _ in if !pressed { onDown() } }
                    .onEnded { _ in onUp() }
            )
            .accessibilityElement()
            .accessibilityLabel(key.label)
            .accessibilityAddTraits(.isButton)
    }
}
