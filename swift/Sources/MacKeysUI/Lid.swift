import SwiftUI
import AppKit
import QuartzCore
import CoreImage
import MacKeysCore

/// Space for the open lid, in px at scale 1 (as the web `MacBook`): above the deck and on each side.
let lidSpace: CGFloat = 200
let lidSide: CGFloat = 120

/// Colors of the lid and its screen for one finish. Port of `lidModel` in `packages/core/src/dom.ts`.
struct LidModel {
    var lid: [String]
    var wall: CSSBackground
    var ribbonA: String, ribbonHi: String, ribbonB: String, ribbonC: String
    var ink: String
    var barBg: String
    var widgetBg: String
    var widgetShadows: [Shadow]
    var dockBg: String

    init(finish: FinishID) {
        let f = getFinish(finish)
        let rib = f.ribbon
        let darkInk = rib.darkInk
        lid = f.lid
        wall = CSSBackground(f.wall)
        ribbonA = rib.a; ribbonHi = rib.hi; ribbonB = rib.b; ribbonC = rib.c ?? rib.a
        ink = darkInk ? "#ffffff" : "#111114"
        barBg = darkInk ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.12)"
        widgetBg = darkInk ? "rgba(255,255,255,.16)" : "rgba(40,30,20,.12)"
        widgetShadows = darkInk
            ? [shadow(0, 0, 0, 1, "rgba(255,255,255,.28)", true), shadow(0, 4, 12, 0, "rgba(0,0,0,.18)")]
            : [shadow(0, 0, 0, 1, "rgba(0,0,0,.10)", true), shadow(0, 1, 0, 0, "rgba(255,255,255,.5)", true), shadow(0, 4, 12, 0, "rgba(0,0,0,.12)")]
        dockBg = darkInk ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.26)"
    }

    /// The 12 dock tiles: background (CSS) and glyph.
    static let apps: [(bg: String, glyph: Int)] = [
        ("linear-gradient(180deg, #ffffff 0%, #e4e8ef 100%)", 0),
        ("linear-gradient(180deg, #6fd3ff 0%, #1f7cff 100%)", 1),
        ("linear-gradient(180deg, #7cf08a 0%, #23b14d 100%)", 2),
        ("linear-gradient(180deg, #ffffff 0%, #eceff3 100%)", 3),
        ("linear-gradient(180deg, #ffd84d 0%, #ff9f0a 100%)", 4),
        ("linear-gradient(180deg, #ff8a80 0%, #ff3b30 100%)", 5),
        ("linear-gradient(180deg, #fffbe6 0%, #f4e6a6 100%)", 6),
        ("linear-gradient(180deg, #d7a8ff 0%, #8e44ff 100%)", 7),
        ("linear-gradient(180deg, #5ee0d0 0%, #10a39a 100%)", 8),
        ("linear-gradient(180deg, #3a3a40 0%, #141417 100%)", 9),
        ("linear-gradient(180deg, #ffffff 0%, #e9ecf1 100%)", 10),
        ("linear-gradient(180deg, #9be7ff 0%, #2bb7f0 100%)", 11)
    ]
}

/// The open lid: drawn flat (`width` x `height`), then projected like CSS
/// `perspective(4200px) rotateX(-80deg)` with `transform-origin: 50% 100%`.
struct LidView: View {
    let finish: FinishID
    let width: CGFloat
    let height: CGFloat
    let scale: CGFloat

    var body: some View {
        let m = LidModel(finish: finish), w = width, h = height, s = scale
        Canvas { ctx, _ in
            let ps = s * max(ctx.environment.displayScale, 1)
            ctx.scaleBy(x: s, y: s)
            LidDrawing.draw(&ctx, m, w, h, pixelScale: ps)
        }
        .frame(width: w * s, height: h * s)
        .projectionEffect(LidView.projection(width: w * s, height: h * s, perspective: 4200 * s))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// CSS `perspective(p) rotateX(-80deg)` about the bottom center of a `width` x `height` box.
    static func projection(width: CGFloat, height: CGFloat, perspective p: CGFloat, degrees: CGFloat = -80) -> ProjectionTransform {
        var persp = CATransform3DIdentity
        persp.m34 = -1 / p
        var t = CATransform3DMakeTranslation(-width / 2, -height, 0)
        t = CATransform3DConcat(t, CATransform3DMakeRotation(degrees * .pi / 180, 1, 0, 0))
        t = CATransform3DConcat(t, persp)
        t = CATransform3DConcat(t, CATransform3DMakeTranslation(width / 2, height, 0))
        return ProjectionTransform(t)
    }
}

enum LidDrawing {
    static let font = "-apple-system"

