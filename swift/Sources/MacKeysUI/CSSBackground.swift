import SwiftUI
import MacKeysCore

/// A small parser and painter for the CSS backgrounds that the web lid uses: a comma list of
/// `linear-gradient(<angle>deg, stops)` and `radial-gradient([<w>% <h>% | circle] [at <x>% <y>%], stops)` layers.
/// Stops are `<color> [<pos> [<pos>]]` with `%` or `px` positions. Other forms give no layer.
struct CSSBackground: Equatable {
    struct Stop: Equatable {
        var color: MKColor
        /// Position as a fraction (from `%`), or nil when missing.
        var at: Double?
        /// Position in px, or nil.
        var px: Double?
    }

    enum Shape: Equatable {
        /// CSS angle in degrees (0 = to top, 90 = to right).
        case linear(angle: Double)
        /// Ellipse radii as fractions of the box (nil = circle, farthest corner) and center as fractions.
        case radial(rx: Double?, ry: Double?, cx: Double, cy: Double)
    }

    struct Layer: Equatable {
        var shape: Shape
        var stops: [Stop]
    }

    /// Layers in CSS order: the first layer is on top.
    var layers: [Layer]

    init(_ css: String) {
        layers = CSSBackground.splitTop(css).compactMap(CSSBackground.parseLayer)
    }

    /// Splits at commas that are not inside parentheses.
    static func splitTop(_ s: String) -> [String] {
        var out: [String] = [], cur = "", depth = 0
        for c in s {
            if c == "(" { depth += 1 } else if c == ")" { depth -= 1 }
            if c == ",", depth == 0 { out.append(cur.trimmingCharacters(in: .whitespaces)); cur = ""; continue }
            cur.append(c)
        }
        let t = cur.trimmingCharacters(in: .whitespaces)
        if !t.isEmpty { out.append(t) }
        return out
    }

    /// Splits at spaces that are not inside parentheses.
    static func splitSpaces(_ s: String) -> [String] {
        var out: [String] = [], cur = "", depth = 0
        for c in s {
            if c == "(" { depth += 1 } else if c == ")" { depth -= 1 }
            if c == " ", depth == 0 { if !cur.isEmpty { out.append(cur) }; cur = ""; continue }
            cur.append(c)
        }
        if !cur.isEmpty { out.append(cur) }
        return out
    }

    static func parseLayer(_ s: String) -> Layer? {
        guard let open = s.firstIndex(of: "("), s.hasSuffix(")") else { return nil }
        let fn = s[..<open].trimmingCharacters(in: .whitespaces)
        let args = splitTop(String(s[s.index(after: open)..<s.index(before: s.endIndex)]))
        guard !args.isEmpty else { return nil }
        var rest = args[...]
        let shape: Shape
        switch fn {
        case "linear-gradient":
            if let a = args.first, a.hasSuffix("deg") {
                shape = .linear(angle: Double(a.dropLast(3)) ?? 180)
                rest = rest.dropFirst()
            } else {
                shape = .linear(angle: 180)
            }
        case "radial-gradient":
            let first = splitSpaces(args[0])
            if first.first.map({ $0 == "circle" || $0 == "ellipse" || $0.hasSuffix("%") || $0 == "at" }) == true {
                rest = rest.dropFirst()
                var rx: Double?, ry: Double?, cx = 0.5, cy = 0.5
                var i = 0
                var sizes: [Double] = []
                while i < first.count, first[i] != "at" {
                    if first[i].hasSuffix("%") { sizes.append((Double(first[i].dropLast()) ?? 0) / 100) }
                    i += 1
                }
                if sizes.count >= 2 { rx = sizes[0]; ry = sizes[1] }
                if i < first.count, first[i] == "at", i + 2 < first.count {
                    cx = (Double(first[i + 1].dropLast()) ?? 50) / 100
                    cy = (Double(first[i + 2].dropLast()) ?? 50) / 100
                }
                shape = .radial(rx: rx, ry: ry, cx: cx, cy: cy)
            } else {
                shape = .radial(rx: nil, ry: nil, cx: 0.5, cy: 0.5)
            }
        default:
            return nil
        }
        var stops: [Stop] = []
        for a in rest {
            let parts = splitSpaces(a)
            guard let c = parts.first else { continue }
            let col = color(c)
            func pos(_ p: String) -> Stop {
                if p.hasSuffix("%") { return Stop(color: col, at: (Double(p.dropLast()) ?? 0) / 100) }
                if p.hasSuffix("px") { return Stop(color: col, px: Double(p.dropLast(2)) ?? 0) }
                return Stop(color: col, at: Double(p) ?? 0)
            }
            if parts.count == 1 { stops.append(Stop(color: col)) }
            for p in parts.dropFirst() { stops.append(pos(p)) }
        }
        return stops.isEmpty ? nil : Layer(shape: shape, stops: stops)
    }

