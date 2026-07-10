import XCTest
@testable import ApolloReception

final class SchemaCompatibilityTests: XCTestCase {
    func testSwiftConstantsMatchCanonicalBridgeSchema() throws {
        let schema = try loadJSON("protocol/bridge-v1.schema.json")
        let strings = collectStrings(in: schema)

        let schemaCommands = Set(strings.filter { $0.contains(".") && BridgeCommand(rawValue: $0) != nil })
        XCTAssertEqual(schemaCommands, Set(BridgeCommand.allCases.map(\.rawValue)))

        let schemaErrorCodes = Set(strings.filter { BridgeErrorCode(rawValue: $0) != nil })
        XCTAssertEqual(schemaErrorCodes, Set(BridgeErrorCode.allCases.map(\.rawValue)))

        XCTAssertTrue(strings.contains(BridgeProtocolV1.name))
        XCTAssertTrue(strings.contains("macos"))
    }

    func testPayloadLimitMatchesTypeScriptSource() throws {
        let source = try String(contentsOf: repositoryRoot.appendingPathComponent("packages/bridge-contract/src/types.ts"))
        XCTAssertTrue(source.contains("MAX_BRIDGE_PAYLOAD_BYTES = 256 * 1024"))
        XCTAssertEqual(BridgeProtocolV1.maximumMessageBytes, 256 * 1024)
    }

    private var repositoryRoot: URL {
        var value = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        for _ in 0..<3 { value.deleteLastPathComponent() }
        return value
    }

    private func loadJSON(_ path: String) throws -> Any {
        let data = try Data(contentsOf: repositoryRoot.appendingPathComponent(path))
        return try JSONSerialization.jsonObject(with: data)
    }

    private func collectStrings(in value: Any) -> [String] {
        if let string = value as? String { return [string] }
        if let array = value as? [Any] { return array.flatMap(collectStrings) }
        if let object = value as? [String: Any] {
            return object.values.flatMap(collectStrings)
        }
        return []
    }
}