    static func draw(_ ctx: inout GraphicsContext, _ m: LidModel, _ W: CGFloat, _ H: CGFloat, pixelScale: CGFloat) {
        // Shell.
        let shell = BoxShape(rect: CGRect(x: 0, y: 0, width: W, height: H), radii: [20, 20, 12, 12])
        ctx.drawOuterShadows([MacKeysCore.shadow(0, 0, 0, 1, "rgba(0,0,0,.3)")], shell)
        let lidGrad = SwiftUI.Gradient(stops: [.init(color: Color(mk: color(m.lid[0])), location: 0),
                                               .init(color: Color(mk: color(m.lid[1])), location: 0.45),
                                               .init(color: Color(mk: color(m.lid[2])), location: 1)])
        ctx.fill(shell.path(), with: .linearGradient(lidGrad, startPoint: .zero, endPoint: CGPoint(x: 0, y: H)))
        ctx.drawInsetShadows([MacKeysCore.shadow(0, 0, 0, 1.5, "rgba(255,255,255,.4)", true)], shell)
        // Bezel.
        let bezel = BoxShape(rect: CGRect(x: 2, y: 3, width: W - 4, height: H - 6), radii: [17, 17, 9, 9])
        ctx.fill(bezel.path(), with: .color(Color(mk: "#050506")))
        ctx.drawInsetShadows([MacKeysCore.shadow(0, 0, 0, 1, "rgba(255,255,255,.07)", true),
                              MacKeysCore.shadow(0, 1, 0, 0, "rgba(255,255,255,.12)", true)], bezel)
        // Screen.
        let sr = CGRect(x: 6, y: 14, width: W - 12, height: H - 32)
        var sc = ctx
        sc.clip(to: roundedRect(sr, [10, 10, 2, 2]))
        sc.translateBy(x: sr.minX, y: sr.minY)
        drawScreen(&sc, m, sr.width, sr.height, pixelScale: pixelScale)
        // Notch and camera.
        ctx.fill(roundedRect(CGRect(x: W / 2 - 54, y: 3, width: 108, height: 22), [0, 0, 9, 9]), with: .color(Color(mk: "#050506")))
        let cam = CGRect(x: W / 2 - 3.5, y: 9, width: 7, height: 7)
        var cc = ctx
        cc.clip(to: Path(ellipseIn: cam))
        CSSBackground("radial-gradient(circle at 35% 35%, #2a3550 0%, #0b0d14 60%)").paint(&cc, in: cam)
    }

    static func drawScreen(_ ctx: inout GraphicsContext, _ m: LidModel, _ w: CGFloat, _ h: CGFloat, pixelScale: CGFloat) {
        let r = CGRect(x: 0, y: 0, width: w, height: h)
        m.wall.paint(&ctx, in: r)
        drawRibbons(&ctx, m, w, h, pixelScale: pixelScale)
        CSSBackground("radial-gradient(120% 95% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.28) 100%), linear-gradient(180deg, rgba(0,0,0,.14) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 80%, rgba(0,0,0,.18) 100%)")
            .paint(&ctx, in: r)
        drawMenuBar(&ctx, m, w)
        drawWidgets(&ctx, m)
        drawDock(&ctx, m, w, h)
        // Glass.
        CSSBackground("linear-gradient(155deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.02) 28%,rgba(255,255,255,0) 45%)").paint(&ctx, in: r)
        // Glimmer: a 9% wide band at 66%, 180% high from -40%, turned 18 degrees, opacity .14.
        var g = ctx
        g.opacity = 0.14
        let band = CGRect(x: 0.66 * w, y: -0.4 * h, width: 0.09 * w, height: 1.8 * h)
        g.translateBy(x: band.midX, y: band.midY)
        g.rotate(by: .degrees(18))
        let local = CGRect(x: -band.width / 2, y: -band.height / 2, width: band.width, height: band.height)
        CSSBackground("linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.14) 35%,rgba(255,255,255,.38) 50%,rgba(255,255,255,.14) 65%,rgba(255,255,255,0) 100%)")
            .paint(&g, in: local)
    }

