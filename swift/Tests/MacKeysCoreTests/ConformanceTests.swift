import Foundation
import Testing
@testable import MacKeysCore

/// A generic JSON value, for tree comparison against the spec fixtures.
indirect enum JSONValue: Decodable, CustomStringConvertible {
    case null, bool(Bool), number(Double), string(String), array([JSONValue]), object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSONValue].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    var description: String {
        switch self {
        case .null: return "null"
        case .bool(let b): return "\(b)"
        case .number(let n): return "\(n)"
        case .string(let s): return "\"\(s)\""
        case .array(let a): return "[\(a.count) items]"
        case .object(let o): return "{\(o.keys.sorted().joined(separator: ","))}"
        }
    }
}

struct Entry<I: Decodable>: Decodable {
    var input: I
    var output: JSONValue
}

func fixture<I: Decodable>(_ name: String, _: I.Type) throws -> [(String, Entry<I>)] {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
    let dict = try JSONDecoder().decode([String: Entry<I>].self, from: Data(contentsOf: url))
    return dict.sorted { $0.key < $1.key }
}

func isColor(_ s: String) -> Bool {
    s.count == 9 && s.hasPrefix("#") && s.dropFirst().allSatisfy { $0.isHexDigit }
}

func channels(_ s: String) -> [Int] {
    let h = Array(s.dropFirst())
    return stride(from: 0, to: 8, by: 2).map { Int(String(h[$0..<$0 + 2]), radix: 16)! }
}

/// Compares two JSON trees per SPEC "Conformance". Returns a list of differences.
func compare(_ a: JSONValue, _ b: JSONValue, _ path: String = "$", into diffs: inout [String]) {
    if diffs.count > 20 { return }
    switch (a, b) {
    case (.null, .null): return
    case (.bool(let x), .bool(let y)): if x != y { diffs.append("\(path): \(x) != \(y)") }
    case (.number(let x), .number(let y)): if abs(x - y) > 1e-6 { diffs.append("\(path): \(x) != \(y)") }
    case (.string(let x), .string(let y)):
        if isColor(x) && isColor(y) {
            if zip(channels(x), channels(y)).contains(where: { abs($0 - $1) > 1 }) { diffs.append("\(path): color \(x) != \(y)") }
        } else if x != y { diffs.append("\(path): \"\(x)\" != \"\(y)\"") }
    case (.array(let x), .array(let y)):
        if x.count != y.count { diffs.append("\(path): length \(x.count) != \(y.count)"); return }
        for i in 0..<x.count { compare(x[i], y[i], "\(path)[\(i)]", into: &diffs) }
    case (.object(let x), .object(let y)):
        for k in Set(x.keys).union(y.keys).sorted() {
            compare(x[k] ?? .null, y[k] ?? .null, "\(path).\(k)", into: &diffs)
        }
    default: diffs.append("\(path): \(a) != \(b)")
    }
}

func json<T: Encodable>(_ v: T) throws -> JSONValue {
    try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(v))
}

struct KeyboardInput: Decodable { var finish: String; var layout: String; var custom: CustomLayout? }
struct ThemeInput: Decodable { var finish: String; var backlight: BacklightOptions }
struct TopCaseInput: Decodable { var finish: String; var parts: Parts?; var backlight: BacklightOptions? }
struct TrackpadInput: Decodable { var finish: String }

@Suite("Conformance with spec/fixtures")
struct ConformanceTests {
    @Test func keyboards() throws {
        let entries = try fixture("keyboards", KeyboardInput.self)
        #expect(entries.count == 72)
        for (name, e) in entries {
            var diffs: [String] = []
            compare(try json(buildKeyboard(finish: e.input.finish, layout: e.input.layout, custom: e.input.custom)), e.output, name, into: &diffs)
            #expect(diffs.isEmpty, "\(diffs.joined(separator: "\n"))")
        }
    }

    @Test func themes() throws {
        let entries = try fixture("themes", ThemeInput.self)
        #expect(entries.count == 102)
        for (name, e) in entries {
            var diffs: [String] = []
            compare(try json(keyboardTheme(finish: e.input.finish, backlight: e.input.backlight)), e.output, name, into: &diffs)
            #expect(diffs.isEmpty, "\(diffs.joined(separator: "\n"))")
        }
    }

    @Test func topCases() throws {
        let entries = try fixture("topcases", TopCaseInput.self)
        #expect(entries.count == 68)
        for (name, e) in entries {
            var diffs: [String] = []
            let kb = buildKeyboard(finish: e.input.finish, layout: "en-us")
            let tc = topCase(finish: e.input.finish, keyboard: kb, parts: e.input.parts ?? .keyboard, backlight: e.input.backlight ?? BacklightOptions())
            compare(try json(tc), e.output, name, into: &diffs)
            #expect(diffs.isEmpty, "\(diffs.joined(separator: "\n"))")
        }
    }

