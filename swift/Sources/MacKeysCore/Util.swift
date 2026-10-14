import Foundation

/// JavaScript `Math.round`: nearest integer, ties toward positive infinity.
@inlinable
public func jsRound(_ x: Double) -> Double {
    let f = Foundation.floor(x)
    return x - f >= 0.5 ? f + 1 : f
}

/// Formats a number for path strings: at most 4 decimals, no trailing zeros. `-0` prints as `0`.
/// Same rule as `fmt` in `util.ts`.
public func fmt(_ n: Double) -> String {
    let r = jsRound(n * 10000) / 10000
    if r == 0 { return "0" }
    var s = String(format: "%.4f", r)
    while s.hasSuffix("0") { s.removeLast() }
    if s.hasSuffix(".") { s.removeLast() }
    return s
}

/// JavaScript `Number.prototype.toString` for the simple numbers this engine prints (integers and short decimals).
func jsNumber(_ n: Double) -> String {
    if n == n.rounded(), abs(n) < 1e15 { return String(Int64(n)) }
    return "\(n)"
}

/// A color as `#rrggbbaa`. Every color the core returns uses this form.
public typealias MKColor = String

public struct RGBA: Sendable, Equatable, Hashable {
    public var r: Double
    public var g: Double
    public var b: Double
    /// Alpha, 0 to 1.
    public var a: Double
    public init(r: Double, g: Double, b: Double, a: Double = 1) {
        self.r = r; self.g = g; self.b = b; self.a = a
    }
}

private func h2(_ v: Double) -> String {
    let c = Int(Swift.max(0, Swift.min(255, jsRound(v))))
    return String(format: "%02x", c)
}

public func rgba(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) -> MKColor {
    "#" + h2(r) + h2(g) + h2(b) + h2(a * 255)
}

public enum ColorError: Error, Equatable {
    case unsupported(String)
}

/// Parses `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()` and `transparent`.
public func parseColor(_ css: String) throws -> RGBA {
    let s = css.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if s == "transparent" { return RGBA(r: 0, g: 0, b: 0, a: 0) }
    if s.hasPrefix("#") {
        var h = Array(s.dropFirst())
        if h.count == 3 { h = h.flatMap { [$0, $0] } }
        func n(_ i: Int) -> Double {
            guard i + 2 <= h.count, let v = Int(String(h[i..<i + 2]), radix: 16) else { return .nan }
            return Double(v)
        }
        return RGBA(r: n(0), g: n(2), b: n(4), a: h.count >= 8 ? n(6) / 255 : 1)
    }
    if (s.hasPrefix("rgb(") || s.hasPrefix("rgba(")), s.hasSuffix(")"),
       let open = s.firstIndex(of: "(") {
        let inner = s[s.index(after: open)..<s.index(before: s.endIndex)]
        let p = inner.split(separator: ",", omittingEmptySubsequences: false).map { parseFloatJS(String($0)) }
        guard p.count >= 3 else { throw ColorError.unsupported(css) }
        return RGBA(r: p[0], g: p[1], b: p[2], a: p.count > 3 ? p[3] : 1)
    }
    throw ColorError.unsupported(css)
}

/// JavaScript `parseFloat`: reads the longest numeric prefix after leading spaces.
func parseFloatJS(_ s: String) -> Double {
    let t = s.trimmingCharacters(in: .whitespaces)
    var end = t.startIndex
    var seenDigit = false, seenDot = false, seenExp = false
    var i = t.startIndex
    if i < t.endIndex, t[i] == "-" || t[i] == "+" { i = t.index(after: i) }
    while i < t.endIndex {
        let c = t[i]
        if c.isASCII, c.isNumber { seenDigit = true; i = t.index(after: i); end = i; continue }
        if c == ".", !seenDot, !seenExp { seenDot = true; i = t.index(after: i); if seenDigit { end = i }; continue }
        if (c == "e" || c == "E"), seenDigit, !seenExp {
            seenExp = true
            var j = t.index(after: i)
            if j < t.endIndex, t[j] == "-" || t[j] == "+" { j = t.index(after: j) }
            i = j
            continue
        }
        break
    }
    guard seenDigit else { return .nan }
    return Double(t[t.startIndex..<end]) ?? .nan
}

/// Normalizes any supported CSS color to `#rrggbbaa`. Unsupported input gives transparent black.
public func color(_ css: String) -> MKColor {
    guard let c = try? parseColor(css) else { return "#00000000" }
    return rgba(c.r, c.g, c.b, c.a)
}

/// Converts a `#rrggbbaa` color to a CSS color string.
public func cssColor(_ c: MKColor) -> String {
    guard let p = try? parseColor(c) else { return c }
    if p.a >= 1 { return "#" + String(c.dropFirst().prefix(6)) }
    let a = (p.a * 1000).rounded() / 1000
    return "rgba(\(jsNumber(p.r)),\(jsNumber(p.g)),\(jsNumber(p.b)),\(jsNumber(a)))"
}

/// A CSS box shadow.
public struct Shadow: Codable, Sendable, Equatable, Hashable {
    public var x: Double
    public var y: Double
    public var blur: Double
    public var spread: Double
    public var color: MKColor
    public var inset: Bool
    public init(x: Double, y: Double, blur: Double, spread: Double, color: MKColor, inset: Bool) {
        self.x = x; self.y = y; self.blur = blur; self.spread = spread; self.color = color; self.inset = inset
    }
}

public func shadow(_ x: Double, _ y: Double, _ blur: Double, _ spread: Double, _ c: String, _ inset: Bool = false) -> Shadow {
    Shadow(x: x, y: y, blur: blur, spread: spread, color: color(c), inset: inset)
}

public struct GradientStop: Codable, Sendable, Equatable, Hashable {
    public var color: MKColor
    public var at: Double
    public init(color: MKColor, at: Double) { self.color = color; self.at = at }
}

/// A vertical (top to bottom) linear gradient.
public struct Gradient: Codable, Sendable, Equatable, Hashable {
    public var stops: [GradientStop]
    public init(stops: [GradientStop]) { self.stops = stops }
}

public func grad2(_ a: [String]) -> Gradient {
    Gradient(stops: [GradientStop(color: color(a[0]), at: 0), GradientStop(color: color(a[1]), at: 1)])
}

public struct Rect: Codable, Sendable, Equatable, Hashable {
    public var x: Double
    public var y: Double
    public var w: Double
    public var h: Double
    public init(x: Double, y: Double, w: Double, h: Double) { self.x = x; self.y = y; self.w = w; self.h = h }
}