    // ---- Ribbons (SVG, viewBox 0 0 1000 650, preserveAspectRatio none) ----

    static let ribbonShadowD = "M-60 600C170 470 330 380 490 420S790 560 1060 230L1060 330C820 680 600 600 470 520S200 600 -60 680Z"
    static let ribbonCD = "M300 -30C450 110 520 210 700 225S950 150 1060 255L1060 300C900 265 760 320 615 300S420 160 300 -30Z"
    static let ribbonAD = "M-60 520C150 380 300 250 480 300S780 520 1060 110L1060 165C820 620 600 560 470 470S200 520 -60 565Z"
    static let ribbonBD = "M-60 545C170 440 322 330 482 365S762 520 1060 140L1060 158C802 560 602 500 482 430S182 515 -60 555Z"
    static let edgeAD = "M-60 520C150 380 300 250 480 300S780 520 1060 110"
    static let edgeCD = "M300 -30C450 110 520 210 700 225S950 150 1060 255"

    /// Draws the ribbons. SVG filters blur in linearRGB (`color-interpolation-filters` default), so each blurred
    /// group is rendered offscreen and blurred with Core Image in linear sRGB, then drawn as an image.
    static func drawRibbons(_ ctx: inout GraphicsContext, _ m: LidModel, _ w: CGFloat, _ h: CGFloat, pixelScale: CGFloat) {
        guard let img = RibbonCache.image(m, w, h, pixelScale) else { return }
        ctx.draw(Image(decorative: img, scale: pixelScale), in: CGRect(x: 0, y: 0, width: w, height: h))
    }

    // ---- Menu bar ----

    /// Draws `s` with the top-left of its CSS line box (line-height 1) at `p`. Returns the advance width.
    @discardableResult
    static func drawText(_ ctx: inout GraphicsContext, _ s: String, size: CGFloat, weight: NSFont.Weight,
                         tracking: CGFloat = 0, color: MKColor, at p: CGPoint) -> CGFloat {
        let t = CSSText(s, size: size, weight: weight, tracking: tracking)
        t.draw(&ctx, at: p, color: color, weight: weight)
        return t.width
    }

    static func drawMenuBar(_ ctx: inout GraphicsContext, _ m: LidModel, _ w: CGFloat) {
        let ink = Color(mk: color(m.ink))
        var bar = ctx
        bar.opacity = 0.8
        bar.drawLayer { c in
            c.fill(Path(CGRect(x: 0, y: 0, width: w, height: 30)), with: .color(Color(mk: color(m.barBg))))
            // Items sit in an 18 px high flex row (the wifi glyph with its 2 px top margin), centered in the bar.
            let mid: CGFloat = 15
            var x: CGFloat = 16
            for (i, t) in ["Finder", "File", "Edit", "View", "Go", "Window", "Help"].enumerated() {
                x += drawText(&c, t, size: 14, weight: i == 0 ? .bold : .medium, color: m.ink, at: CGPoint(x: x, y: mid - 7)) + 14
            }
            // Right group, laid out from the right edge.
            let cw = CSSText("Tue 9:41", size: 14, weight: .medium).width
            var rx = w - 16 - cw
            drawText(&c, "Tue 9:41", size: 14, weight: .medium, color: m.ink, at: CGPoint(x: rx, y: mid - 7))
            rx -= 13 + 16
            drawControlCenter(&c, CGPoint(x: rx, y: mid - 6), ink)
            rx -= 13 + 10
            drawSearch(&c, CGPoint(x: rx, y: mid - 5), ink)
            rx -= 13 + 24
            drawBattery(&c, CGPoint(x: rx, y: mid - 6), ink)
            rx -= 13 + 16
            drawWifi(&c, CGPoint(x: rx, y: mid - 9 + 2), ink)
        }
    }

    static func drawWifi(_ c: inout GraphicsContext, _ o: CGPoint, _ ink: Color) {
        // 16 x 16 box, top corners rounded 8 (16 px radii scaled to fit), a 90 degree sector from the bottom center.
        var g = c
        g.opacity = 0.95
        g.clip(to: roundedRect(CGRect(x: o.x, y: o.y, width: 16, height: 16), [8, 8, 0, 0]))
        var tri = Path()
        tri.move(to: CGPoint(x: o.x + 8, y: o.y + 16))
        tri.addLine(to: CGPoint(x: o.x, y: o.y))
        tri.addLine(to: CGPoint(x: o.x + 16, y: o.y))
        tri.closeSubpath()
        g.fill(tri, with: .color(ink))
    }