    @Test func trackpads() throws {
        let entries = try fixture("trackpads", TrackpadInput.self)
        #expect(entries.count == 17)
        for (name, e) in entries {
            var diffs: [String] = []
            compare(try json(trackpad(finish: e.input.finish)), e.output, name, into: &diffs)
            #expect(diffs.isEmpty, "\(diffs.joined(separator: "\n"))")
        }
    }
}

@Suite("Utilities")
struct UtilTests {
    @Test func fmtMatchesJS() {
        #expect(fmt(0) == "0")
        #expect(fmt(-0.0) == "0")
        #expect(fmt(-0.00001) == "0")
        #expect(fmt(1.5) == "1.5")
        #expect(fmt(10) == "10")
        #expect(fmt(0.12345) == "0.1235")
        #expect(fmt(-2.00004) == "-2")
        #expect(fmt(83.30000000000001) == "83.3")
    }

    @Test func colors() throws {
        #expect(color("rgba(255,255,255,.13)") == "#ffffff21")
        #expect(color("#abc") == "#aabbccff")
        #expect(color("transparent") == "#00000000")
        #expect(cssColor("#ffffff21") == "rgba(255,255,255,0.129)")
    }

    @Test func tokens() {
        let q = parseToken("W¦Ж")
        #expect(q.protoTags == ["quad", "qbig"])
        #expect(q.slots.t == "W" && q.slots.c == "Ж")
        let c = parseToken("Q|@")
        #expect(c.protoKind == .char && c.slots.c == "@")
        let d = parseToken("{[")
        #expect(d.protoTags == ["dual", "brk"] && d.protoLabel == "[ {")
        #expect(parseToken("F").isHome)
    }

    @Test func clipsDecode() throws {
        let kb = try #require(ClipSet.keyboard)
        #expect(kb.sr == 32000)
        for k in KeySound.allCases {
            for f in [KeyForce.soft, .hard] {
                for up in [false, true] { #expect(kb.samples(keyClipName(k, f, up: up, in: kb)).count == 1) }
            }
        }
        #expect(keyClipName(.power, .hard, up: false, in: kb) == "power-down")
        let tp = try #require(ClipSet.trackpad)
        #expect(tp.sr == 48000)
        #expect(tp.samples("press").count == 3)
        #expect(tp.samples("force").count == 1)
        #expect(kb.samples("key-soft-down")[0].allSatisfy { $0 >= -1 && $0 <= 1 })
    }

    @Test func norwegianKeySounds() {
        let kb = buildKeyboard(finish: .proSpaceBlack, layout: .no)
        let want: [String: KeySound] = [
            "KeyA": .key, "F5": .key, "Fn": .key, "MetaLeft": .mod, "ShiftLeft": .mod, "Escape": .tab, "Tab": .tab,
            "Backspace": .tab, "CapsLock": .caps, "ShiftRight": .wide, "Enter": .enter, "Space": .space,
            "ArrowUp": .arrow, "TouchID": .power
        ]
        for (id, s) in want { #expect(kb.keys.first { $0.id == id }?.sound == s, "\(id)") }
    }

    @Test func keyCodes() {
        #expect(MacKeyCodes.code(for: 0x00) == "KeyA")
        #expect(MacKeyCodes.code(for: 0x0A) == "IntlBackslash")
        #expect(MacKeyCodes.code(for: 0x5D) == "IntlYen")
        #expect(MacKeyCodes.code(for: 0x5E) == "IntlRo")
        #expect(MacKeyCodes.code(for: 0x66) == "Lang2")
        #expect(MacKeyCodes.code(for: 0x68) == "Lang1")
        #expect(MacKeyCodes.modifierIsDown(code: "ShiftRight", modifierFlags: (1 << 17) | 0x4))
        #expect(!MacKeyCodes.modifierIsDown(code: "ShiftLeft", modifierFlags: (1 << 17) | 0x4))
    }

    @Test func fallbacks() {
        #expect(buildKeyboard(finish: "nope", layout: "nope").finish == .proSpaceBlack)
        #expect(buildKeyboard(finish: "MacBook Air · Midnight", layout: "en-us").finish == .airMidnight)
        #expect(buildKeyboard(finish: .proSpaceBlack, layout: .enUS).keys.contains { $0.id == "TouchID" })
    }
}
