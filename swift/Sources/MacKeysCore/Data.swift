import Foundation

// Static data for every Mac keyboard and trackpad. Loaded from the bundled `mackeys-data.json`
// (copied from `spec/` by `scripts/sync-spec.sh`). Measurements: 1 key pitch (19.0 mm) = 64 px.

public enum ModelID: String, Codable, Sendable, CaseIterable {
    case pro, air, neo, mk
}

public enum FinishID: String, Codable, Sendable, CaseIterable, Identifiable {
    case proSpaceBlack = "pro-space-black"
    case proSilver = "pro-silver"
    case airMidnight = "air-midnight"
    case airStarlight = "air-starlight"
    case airSkyBlue = "air-sky-blue"
    case airSilver = "air-silver"
    case neoSilver = "neo-silver"
    case neoBlush = "neo-blush"
    case neoCitrus = "neo-citrus"
    case neoIndigo = "neo-indigo"
    case imacSilver = "imac-silver"
    case imacBlue = "imac-blue"
    case imacPurple = "imac-purple"
    case imacPink = "imac-pink"
    case imacOrange = "imac-orange"
    case imacYellow = "imac-yellow"
    case imacGreen = "imac-green"
    public var id: String { rawValue }
    /// The display name, for example `MacBook Pro · Space Black`.
    public var name: String { getFinish(rawValue).name }
    public var model: ModelID { getFinish(rawValue).model }
}

public enum LayoutID: String, Codable, Sendable, CaseIterable, Identifiable {
    case enUS = "en-us"
    case enGB = "en-gb"
    case de, fr, es
    case svFI = "sv-fi"
    case no, da, it, ja, nl
    case enIntl = "en-intl"
    case ch, pt, ru, ko
    case custom
    public var id: String { rawValue }
    public var name: String { self == .custom ? "Custom" : getLayout(rawValue).name }
}

public struct ModelSpec: Codable, Sendable, Equatable {
    public var W: Double
    public var H: Double
    public var kbY: Double
    public var wellPad: Double
    public var padW: Double
    public var padY: Double
    public var padH: Double
    public var hingeX: Double
    public var grille: Bool
    public var radius: [Double]
}

/// Lid wallpaper ribbon colors: ribbon A, highlight, ribbon B, dark ink, optional ribbon C.
public struct Ribbon: Codable, Sendable, Equatable {
    public var a: String
    public var hi: String
    public var b: String
    public var darkInk: Bool
    public var c: String?

    public init(from decoder: Decoder) throws {
        var u = try decoder.unkeyedContainer()
        a = try u.decode(String.self)
        hi = try u.decode(String.self)
        b = try u.decode(String.self)
        darkInk = try u.decode(Double.self) != 0
        c = u.isAtEnd ? nil : try u.decode(String.self)
    }

    public func encode(to encoder: Encoder) throws {
        var u = encoder.unkeyedContainer()
        try u.encode(a); try u.encode(hi); try u.encode(b); try u.encode(darkInk ? 1 : 0)
        if let c { try u.encode(c) }
    }
}

public struct FinishSpec: Codable, Sendable, Equatable {
    public var id: FinishID
    public var name: String
    public var model: ModelID
    public var dark: Bool
    public var deck: [String]
    public var pad: [String]
    public var side: [String]
    public var lid: [String]
    public var edge: String
    /// Speaker grille dot color.
    public var dot: String
    /// Light key caps (Neo and Magic Keyboard): face and legend colors.
    public var kf: String?
    public var kl: String?
    /// Lid wallpaper as a CSS background (web renderers only).
    public var wall: String
    public var ribbon: Ribbon
}

/// A layout's legends, one row per string, keys split by spaces. See `spec/SPEC.md` and `data.ts`.
public struct LayoutSpec: Codable, Sendable, Equatable {
    public var id: LayoutID
    public var name: String
    public var iso: Bool
    public var en: Bool
    public var jis: Bool?
    public var caps: String?
    public var num: String?
    public var q: String?
    public var a: String?
    public var x: String?
    public var z: String?
}

/// A user-defined layout. Rows use the same legend syntax as `LayoutSpec`. Missing fields take the defaults.
public struct CustomLayout: Codable, Sendable, Equatable {
    public enum Kind: String, Codable, Sendable { case ISO, ANSI }
    public var kind: Kind
    public var num: String
    public var q: String
    public var a: String
    /// The key beside left shift (ISO only).
    public var x: String
    public var z: String

