// swift-tools-version: 6.0
import PackageDescription
import Foundation

// Command Line Tools work-around: after a plain `swift build`, the next `swift test` can compile the test
// targets without the swift-testing macro plugin path. Pass it explicitly when that folder exists.
let cltTestingPlugins = "/Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing"
let testSettings: [SwiftSetting] = FileManager.default.fileExists(atPath: cltTestingPlugins)
    ? [.unsafeFlags(["-plugin-path", cltTestingPlugins])]
    : []

let package = Package(
    name: "MacKeys",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "MacKeysCore", targets: ["MacKeysCore"]),
        .library(name: "MacKeysUI", targets: ["MacKeysUI"]),
        .executable(name: "MacKeysDemo", targets: ["MacKeysDemo"])
    ],
    targets: [
        .target(
            name: "MacKeysCore",
            path: "swift/Sources/MacKeysCore",
            resources: [.copy("Resources/mackeys-data.json"), .copy("Resources/keyboard-clicks.json"), .copy("Resources/trackpad-clicks.json")]
        ),
        .target(name: "MacKeysUI", dependencies: ["MacKeysCore"], path: "swift/Sources/MacKeysUI"),
        .executableTarget(name: "MacKeysDemo", dependencies: ["MacKeysUI", "MacKeysCore"], path: "swift/Sources/MacKeysDemo"),
        .testTarget(name: "MacKeysCoreTests", dependencies: ["MacKeysCore"], path: "swift/Tests/MacKeysCoreTests", resources: [.copy("Fixtures")], swiftSettings: testSettings),
        .testTarget(name: "MacKeysUITests", dependencies: ["MacKeysUI", "MacKeysCore"], path: "swift/Tests/MacKeysUITests", swiftSettings: testSettings)
    ],
    swiftLanguageModes: [.v6]
)
