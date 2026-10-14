import SwiftUI
import MacKeysCore

/// Top case layers (SPEC "Rendering contract" > "Top case"), drawn in top case coordinates.
enum TopCaseDrawing {
    /// Side, deck, hinge, front notch and scoop: everything under the trackpad.
    static func drawBack(_ ctx: inout GraphicsContext, _ tc: TopCaseGeometry) {
        let W = tc.width, H = tc.height
        let radii = tc.radius.map { CGFloat($0) }
        // 1. Side, 10 px down.
        let side = BoxShape(rect: CGRect(x: 0, y: 10, width: W, height: H), radii: radii)
        ctx.drawOuterShadows(tc.sideShadows, side)
        ctx.fillVertical(side.path(), tc.side, in: side.rect)
        // 2. Deck.
        let deck = BoxShape(rect: CGRect(x: 0, y: 0, width: W, height: H), radii: radii)
        ctx.drawOuterShadows(tc.deckShadows, deck)
        ctx.fillVertical(deck.path(), tc.deck, in: deck.rect)
        ctx.drawInsetShadows(tc.deckShadows, deck)
        // 3. Grain (fractal noise, overlay blend), clipped to the deck.
        Grain.draw(&ctx, in: deck.path(), opacity: tc.grain, baseFrequency: 0.95)
        // 4. Hinge and notch (full top case only).
        if let h = tc.hinge {
            let bar = CGRect(x: h.x, y: 0, width: h.w, height: h.h)
            ctx.fill(roundedRect(bar, [0, 0, 3, 3]), with: .linearGradient(
                SwiftUI.Gradient(colors: [Color(mk: "#000000"), Color(mk: "#0b0b0c")]),
                startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: 0, y: h.h)))
            let left = CGRect(x: h.x, y: 0, width: h.barrelW, height: h.h)
            let right = CGRect(x: h.x + h.w - h.barrelW, y: 0, width: h.barrelW, height: h.h)
            ctx.fillVertical(roundedRect(left, [0, 0, 2, 3]), h.barrel, in: left)
            ctx.fillVertical(roundedRect(right, [0, 0, 3, 2]), h.barrel, in: right)
        }
        if let n = tc.notch {
            let lip = BoxShape(rect: CGRect(x: n.x, y: n.y, width: n.w, height: n.h), radii: [0, 0, 5, 5])
            ctx.fillVertical(lip.path(), n.fill, in: lip.rect)
            ctx.drawInsetShadows([MacKeysCore.shadow(4, 0, 3, -2, "rgba(0,0,0,.35)", true), MacKeysCore.shadow(-4, 0, 3, -2, "rgba(0,0,0,.35)", true)], lip)
            // The scoop: a 6 px fade to black above the front edge, shaped as the top half of an ellipse.
            let scoop = CGRect(x: n.x, y: n.y - 6, width: n.w, height: 6)
            var p = Path()
            p.move(to: CGPoint(x: scoop.minX, y: scoop.maxY))
            p.addCurve(to: CGPoint(x: scoop.midX, y: scoop.minY), control1: CGPoint(x: scoop.minX, y: scoop.maxY - 6 * 0.5523), control2: CGPoint(x: scoop.midX - n.w / 2 * 0.5523, y: scoop.minY))
            p.addCurve(to: CGPoint(x: scoop.maxX, y: scoop.maxY), control1: CGPoint(x: scoop.midX + n.w / 2 * 0.5523, y: scoop.minY), control2: CGPoint(x: scoop.maxX, y: scoop.maxY - 6 * 0.5523))
            p.closeSubpath()
            ctx.fill(p, with: .linearGradient(SwiftUI.Gradient(colors: [.black.opacity(0), .black.opacity(n.scoopOpacity)]),
                                              startPoint: CGPoint(x: 0, y: scoop.minY), endPoint: CGPoint(x: 0, y: scoop.maxY)))
        }
    }

    /// Grilles, dim and well: everything over the trackpad and under the keys.
    static func drawFront(_ ctx: inout GraphicsContext, _ tc: TopCaseGeometry) {
        // 5. Grilles: a dot grid centered in each rect.
        for g in tc.grilles {
            let r = CGRect(x: g.x, y: g.y, width: g.w, height: g.h)
            var c = ctx
            c.clip(to: roundedRect(r, [3, 3, 3, 3]))
            var dots = Path()
            let nx = Int((g.w / 2) / g.pitch) + 1, ny = Int((g.h / 2) / g.pitch) + 1
            let rad = g.dotRadius + 0.15
            for i in -nx...nx {
                for j in -ny...ny {
                    let cx = r.midX + Double(i) * g.pitch, cy = r.midY + Double(j) * g.pitch
                    dots.addEllipse(in: CGRect(x: cx - rad, y: cy - rad, width: 2 * rad, height: 2 * rad))
                }
            }
            c.fill(dots, with: .color(Color(mk: g.dot)))
        }
        // 6. Dim (dark room).
        if tc.dim > 0 {
            ctx.fill(roundedRect(CGRect(x: 0, y: 0, width: tc.width, height: tc.height), tc.radius.map { CGFloat($0) }), with: .color(.black.opacity(tc.dim)))
        }
        // 7. Well.
        let w = tc.well
        let box = BoxShape(rect: CGRect(x: w.x, y: w.y, width: w.w, height: w.h), radii: Array(repeating: w.radius, count: 4))
        ctx.drawOuterShadows(w.shadows, box)
        ctx.fill(box.path(), with: .color(Color(mk: w.fill)))
        ctx.drawInsetShadows(w.shadows, box)
    }

    /// The trackpad: optional side, then the surface with its phase (SPEC "Trackpad").
    /// `rect` is the surface rect; the phase moves only the surface. `look` holds the animated phase values.
    static func drawTrackpad(_ ctx: inout GraphicsContext, rect: CGRect, radius: CGFloat, surface: MacKeysCore.Gradient,
                             shadows: [Shadow], side: (MacKeysCore.Gradient, Double, [Shadow])?, grain: Double,
                             look: TrackpadLook) {
        let radii = Array(repeating: radius, count: 4)
        if let side {
            let sb = BoxShape(rect: rect.offsetBy(dx: 0, dy: side.1), radii: radii)
            ctx.drawOuterShadows(side.2, sb)
            ctx.fillVertical(sb.path(), side.0, in: sb.rect)
        }
        let box = BoxShape(rect: rect.offsetBy(dx: 0, dy: look.dy), radii: radii)
        // `filter: brightness()` covers the whole button: its shadows, surface, grain and the ::after shadow.
        ctx.drawLayer { g in
            if look.brightness < 0.9999 { g.addFilter(.colorMultiply(Color(white: look.brightness))) }
            g.drawOuterShadows(shadows, box)
            g.fillVertical(box.path(), surface, in: box.rect)
            g.drawInsetShadows(shadows, box)
            Grain.draw(&g, in: box.path(), opacity: grain, baseFrequency: 1.1)
            if look.shadowAlpha > 0.001 {
                g.drawInsetShadows([Shadow(x: 0, y: look.shadowY, blur: look.shadowBlur, spread: 0,
                                           color: rgba(0, 0, 0, look.shadowAlpha), inset: true)], box)
            }
        }
    }
}