    public init(kind: Kind = .ISO,
                num: String = "§ 1 2 3 4 5 6 7 8 9 0 - =",
                q: String = "Q W E R T Y U I O P [ ]",
                a: String = "A S D F G H J K L ; ' \\",
                x: String = "`",
                z: String = "Z X C V B N M , . /") {
        self.kind = kind; self.num = num; self.q = q; self.a = a; self.x = x; self.z = z
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = CustomLayout()
        kind = try c.decodeIfPresent(Kind.self, forKey: .kind) ?? d.kind
        num = try c.decodeIfPresent(String.self, forKey: .num) ?? d.num
        q = try c.decodeIfPresent(String.self, forKey: .q) ?? d.q
        a = try c.decodeIfPresent(String.self, forKey: .a) ?? d.a
        x = try c.decodeIfPresent(String.self, forKey: .x) ?? d.x
        z = try c.decodeIfPresent(String.self, forKey: .z) ?? d.z
    }

    public static let `default` = CustomLayout()
}

/// One JIS key: shifted, base, kana, small kana (strings) and an optional width in units.
public struct JISEntry: Codable, Sendable, Equatable {
    public var parts: [String]
    public var width: Double?

    public init(from decoder: Decoder) throws {
        var u = try decoder.unkeyedContainer()
        var p: [String] = []
        var w: Double?
        while !u.isAtEnd {
            if let s = try? u.decode(String.self) { p.append(s) } else { w = try u.decode(Double.self) }
        }
        parts = p
        width = w
    }

    public func encode(to encoder: Encoder) throws {
        var u = encoder.unkeyedContainer()
        for p in parts { try u.encode(p) }
        if let width { try u.encode(width) }
    }

    /// Part `i`, or an empty string.
    public subscript(i: Int) -> String { i < parts.count ? parts[i] : "" }
}

public struct JISTable: Codable, Sendable, Equatable {
    public var num: [JISEntry]
    public var qLetters: [JISEntry]
    public var qSymbols: [JISEntry]
    public var aLetters: [JISEntry]
    public var aSymbols: [JISEntry]
    public var zLetters: [JISEntry]
    public var zSymbols: [JISEntry]
}

public struct Glyph: Codable, Sendable, Equatable {
    /// Accessible name of the key's function.
    public var name: String
    public var w: Double
    public var h: Double
    public var viewBox: [Double]
    /// Path drawn with a stroke (round caps and joins).
    public var stroke: String
    /// Path drawn filled.
    public var fill: String
    public var strokeWidth: Double
    /// Drawn size, when it differs from the measured size.
    public var drawW: Double?
    public var drawH: Double?
}

public struct GlyphTable: Codable, Sendable, Equatable {
    public var fkeys: [Glyph]
    public var mods: [String: Glyph]
    public var icons: [String: Glyph]
    public var globe: Glyph
    public var arrows: [String: Glyph]
}

public struct MacKeysData: Codable, Sendable, Equatable {
    public var version: Int
    public var unit: Double
    public var rowPitch: Double
    public var models: [String: ModelSpec]
    public var finishes: [FinishSpec]
    public var layouts: [LayoutSpec]
    public var defaultCustomLayout: CustomLayout
    public var jis: JISTable
    public var glyphs: GlyphTable

    /// The bundled data set.
    public static let shared: MacKeysData = {
        guard let url = Bundle.module.url(forResource: "mackeys-data", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            fatalError("MacKeys: mackeys-data.json is missing from the MacKeysCore bundle. Run scripts/sync-spec.sh.")
        }
        do {
            return try JSONDecoder().decode(MacKeysData.self, from: data)
        } catch {
            fatalError("MacKeys: cannot decode mackeys-data.json: \(error)")
        }
    }()

    public func model(_ id: ModelID) -> ModelSpec { models[id.rawValue]! }
}

public var FINISHES: [FinishSpec] { MacKeysData.shared.finishes }
public var LAYOUTS: [LayoutSpec] { MacKeysData.shared.layouts }
public var FINISH_IDS: [FinishID] { FINISHES.map(\.id) }
public var LAYOUT_IDS: [LayoutID] { LAYOUTS.map(\.id) }

/// Finds a finish by id or name. An unknown id falls back to `pro-space-black`.
public func getFinish(_ id: String) -> FinishSpec {
    let all = MacKeysData.shared.finishes
    return all.first { $0.id.rawValue == id || $0.name == id } ?? all[0]
}

public func getFinish(_ id: FinishID) -> FinishSpec { getFinish(id.rawValue) }

/// Finds a layout by id or name. An unknown id falls back to `en-us`.
public func getLayout(_ id: String) -> LayoutSpec {
    let all = MacKeysData.shared.layouts
    return all.first { $0.id.rawValue == id || $0.name == id } ?? all[0]
}
