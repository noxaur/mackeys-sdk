import Foundation
import Testing
@testable import MacKeysCore

@Suite("SVG path parser")
struct SVGPathTests {
    func endPoints(_ segs: [PathSegment]) -> [(Double, Double)] {
        segs.compactMap {
            switch $0 {
            case .move(let x, let y), .line(let x, let y): return (x, y)
            case .cubic(_, _, _, _, let x, let y): return (x, y)
            case .close: return nil
            }
        }
    }

    @Test func compactNumbers() throws {
        let s = try SVGPath.parse("M.55 .55L6.7-4.4l-1.2-3")
        let p = endPoints(s)
        #expect(abs(p[2].0 - 5.5) < 1e-9 && abs(p[2].1 + 7.4) < 1e-9)
        let dots = try SVGPath.parse("M1.5.5L2.5.25")
        #expect(endPoints(dots).map(\.0) == [1.5, 2.5])
        #expect(endPoints(dots).map(\.1) == [0.5, 0.25])
    }

    @Test func implicitRepeats() throws {
        let s = try SVGPath.parse("M0 0 10 0 10 10z")
        #expect(s.count == 4)
        if case .line(let x, let y) = s[2] { #expect(x == 10 && y == 10) } else { Issue.record("line") }
        let r = try SVGPath.parse("m1 1 2 2")
        if case .line(let x, let y) = r[1] { #expect(x == 3 && y == 3) } else { Issue.record("rel line") }
    }

    @Test func hvAndClose() throws {
        let s = try SVGPath.parse("M1 2H5V7h-1v-2Z M0 0")
        #expect(endPoints(s).map(\.0) == [1, 5, 5, 4, 4, 0])
        #expect(endPoints(s).map(\.1) == [2, 2, 7, 7, 5, 0])
        #expect(s.contains(.close))
    }

    @Test func arcsBecomeCubics() throws {
        // Full circle as two half arcs (the glyph ring syntax).
        let s = try SVGPath.parse("M3.65 5.25a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0")
        let cubics = s.filter { if case .cubic = $0 { return true }; return false }
        #expect(cubics.count == 4)
        let p = endPoints(s).last!
        #expect(abs(p.0 - 3.65) < 1e-9 && abs(p.1 - 5.25) < 1e-9)
        // Midpoints stay on the circle.
        for seg in cubics {
            if case .cubic(_, _, _, _, let x, let y) = seg {
                #expect(abs(((x - 5.25) * (x - 5.25) + (y - 5.25) * (y - 5.25)).squareRoot() - 1.6) < 1e-6)
            }
        }
        // Compact flags.
        let f = try SVGPath.parse("M0 0a5 5 0 015 5")
        #expect(endPoints(f).last!.0 == 5)
    }

    @Test func smoothAndQuadratic() throws {
        let s = try SVGPath.parse("M0 0C0 1 1 2 2 2S4 3 4 4Q5 5 6 4T8 4")
        #expect(s.count == 5)
        if case .cubic(let c1x, let c1y, _, _, _, _) = s[2] { #expect(c1x == 3 && c1y == 2) } else { Issue.record("S") }
        #expect(endPoints(s).last!.0 == 8)
    }

    @Test func allGlyphsParse() throws {
        let g = MacKeysData.shared.glyphs
        let all = g.fkeys + Array(g.mods.values) + Array(g.icons.values) + [g.globe] + Array(g.arrows.values)
        for glyph in all {
            if !glyph.stroke.isEmpty { #expect(try !SVGPath.parse(glyph.stroke).isEmpty, "\(glyph.name)") }
            if !glyph.fill.isEmpty { #expect(try !SVGPath.parse(glyph.fill).isEmpty, "\(glyph.name)") }
        }
        for l in LAYOUT_IDS + [.custom] {
            for k in buildKeyboard(finish: .proSilver, layout: l).keys {
                if let iso = k.iso {
                    #expect(try SVGPath.parse(iso.path).count > 8)
                    #expect(try SVGPath.parse(iso.highlight).count == 2)
                }
            }
        }
    }

    @Test func rejectsGarbage() {
        #expect(throws: SVGPathError.self) { try SVGPath.parse("M0 0 X") }
        #expect(throws: SVGPathError.self) { try SVGPath.parse("L") }
    }
}