    static func drawBattery(_ c: inout GraphicsContext, _ o: CGPoint, _ ink: Color) {
        var g = c
        g.opacity = 0.95
        g.drawLayer { l in
            var ring = roundedRect(CGRect(x: o.x, y: o.y, width: 24, height: 12), [4, 4, 4, 4])
            ring.addPath(roundedRect(CGRect(x: o.x + 1.5, y: o.y + 1.5, width: 21, height: 9), [2.5, 2.5, 2.5, 2.5]))
            l.fill(ring, with: .color(ink), style: FillStyle(eoFill: true))
            l.fill(roundedRect(CGRect(x: o.x + 3, y: o.y + 3, width: 21 * 0.48, height: 6), [1.5, 1.5, 1.5, 1.5]), with: .color(ink))
            l.fill(roundedRect(CGRect(x: o.x + 24.5, y: o.y + 4.5, width: 2, height: 4), [0, 1, 1, 0]), with: .color(ink))
        }
    }

    static func drawSearch(_ c: inout GraphicsContext, _ o: CGPoint, _ ink: Color) {
        var ring = Path(ellipseIn: CGRect(x: o.x, y: o.y, width: 10, height: 10))
        ring.addPath(Path(ellipseIn: CGRect(x: o.x + 1.8, y: o.y + 1.8, width: 6.4, height: 6.4)))
        c.fill(ring, with: .color(ink), style: FillStyle(eoFill: true))
        // Handle: 5 x 1.8 at right -4, bottom -3 of the padding box, turned 45 degrees about its center.
        var h = c
        h.translateBy(x: o.x + 9.7, y: o.y + 10.3)
        h.rotate(by: .degrees(45))
        h.fill(Path(CGRect(x: -2.5, y: -0.9, width: 5, height: 1.8)), with: .color(ink))
    }

    static func drawControlCenter(_ c: inout GraphicsContext, _ o: CGPoint, _ ink: Color) {
        for dy in [CGFloat(0), 7] {
            var p = roundedRect(CGRect(x: o.x, y: o.y + dy, width: 16, height: 5), [2.5, 2.5, 2.5, 2.5])
            p.addPath(roundedRect(CGRect(x: o.x + 1.4, y: o.y + dy + 1.4, width: 13.2, height: 2.2), [1.1, 1.1, 1.1, 1.1]))
            c.fill(p, with: .color(ink), style: FillStyle(eoFill: true))
        }
    }

    // ---- Widgets ----

    static func drawWidgets(_ ctx: inout GraphicsContext, _ m: LidModel) {
        let ink = Color(mk: color(m.ink))
        for i in 0..<2 {
            let r = CGRect(x: 34, y: 52 + CGFloat(i) * 114, width: 100, height: 104)
            let box = BoxShape(rect: r, radii: [20, 20, 20, 20])
            ctx.drawOuterShadows(m.widgetShadows, box)
            ctx.fill(box.path(), with: .color(Color(mk: color(m.widgetBg))))
            ctx.drawInsetShadows(m.widgetShadows, box)
            if i == 0 {
                drawText(&ctx, "14°", size: 34, weight: .regular, tracking: -0.68, color: m.ink, at: CGPoint(x: r.minX + 12, y: r.minY + 11))
                drawSun(&ctx, CGRect(x: r.maxX - 12 - 22, y: r.maxY - 11 - 22, width: 22, height: 22))
            } else {
                let ring = CGRect(x: r.minX + 12, y: r.minY + 11, width: 40, height: 40)
                let c = CGPoint(x: ring.midX, y: ring.midY)
                var green = Path(), gray = Path()
                green.addArc(center: c, radius: 18, startAngle: .degrees(90), endAngle: .degrees(270), clockwise: false)
                gray.addArc(center: c, radius: 18, startAngle: .degrees(-90), endAngle: .degrees(90), clockwise: false)
                ctx.stroke(green, with: .color(Color(mk: "#30d158")), lineWidth: 4)
                ctx.stroke(gray, with: .color(Color(mk: color("rgba(160,160,165,.45)"))), lineWidth: 4)
                drawText(&ctx, "49%", size: 34, weight: .regular, tracking: -0.68, color: m.ink, at: CGPoint(x: r.minX + 12, y: r.maxY - 11 - 34))
            }
        }
    }