    /// CSS stop fix-up: px to fractions of `length`, first 0, last 1, never decreasing, missing ones spread evenly.
    static func resolve(_ stops: [Stop], length: Double) -> [SwiftUI.Gradient.Stop] {
        var at: [Double?] = stops.map { s in s.at ?? s.px.map { $0 / max(length, 0.0001) } }
        if at.first! == nil { at[0] = 0 }
        if at.last! == nil { at[at.count - 1] = 1 }
        var maxSoFar = -Double.infinity
        for i in at.indices { if let v = at[i] { at[i] = max(v, maxSoFar); maxSoFar = at[i]! } }
        var i = 0
        while i < at.count {
            if at[i] == nil {
                var j = i
                while at[j] == nil { j += 1 }
                let a = at[i - 1]!, b = at[j]!
                for k in i..<j { at[k] = a + (b - a) * Double(k - i + 1) / Double(j - i + 1) }
                i = j
            }
            i += 1
        }
        return zip(stops, at).map { .init(color: Color(mk: $0.color), location: $1!) }
    }

    /// Paints all layers into `rect` (bottom layer first). The caller clips.
    func paint(_ ctx: inout GraphicsContext, in rect: CGRect) {
        for l in layers.reversed() { CSSBackground.paint(l, &ctx, rect) }
    }

    static func paint(_ l: Layer, _ ctx: inout GraphicsContext, _ r: CGRect) {
        switch l.shape {
        case .linear(let angle):
            let a = angle * .pi / 180
            let dx = sin(a), dy = -cos(a)
            let len = abs(r.width * sin(a)) + abs(r.height * cos(a))
            let c = CGPoint(x: r.midX, y: r.midY)
            let g = SwiftUI.Gradient(stops: resolve(l.stops, length: len))
            ctx.fill(Path(r), with: .linearGradient(g, startPoint: CGPoint(x: c.x - dx * len / 2, y: c.y - dy * len / 2),
                                                    endPoint: CGPoint(x: c.x + dx * len / 2, y: c.y + dy * len / 2)))
        case .radial(let rx0, let ry0, let cx, let cy):
            let center = CGPoint(x: r.minX + cx * r.width, y: r.minY + cy * r.height)
            var rx: Double, ry: Double
            if let rx0, let ry0 {
                rx = rx0 * r.width; ry = ry0 * r.height
            } else {
                // circle, farthest-corner
                let fx = max(center.x - r.minX, r.maxX - center.x), fy = max(center.y - r.minY, r.maxY - center.y)
                rx = (fx * fx + fy * fy).squareRoot(); ry = rx
            }
            rx = max(rx, 0.0001); ry = max(ry, 0.0001)
            let g = SwiftUI.Gradient(stops: resolve(l.stops, length: rx))
            var c = ctx
            c.clip(to: Path(r))
            c.translateBy(x: center.x, y: center.y)
            c.scaleBy(x: rx, y: ry)
            let big = CGRect(x: -(center.x - r.minX) / rx - 1, y: -(center.y - r.minY) / ry - 1,
                             width: r.width / rx + 2, height: r.height / ry + 2)
            c.fill(Path(big), with: .radialGradient(g, center: .zero, startRadius: 0, endRadius: 1))
        }
    }
}