/// The animated values of a trackpad phase (the `.mk-tp` CSS states).
struct TrackpadLook: Equatable {
    var dy: Double, brightness: Double, shadowY: Double, shadowBlur: Double, shadowAlpha: Double

    init(dy: Double, brightness: Double, shadowY: Double, shadowBlur: Double, shadowAlpha: Double) {
        self.dy = dy; self.brightness = brightness; self.shadowY = shadowY; self.shadowBlur = shadowBlur; self.shadowAlpha = shadowAlpha
    }

    /// up: no move; down: 1 px, brightness .97, inset 0 1 5 rgba(0,0,0,.22); force: 1.8 px, .94, inset 0 2 9 rgba(0,0,0,.32).
    /// The `::after` shadow animates from `inset 0 0 0 0 rgba(0,0,0,0)`.
    init(_ phase: TrackpadPhase) {
        switch phase {
        case .up: self.init(dy: 0, brightness: 1, shadowY: 0, shadowBlur: 0, shadowAlpha: 0)
        case .down: self.init(dy: 1, brightness: 0.97, shadowY: 1, shadowBlur: 5, shadowAlpha: 0.22)
        case .force: self.init(dy: 1.8, brightness: 0.94, shadowY: 2, shadowBlur: 9, shadowAlpha: 0.32)
        }
    }

    var vector: AnimatablePair<AnimatablePair<Double, Double>, AnimatablePair<AnimatablePair<Double, Double>, Double>> {
        get { AnimatablePair(AnimatablePair(dy, brightness), AnimatablePair(AnimatablePair(shadowY, shadowBlur), shadowAlpha)) }
        set {
            dy = newValue.first.first; brightness = newValue.first.second
            shadowY = newValue.second.first.first; shadowBlur = newValue.second.first.second; shadowAlpha = newValue.second.second
        }
    }

    /// CSS: into `down` or `force` (class `mk-dn`) in 35 ms, back to up in 140 ms, cubic-bezier(.2,.8,.3,1).
    static func animation(to phase: TrackpadPhase) -> Animation {
        .timingCurve(0.2, 0.8, 0.3, 1, duration: phase == .up ? 0.140 : 0.035)
    }
}