    static func drawSun(_ ctx: inout GraphicsContext, _ r: CGRect) {
        let sun = Color(mk: "#ffd84d")
        var g = ctx
        g.clip(to: Path(ellipseIn: r))
        let c = CGPoint(x: r.midX, y: r.midY)
        let far = (2 * 11.0 * 11.0).squareRoot()
        var rays = Path()
        for i in 0..<8 {
            let a0 = (Double(i) * 0.125) * 360 - 90, a1 = a0 + 0.06 * 360
            rays.move(to: c)
            rays.addArc(center: c, radius: far + 2, startAngle: .degrees(a0), endAngle: .degrees(a1), clockwise: false)
            rays.closeSubpath()
        }
        g.fill(rays, with: .color(sun))
        g.fill(Path(ellipseIn: CGRect(x: c.x - 0.46 * far, y: c.y - 0.46 * far, width: 0.92 * far, height: 0.92 * far)), with: .color(sun))
    }

    // ---- Dock ----

    static func drawDock(_ ctx: inout GraphicsContext, _ m: LidModel, _ w: CGFloat, _ h: CGFloat) {
        let dw: CGFloat = 342, dh: CGFloat = 52
        let d = CGRect(x: (w - dw) / 2, y: h - 16 - dh, width: dw, height: dh)
        let box = BoxShape(rect: d, radii: [13, 13, 13, 13])
        let shadows = [MacKeysCore.shadow(0, 0, 0, 1, "rgba(255,255,255,.28)", true), MacKeysCore.shadow(0, 3, 10, 0, "rgba(0,0,0,.12)")]
        ctx.drawOuterShadows(shadows, box)
        ctx.fill(box.path(), with: .color(Color(mk: color(m.dockBg))))
        ctx.drawInsetShadows(shadows, box)
        var x = d.minX + 6
        for a in LidModel.apps {
            drawApp(&ctx, CGRect(x: x, y: d.minY + 5, width: 22, height: 42), a.bg, glyph: a.glyph)
            x += 25
        }
        ctx.fill(Path(CGRect(x: x + 2, y: d.minY + 9, width: 1, height: 34)), with: .color(Color(mk: color("rgba(255,255,255,.45)"))))
        x += 8
        drawApp(&ctx, CGRect(x: x, y: d.minY + 5, width: 22, height: 42), "linear-gradient(160deg, #f2f2f4 0%, #c9cbd1 100%)", glyph: nil)
    }

    static func drawApp(_ ctx: inout GraphicsContext, _ r: CGRect, _ bg: String, glyph: Int?) {
        let box = BoxShape(rect: r, radii: [7, 7, 7, 7])
        let shadows = [MacKeysCore.shadow(0, 1, 0, 0, "rgba(255,255,255,.35)", true), MacKeysCore.shadow(0, 1, 2, 0, "rgba(0,0,0,.25)")]
        ctx.drawOuterShadows(shadows, box)
        var c = ctx
        c.clip(to: box.path())
        CSSBackground(bg).paint(&c, in: r)
        ctx.drawInsetShadows(shadows, box)
        guard let glyph else { return }
        var g = ctx
        g.translateBy(x: r.midX, y: r.midY)
        if glyph == 4 { g.rotate(by: .degrees(35)) } else { g.scaleBy(x: 0.8, y: 1.5) }
        drawGlyph(&g, glyph)
    }

