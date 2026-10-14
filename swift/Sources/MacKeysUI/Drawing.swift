import SwiftUI
import AppKit
import MacKeysCore

// Drawing primitives: colors, SVG paths, rounded rects, CSS box shadows and gradients for GraphicsContext.

public extension Color {
    /// Creates a color from a MacKeys `#rrggbbaa` string (any CSS color `parseColor` accepts).
    init(mk c: MKColor) {
        let p = (try? parseColor(c)) ?? RGBA(r: 0, g: 0, b: 0, a: 0)
        self.init(.sRGB, red: p.r / 255, green: p.g / 255, blue: p.b / 255, opacity: p.a)
    }
}

public extension MacKeysCore.Gradient {
    /// The gradient as a SwiftUI gradient (stops in order).
    var swiftUI: SwiftUI.Gradient {
        SwiftUI.Gradient(stops: stops.map { .init(color: Color(mk: $0.color), location: $0.at) })
    }
}

/// Builds a SwiftUI `Path` from SVG path data. Invalid data gives an empty path.
public func svgPath(_ d: String) -> Path {
    var p = Path()
    guard !d.isEmpty, let segs = try? SVGPath.parse(d) else { return p }
    for s in segs {
        switch s {
        case .move(let x, let y): p.move(to: CGPoint(x: x, y: y))
        case .line(let x, let y): p.addLine(to: CGPoint(x: x, y: y))
        case .cubic(let ax, let ay, let bx, let by, let x, let y):
            p.addCurve(to: CGPoint(x: x, y: y), control1: CGPoint(x: ax, y: ay), control2: CGPoint(x: bx, y: by))
        case .close: p.closeSubpath()
        }
    }
    return p
}

/// A rounded rect with radii top-left, top-right, bottom-right, bottom-left (CSS order).
func roundedRect(_ r: CGRect, _ radii: [CGFloat]) -> Path {
    guard r.width > 0, r.height > 0 else { return Path() }
    let maxR = min(r.width, r.height) / 2
    func c(_ i: Int) -> CGFloat { max(0, min(maxR, i < radii.count ? radii[i] : radii.last ?? 0)) }
    return Path(roundedRect: r, cornerRadii: RectangleCornerRadii(topLeading: c(0), bottomLeading: c(3), bottomTrailing: c(2), topTrailing: c(1)))
}

/// A shape that can grow or shrink by a CSS spread distance.
struct BoxShape {
    var rect: CGRect
    var radii: [CGFloat]
    var ellipse = false

    func path(offset: CGSize = .zero, spread: CGFloat = 0) -> Path {
        let r = rect.offsetBy(dx: offset.width, dy: offset.height).insetBy(dx: -spread, dy: -spread)
        if ellipse { return Path(ellipseIn: r) }
        return roundedRect(r, radii.map { $0 + spread })
    }
}

/// CSS blur radius to a Gaussian radius for GraphicsContext.
@inline(__always) func gaussian(_ blur: Double) -> CGFloat { CGFloat(blur) / 2 }

extension GraphicsContext {
    /// Draws CSS outer box shadows (the list is front to back, as in CSS). Clipped to the outside of the box.
    func drawOuterShadows(_ shadows: [Shadow], _ box: BoxShape) {
        for s in shadows.reversed() where !s.inset {
            var c = self
            var clip = Path(box.rect.insetBy(dx: -4000, dy: -4000))
            clip.addPath(box.path())
            c.clip(to: clip, style: FillStyle(eoFill: true))
            if s.blur > 0 { c.addFilter(.blur(radius: gaussian(s.blur))) }
            c.fill(box.path(offset: CGSize(width: s.x, height: s.y), spread: s.spread), with: .color(Color(mk: s.color)))
        }
    }

    /// Draws CSS inset box shadows (front to back list). Clipped to the inside of the box.
    func drawInsetShadows(_ shadows: [Shadow], _ box: BoxShape) {
        for s in shadows.reversed() where s.inset {
            var c = self
            c.clip(to: box.path())
            if s.blur > 0 { c.addFilter(.blur(radius: gaussian(s.blur))) }
            var p = Path(box.rect.insetBy(dx: -200, dy: -200))
            p.addPath(box.path(offset: CGSize(width: s.x, height: s.y), spread: -s.spread))
            c.fill(p, with: .color(Color(mk: s.color)), style: FillStyle(eoFill: true))
        }
    }

    /// Fills a path with a vertical linear gradient across `rect`.
    func fillVertical(_ path: Path, _ g: MacKeysCore.Gradient, in rect: CGRect) {
        fill(path, with: .linearGradient(g.swiftUI, startPoint: CGPoint(x: rect.midX, y: rect.minY), endPoint: CGPoint(x: rect.midX, y: rect.maxY)))
    }

    /// Fills a path with an elliptical radial gradient centered at `center` with radii `rx`, `ry`.
    func fillElliptical(_ path: Path, center: CGPoint, rx: CGFloat, ry: CGFloat, inner: Color, outer: Color) {
        var c = self
        c.clip(to: path)
        c.translateBy(x: center.x, y: center.y)
        c.scaleBy(x: max(rx, 0.001), y: max(ry, 0.001))
        c.fill(Path(CGRect(x: -4, y: -4, width: 8, height: 8)),
               with: .radialGradient(SwiftUI.Gradient(colors: [inner, outer]), center: .zero, startRadius: 0, endRadius: 1))
    }

    /// Draws glows (blurred copies, offset 0) of something drawn by `body`, then nothing else.
    func drawGlows(_ glows: [TextGlow], _ body: (inout GraphicsContext, Color) -> Void) {
        for g in glows.reversed() {
            drawLayer { l in
                if g.blur > 0 { l.addFilter(.blur(radius: gaussian(g.blur))) }
                body(&l, Color(mk: g.color))
            }
        }
    }
}

/// Font metrics of the system font, used to place a CSS line box (line-height 1).
enum FontMetrics {
    /// Distance from the top of a `size`-high line box to the baseline.
    static func baseline(size: CGFloat) -> CGFloat {
        let f = NSFont.systemFont(ofSize: size)
        let a = f.ascender, d = -f.descender
        return (size - (a + d)) / 2 + a
    }
}
