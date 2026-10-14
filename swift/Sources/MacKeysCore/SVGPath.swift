import Foundation

/// One absolute path segment. Arcs and quadratic curves are converted to cubic Béziers.
public enum PathSegment: Sendable, Equatable {
    case move(x: Double, y: Double)
    case line(x: Double, y: Double)
    case cubic(c1x: Double, c1y: Double, c2x: Double, c2y: Double, x: Double, y: Double)
    case close
}

public enum SVGPathError: Error, Equatable {
    case unexpected(Character, offset: Int)
    case missingNumber(offset: Int)
}

/// Parses SVG path data (`M L H V A C S Q T Z`, absolute and relative, implicit repeated commands,
/// compact numbers such as `.55` and `-1.2-3`, compact arc flags). Foundation only.
public enum SVGPath {
    public static func parse(_ d: String) throws -> [PathSegment] {
        var p = Scanner(Array(d.utf8))
        var out: [PathSegment] = []
        var cx = 0.0, cy = 0.0, sx = 0.0, sy = 0.0
        // Last control point for S and T reflection.
        var lastC: (Double, Double)? = nil, lastQ: (Double, Double)? = nil
        var cmd: UInt8 = 0
        while true {
            p.skipSeparators()
            guard let ch = p.peek() else { break }
            if isCommand(ch) {
                cmd = ch
                p.i += 1
            } else if cmd == 0 || !(isNumberStart(ch)) {
                throw SVGPathError.unexpected(Character(UnicodeScalar(ch)), offset: p.i)
            }
            let rel = cmd >= 97
            let up = rel ? cmd - 32 : cmd
            var nextC: (Double, Double)? = nil, nextQ: (Double, Double)? = nil
            switch up {
            case UInt8(ascii: "M"):
                var x = try p.number(), y = try p.number()
                if rel { x += cx; y += cy }
                out.append(.move(x: x, y: y))
                cx = x; cy = y; sx = x; sy = y
                cmd = rel ? UInt8(ascii: "l") : UInt8(ascii: "L")
            case UInt8(ascii: "L"):
                var x = try p.number(), y = try p.number()
                if rel { x += cx; y += cy }
                out.append(.line(x: x, y: y)); cx = x; cy = y
            case UInt8(ascii: "H"):
                var x = try p.number()
                if rel { x += cx }
                out.append(.line(x: x, y: cy)); cx = x
            case UInt8(ascii: "V"):
                var y = try p.number()
                if rel { y += cy }
                out.append(.line(x: cx, y: y)); cy = y
            case UInt8(ascii: "C"):
                var v = try (0..<6).map { _ in try p.number() }
                if rel { for i in 0..<6 { v[i] += i % 2 == 0 ? cx : cy } }
                out.append(.cubic(c1x: v[0], c1y: v[1], c2x: v[2], c2y: v[3], x: v[4], y: v[5]))
                nextC = (v[2], v[3]); cx = v[4]; cy = v[5]
            case UInt8(ascii: "S"):
                var v = try (0..<4).map { _ in try p.number() }
                if rel { for i in 0..<4 { v[i] += i % 2 == 0 ? cx : cy } }
                let c1 = lastC.map { (2 * cx - $0.0, 2 * cy - $0.1) } ?? (cx, cy)
                out.append(.cubic(c1x: c1.0, c1y: c1.1, c2x: v[0], c2y: v[1], x: v[2], y: v[3]))
                nextC = (v[0], v[1]); cx = v[2]; cy = v[3]
            case UInt8(ascii: "Q"):
                var v = try (0..<4).map { _ in try p.number() }
                if rel { for i in 0..<4 { v[i] += i % 2 == 0 ? cx : cy } }
                out.append(quad(cx, cy, v[0], v[1], v[2], v[3]))
                nextQ = (v[0], v[1]); cx = v[2]; cy = v[3]
            case UInt8(ascii: "T"):
                var v = try (0..<2).map { _ in try p.number() }
                if rel { v[0] += cx; v[1] += cy }
                let q = lastQ.map { (2 * cx - $0.0, 2 * cy - $0.1) } ?? (cx, cy)
                out.append(quad(cx, cy, q.0, q.1, v[0], v[1]))
                nextQ = q; cx = v[0]; cy = v[1]
            case UInt8(ascii: "A"):
                let rx = try p.number(), ry = try p.number(), rot = try p.number()
                let large = try p.flag(), sweep = try p.flag()
                var x = try p.number(), y = try p.number()
                if rel { x += cx; y += cy }
                out.append(contentsOf: arcToCubics(x1: cx, y1: cy, rx: rx, ry: ry, phiDeg: rot, large: large, sweep: sweep, x2: x, y2: y))
                cx = x; cy = y
            case UInt8(ascii: "Z"):
                out.append(.close)
                cx = sx; cy = sy
                cmd = 0
            default:
                throw SVGPathError.unexpected(Character(UnicodeScalar(cmd)), offset: p.i)
            }
            lastC = nextC
            lastQ = nextQ
        }
        return out
    }

    static func isCommand(_ c: UInt8) -> Bool {
        "MmLlHhVvCcSsQqTtAaZz".utf8.contains(c)
    }