    /// The glyph styles of `APPS` in `dom.ts`, centered on the origin.
    static func drawGlyph(_ g: inout GraphicsContext, _ i: Int) {
        let white95 = Color.white.opacity(0.95), white9 = Color.white.opacity(0.9)
        func rect(_ w: CGFloat, _ h: CGFloat) -> CGRect { CGRect(x: -w / 2, y: -h / 2, width: w, height: h) }
        func ring(_ r: CGRect, _ radius: CGFloat, _ b: CGFloat) -> Path {
            var p = roundedRect(r, [radius, radius, radius, radius])
            let ir = max(0, radius - b)
            p.addPath(roundedRect(r.insetBy(dx: b, dy: b), [ir, ir, ir, ir]))
            return p
        }
        switch i {
        case 0:
            let r = rect(16, 14)
            var c = g
            c.clip(to: roundedRect(r, [3, 3, 3, 3]))
            c.fill(Path(CGRect(x: r.minX, y: r.minY, width: 8, height: 14)), with: .color(Color(mk: "#2d7cf6")))
            c.fill(Path(CGRect(x: r.minX + 8, y: r.minY, width: 8, height: 14)), with: .color(Color(mk: "#9fd0ff")))
        case 1:
            g.fill(ring(rect(14, 14), 7, 2.5), with: .color(white95), style: FillStyle(eoFill: true))
        case 2:
            g.fill(roundedRect(rect(14, 10), [5, 5, 5, 5]), with: .color(white95))
        case 3:
            let r = rect(14, 15)
            let box = BoxShape(rect: r, radii: [3, 3, 3, 3])
            var c = g
            c.clip(to: box.path())
            c.fill(Path(r), with: .color(.white))
            c.fill(Path(CGRect(x: r.minX, y: r.minY, width: 14, height: 4.5)), with: .color(Color(mk: "#ff3b30")))
            g.drawInsetShadows([MacKeysCore.shadow(0, 0, 0, 1, "#d6d9df", true)], box)
        case 4:
            g.fill(roundedRect(rect(6, 16), [3, 3, 3, 3]), with: .color(white95))
        case 5:
            g.fill(Path(ellipseIn: rect(12, 12)), with: .color(white95))
        case 6:
            let r = rect(14, 3)
            g.fill(roundedRect(r.offsetBy(dx: 0, dy: 5), [1.5, 1.5, 1.5, 1.5]), with: .color(Color(mk: "#d9b94a")))
            g.fill(roundedRect(r.offsetBy(dx: 0, dy: -5), [1.5, 1.5, 1.5, 1.5]), with: .color(Color(mk: "#c9a227")))
            g.fill(roundedRect(r, [1.5, 1.5, 1.5, 1.5]), with: .color(Color(mk: "#c9a227")))
        case 7:
            g.fill(ring(rect(14, 14), 4, 2.5), with: .color(white9), style: FillStyle(eoFill: true))
        case 8:
            let r = rect(12, 12)
            var p = Path()
            p.move(to: CGPoint(x: 0, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
            p.closeSubpath()
            g.fill(p, with: .color(white95))
        case 9:
            g.fill(ring(rect(14, 9), 2, 2), with: .color(Color(mk: "#4cd964")), style: FillStyle(eoFill: true))
        case 10:
            let colors = ["#ff3b30", "#ffcc00", "#34c759", "#007aff"]
            var c = g
            c.clip(to: Path(ellipseIn: rect(14, 14)))
            for (k, col) in colors.enumerated() {
                var p = Path()
                p.move(to: .zero)
                p.addArc(center: .zero, radius: 12, startAngle: .degrees(-90 + Double(k) * 90), endAngle: .degrees(Double(k) * 90), clockwise: false)
                p.closeSubpath()
                c.fill(p, with: .color(Color(mk: col)))
            }
        default:
            // A ring without its top border (the top quarter, -45 to 45 degrees from the top).
            var c = g
            var keep = Path()
            keep.move(to: .zero)
            keep.addArc(center: .zero, radius: 12, startAngle: .degrees(-45), endAngle: .degrees(225), clockwise: false)
            keep.closeSubpath()
            c.clip(to: keep)
            c.fill(ring(rect(14, 14), 7, 2.5), with: .color(white9), style: FillStyle(eoFill: true))
        }
    }
}

/// Renders the wallpaper ribbons of one screen size once per finish and pixel scale.
enum RibbonCache {
    nonisolated(unsafe) private static var cache: [String: CGImage] = [:]
    private static let lock = NSLock()
    private static let ci = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!])

    static func image(_ m: LidModel, _ w: CGFloat, _ h: CGFloat, _ ps: CGFloat) -> CGImage? {
        let key = [m.ribbonA, m.ribbonHi, m.ribbonB, m.ribbonC, "\(w)", "\(h)", "\(ps)"].joined(separator: "|")
        lock.lock(); defer { lock.unlock() }
        if let img = cache[key] { return img }
        let img = render(m, w, h, ps)
        if cache.count > 16 { cache.removeAll() }
        cache[key] = img
        return img
    }

