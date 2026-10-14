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
    /// `rect` is the surface rect; the phase moves only the surface.
    static func drawTrackpad(_ ctx: inout GraphicsContext, rect: CGRect, radius: CGFloat, surface: MacKeysCore.Gradient,
                             shadows: [Shadow], side: (MacKeysCore.Gradient, Double, [Shadow])?, phase: TrackpadPhase) {
        let radii = Array(repeating: radius, count: 4)
        if let side {
            let sb = BoxShape(rect: rect.offsetBy(dx: 0, dy: side.1), radii: radii)
            ctx.drawOuterShadows(side.2, sb)
            ctx.fillVertical(sb.path(), side.0, in: sb.rect)
        }
        let dy: CGFloat = phase == .force ? 1.8 : phase == .down ? 1 : 0
        let bright: Double = phase == .force ? 0.94 : phase == .down ? 0.97 : 1
        let box = BoxShape(rect: rect.offsetBy(dx: 0, dy: dy), radii: radii)
        ctx.drawLayer { g in
            if bright != 1 { g.addFilter(.colorMultiply(Color(white: bright))) }
            g.drawOuterShadows(shadows, box)
            g.fillVertical(box.path(), surface, in: box.rect)
            g.drawInsetShadows(shadows, box)
        }
        switch phase {
        case .down: ctx.drawInsetShadows([MacKeysCore.shadow(0, 1, 5, 0, "rgba(0,0,0,.22)", true)], box)
        case .force: ctx.drawInsetShadows([MacKeysCore.shadow(0, 2, 9, 0, "rgba(0,0,0,.32)", true)], box)
        case .up: break
        }
    }
}