    static func isNumberStart(_ c: UInt8) -> Bool {
        (c >= 48 && c <= 57) || c == UInt8(ascii: "-") || c == UInt8(ascii: "+") || c == UInt8(ascii: ".")
    }

    static func quad(_ x0: Double, _ y0: Double, _ qx: Double, _ qy: Double, _ x: Double, _ y: Double) -> PathSegment {
        .cubic(c1x: x0 + 2.0 / 3.0 * (qx - x0), c1y: y0 + 2.0 / 3.0 * (qy - y0),
               c2x: x + 2.0 / 3.0 * (qx - x), c2y: y + 2.0 / 3.0 * (qy - y), x: x, y: y)
    }

    /// Converts an SVG elliptical arc to cubic Béziers (SVG 1.1 implementation notes F.6.5 and F.6.6).
    public static func arcToCubics(x1: Double, y1: Double, rx rxIn: Double, ry ryIn: Double, phiDeg: Double,
                                   large: Bool, sweep: Bool, x2: Double, y2: Double) -> [PathSegment] {
        if x1 == x2 && y1 == y2 { return [] }
        var rx = abs(rxIn), ry = abs(ryIn)
        if rx == 0 || ry == 0 { return [.line(x: x2, y: y2)] }
        let phi = phiDeg * .pi / 180
        let cosP = cos(phi), sinP = sin(phi)
        let dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
        let x1p = cosP * dx + sinP * dy
        let y1p = -sinP * dx + cosP * dy
        let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
        if lambda > 1 { let s = lambda.squareRoot(); rx *= s; ry *= s }
        let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
        let den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
        var coef = den == 0 ? 0 : max(0, num / den).squareRoot()
        if large == sweep { coef = -coef }
        let cxp = coef * rx * y1p / ry
        let cyp = -coef * ry * x1p / rx
        let cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2
        let cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2
        func angle(_ ux: Double, _ uy: Double, _ vx: Double, _ vy: Double) -> Double {
            atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        }
        let ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry
        let vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry
        let theta1 = angle(1, 0, ux, uy)
        var dTheta = angle(ux, uy, vx, vy)
        if !sweep && dTheta > 0 { dTheta -= 2 * .pi }
        if sweep && dTheta < 0 { dTheta += 2 * .pi }
        let n = max(1, Int((abs(dTheta) / (.pi / 2) - 1e-6).rounded(.up)))
        let delta = dTheta / Double(n)
        let k = 4.0 / 3.0 * tan(delta / 4)
        var out: [PathSegment] = []
        var t = theta1
        func point(_ a: Double) -> (Double, Double) {
            let ex = rx * cos(a), ey = ry * sin(a)
            return (cosP * ex - sinP * ey + cx, sinP * ex + cosP * ey + cy)
        }
        func deriv(_ a: Double) -> (Double, Double) {
            let ex = -rx * sin(a), ey = ry * cos(a)
            return (cosP * ex - sinP * ey, sinP * ex + cosP * ey)
        }
        for i in 0..<n {
            let t2 = t + delta
            let p0 = point(t), p3 = i == n - 1 ? (x2, y2) : point(t2)
            let d0 = deriv(t), d3 = deriv(t2)
            out.append(.cubic(c1x: p0.0 + k * d0.0, c1y: p0.1 + k * d0.1,
                              c2x: p3.0 - k * d3.0, c2y: p3.1 - k * d3.1, x: p3.0, y: p3.1))
            t = t2
        }
        return out
    }

    struct Scanner {
        let b: [UInt8]
        var i = 0
        init(_ b: [UInt8]) { self.b = b }

        func peek() -> UInt8? { i < b.count ? b[i] : nil }

        mutating func skipSeparators() {
            while i < b.count, b[i] == 32 || b[i] == 44 || b[i] == 9 || b[i] == 10 || b[i] == 13 { i += 1 }
        }

        mutating func flag() throws -> Bool {
            skipSeparators()
            guard let c = peek(), c == 48 || c == 49 else { throw SVGPathError.missingNumber(offset: i) }
            i += 1
            return c == 49
        }

        mutating func number() throws -> Double {
            skipSeparators()
            let start = i
            if i < b.count, b[i] == 45 || b[i] == 43 { i += 1 }
            var digits = false, dot = false
            while i < b.count {
                let c = b[i]
                if c >= 48 && c <= 57 { digits = true; i += 1 }
                else if c == 46 && !dot { dot = true; i += 1 }
                else { break }
            }
            if digits, i < b.count, b[i] == 101 || b[i] == 69 {
                var j = i + 1
                if j < b.count, b[j] == 45 || b[j] == 43 { j += 1 }
                if j < b.count, b[j] >= 48 && b[j] <= 57 {
                    i = j
                    while i < b.count, b[i] >= 48 && b[i] <= 57 { i += 1 }
                }
            }
            guard digits, let v = Double(String(decoding: b[start..<i], as: UTF8.self)) else {
                throw SVGPathError.missingNumber(offset: start)
            }
            return v
        }
    }
}