    private static func cg(_ c: String, _ opacity: Double = 1) -> CGColor {
        let p = (try? parseColor(c)) ?? RGBA(r: 0, g: 0, b: 0, a: 1)
        return CGColor(srgbRed: p.r / 255, green: p.g / 255, blue: p.b / 255, alpha: p.a * opacity)
    }

    private static func cgPath(_ d: String, _ t: CGAffineTransform) -> CGPath { svgPath(d).applying(t).cgPath }

    private static func render(_ m: LidModel, _ w: CGFloat, _ h: CGFloat, _ ps: CGFloat) -> CGImage? {
        // The filters see the whole group (it reaches past the screen), so render with a margin, then crop.
        let pad: CGFloat = 80
        let W = Int((w * ps).rounded(.up)), H = Int((h * ps).rounded(.up))
        let PW = Int(((w + 2 * pad) * ps).rounded(.up)), PH = Int(((h + 2 * pad) * ps).rounded(.up))
        guard W > 0, H > 0 else { return nil }
        let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
        func context() -> CGContext? {
            guard let c = CGContext(data: nil, width: PW, height: PH, bitsPerComponent: 8, bytesPerRow: 0, space: srgb,
                                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
            c.translateBy(x: 0, y: CGFloat(PH))
            c.scaleBy(x: ps, y: -ps)
            c.translateBy(x: pad, y: pad)
            return c
        }
        let sx = w / 1000, sy = h / 650, k = (sx + sy) / 2
        let t = CGAffineTransform(scaleX: sx, y: sy)
        // One blurred group: draw, blur in linear light (sigma in viewBox units), back to sRGB.
        func group(_ sd: CGFloat, _ body: (CGContext) -> Void) -> CGImage? {
            guard let c = context() else { return nil }
            body(c)
            guard let flat = c.makeImage() else { return nil }
            // Core Image has its origin at the bottom left; the screen is the middle of the padded image.
            let r = CGRect(x: CGFloat(PW - W) / 2, y: CGFloat(PH - H) / 2, width: CGFloat(W), height: CGFloat(H)).integral
            let blurred = CIImage(cgImage: flat).applyingGaussianBlur(sigma: Double(sd * k * ps))
            return ci.createCGImage(blurred, from: r, format: .RGBA8, colorSpace: srgb)
        }
        var layers: [CGImage?] = []
        layers.append(group(22) { c in
            c.addPath(cgPath(LidDrawing.ribbonShadowD, t)); c.setFillColor(cg(m.ribbonB, 0.35)); c.fillPath()
        })
        layers.append(group(7) { c in
            c.addPath(cgPath(LidDrawing.ribbonCD, t)); c.setFillColor(cg(m.ribbonC, 0.85)); c.fillPath()
            let a = cgPath(LidDrawing.ribbonAD, t), bb = a.boundingBoxOfPath
            c.saveGState()
            c.addPath(a); c.clip()
            let g = CGGradient(colorsSpace: srgb, colors: [cg(m.ribbonA, 0.55), cg(m.ribbonA), cg(m.ribbonHi, 0.5)] as CFArray, locations: [0, 0.5, 1])!
            c.drawLinearGradient(g, start: CGPoint(x: bb.minX, y: 0), end: CGPoint(x: bb.maxX, y: 0), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
            c.restoreGState()
            c.addPath(cgPath(LidDrawing.ribbonBD, t)); c.setFillColor(cg(m.ribbonB, 0.95)); c.fillPath()
        })
        // Stroke widths scale with the non-uniform viewBox; use the mean.
        layers.append(group(7) { c in
            c.addPath(cgPath(LidDrawing.edgeAD, t)); c.setStrokeColor(cg("#f4fbff", 0.9)); c.setLineWidth(5 * k); c.strokePath()
        })
        layers.append(group(7) { c in
            c.addPath(cgPath(LidDrawing.edgeCD, t)); c.setStrokeColor(cg("#ffffff", 0.6)); c.setLineWidth(3 * k); c.strokePath()
        })
        guard let out = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: srgb,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        for l in layers.compactMap({ $0 }) { out.draw(l, in: CGRect(x: 0, y: 0, width: W, height: H)) }
        return out.makeImage()
    }
}
