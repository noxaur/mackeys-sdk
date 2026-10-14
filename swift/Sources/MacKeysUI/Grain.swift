import SwiftUI
import CoreGraphics
import MacKeysCore

/// The aluminium grain: SVG `feTurbulence type="fractalNoise" numOctaves="2" stitchTiles="stitch"` (seed 0)
/// followed by `feColorMatrix type="saturate" values="0"`, as the web `Grain` component draws it.
/// One tileable image per base frequency, made once. Draw it with `.overlay` blend at the grain opacity.
enum Grain {
    /// Tile size in px at scale 1, and samples per px (the references are at 2x).
    static let tile = 256
    static let density = 2

    nonisolated(unsafe) private static var cache: [Double: CGImage] = [:]
    private static let lock = NSLock()

    /// The tile image for `baseFrequency` (0.95 for the deck, 1.1 for the standalone trackpad).
    static func image(baseFrequency: Double) -> CGImage? {
        lock.lock(); defer { lock.unlock() }
        if let img = cache[baseFrequency] { return img }
        let img = make(baseFrequency: baseFrequency)
        cache[baseFrequency] = img
        return img
    }

    /// Fills `path` with the grain at `opacity`, blended with `.overlay` over what the context already holds.
    static func draw(_ ctx: inout GraphicsContext, in path: Path, opacity: Double, baseFrequency: Double) {
        guard opacity > 0, let img = image(baseFrequency: baseFrequency) else { return }
        var g = ctx
        g.clip(to: path)
        g.blendMode = .overlay
        g.opacity = opacity
        let image = Image(decorative: img, scale: CGFloat(density))
        g.fill(Path(path.boundingRect), with: .tiledImage(image, origin: .zero, sourceRect: CGRect(x: 0, y: 0, width: 1, height: 1), scale: 1))
    }

    // ---- feTurbulence (SVG 1.1 reference implementation) ----

    private struct Lattice {
        var selector = [Int](repeating: 0, count: 512 + 2)
        var gradient = [[Double]](repeating: [Double](repeating: 0, count: (512 + 2) * 2), count: 4)

        init(seed: Int) {
            let m = 2147483647, a = 16807, q = 127773, r = 2836
            var s = seed
            if s <= 0 { s = -(s % (m - 1)) + 1 }
            if s > m - 1 { s = m - 1 }
            func random() -> Int {
                var v = a * (s % q) - r * (s / q)
                if v <= 0 { v += m }
                s = v
                return v
            }
            for k in 0..<4 {
                for i in 0..<256 {
                    selector[i] = i
                    let gx = Double((random() % 512) - 256) / 256
                    let gy = Double((random() % 512) - 256) / 256
                    let n = (gx * gx + gy * gy).squareRoot()
                    gradient[k][i * 2] = n > 0 ? gx / n : 0
                    gradient[k][i * 2 + 1] = n > 0 ? gy / n : 0
                }
            }
            var i = 255
            while i > 0 {
                let k = selector[i]
                let j = random() % 256
                selector[i] = selector[j]
                selector[j] = k
                i -= 1
            }
            for i in 0..<(256 + 2) {
                selector[256 + i] = selector[i]
                for k in 0..<4 {
                    gradient[k][(256 + i) * 2] = gradient[k][i * 2]
                    gradient[k][(256 + i) * 2 + 1] = gradient[k][i * 2 + 1]
                }
            }
        }
    }

    private struct Stitch { var width: Int, height: Int, wrapX: Int, wrapY: Int }

    private static func noise2(_ L: Lattice, _ ch: Int, _ x: Double, _ y: Double, _ st: Stitch) -> Double {
        let N = 4096.0
        var t = x + N
        var bx0 = Int(t) & 255, bx1 = (bx0 + 1) & 255
        let rx0 = t - Double(Int(t)), rx1 = rx0 - 1
        t = y + N
        var by0 = Int(t) & 255, by1 = (by0 + 1) & 255
        let ry0 = t - Double(Int(t)), ry1 = ry0 - 1
        if bx0 >= st.wrapX { bx0 -= st.width }
        if bx1 >= st.wrapX { bx1 -= st.width }
        if by0 >= st.wrapY { by0 -= st.height }
        if by1 >= st.wrapY { by1 -= st.height }
        bx0 &= 255; bx1 &= 255; by0 &= 255; by1 &= 255
        let i = L.selector[bx0], j = L.selector[bx1]
        let b00 = L.selector[i + by0], b10 = L.selector[j + by0], b01 = L.selector[i + by1], b11 = L.selector[j + by1]
        let sx = rx0 * rx0 * (3 - 2 * rx0), sy = ry0 * ry0 * (3 - 2 * ry0)
        let g = L.gradient[ch]
        var u = rx0 * g[b00 * 2] + ry0 * g[b00 * 2 + 1]
        var v = rx1 * g[b10 * 2] + ry0 * g[b10 * 2 + 1]
        let a = u + sx * (v - u)
        u = rx0 * g[b01 * 2] + ry1 * g[b01 * 2 + 1]
        v = rx1 * g[b11 * 2] + ry1 * g[b11 * 2 + 1]
        let b = u + sx * (v - u)
        return a + sy * (b - a)
    }

    private static func make(baseFrequency f0: Double) -> CGImage? {
        let L = Lattice(seed: 0)
        let T = Double(tile)
        // Stitching: round the frequency so that the tile holds a whole number of lattice cells.
        let lo = (T * f0).rounded(.down) / T, hi = (T * f0).rounded(.up) / T
        let f = lo > 0 && f0 / lo < hi / f0 ? lo : hi
        let n = tile * density
        var px = [UInt8](repeating: 0, count: n * n * 4)
        func toSRGB(_ c: Double) -> Double {
            let v = min(1, max(0, c))
            return v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055
        }
        for yy in 0..<n {
            for xx in 0..<n {
                let ux = (Double(xx) + 0.5) / Double(density), uy = (Double(yy) + 0.5) / Double(density)
                var ch = [0.0, 0.0, 0.0, 0.0]
                for c in 0..<4 {
                    var st = Stitch(width: Int(T * f + 0.5), height: Int(T * f + 0.5), wrapX: 0, wrapY: 0)
                    st.wrapX = 4096 + st.width
                    st.wrapY = 4096 + st.height
                    var x = ux * f, y = uy * f, sum = 0.0, ratio = 1.0
                    for _ in 0..<2 {
                        sum += noise2(L, c, x, y, st) / ratio
                        x *= 2; y *= 2; ratio *= 2
                        st.width *= 2; st.wrapX = 2 * st.wrapX - 4096
                        st.height *= 2; st.wrapY = 2 * st.wrapY - 4096
                    }
                    // fractalNoise: (sum + 1) / 2, clamped, then 8-bit as the filter chain stores it.
                    ch[c] = (min(255, max(0, (sum * 255 + 255) / 2))).rounded() / 255
                }
                // saturate(0) in linearRGB (the default color-interpolation-filters), then to sRGB.
                let lin = 0.213 * ch[0] + 0.715 * ch[1] + 0.072 * ch[2]
                let gray = toSRGB(lin), alpha = ch[3]
                let i = (yy * n + xx) * 4
                let v = UInt8((gray * alpha * 255).rounded())
                px[i] = v; px[i + 1] = v; px[i + 2] = v
                px[i + 3] = UInt8((alpha * 255).rounded())
            }
        }
        let data = Data(px) as CFData
        guard let provider = CGDataProvider(data: data) else { return nil }
        return CGImage(width: n, height: n, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: n * 4,
                       space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                       provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
    }
}
