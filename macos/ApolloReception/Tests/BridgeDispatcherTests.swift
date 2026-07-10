import XCTest
@testable import ApolloReception

final class BridgeDispatcherTests: XCTestCase {
    private let requestID = "10000000-0000-4000-8000-000000000001"
    private let fixedDate = Date(timeIntervalSince1970: 1_767_225_600)
    private lazy var processor = BridgeMessageProcessor(
        dispatcher: BridgeDispatcher(now: { self.fixedDate })
    )

    func testPing() throws {
        let response = processor.process(request(command: "bridge.ping", payload: ["nonce": "mac-real"]))
        XCTAssertEqual(response["ok"] as? Bool, true)
        let result = try XCTUnwrap(response["result"] as? [String: Any])
        XCTAssertEqual(result["pong"] as? String, "mac-real")
        XCTAssertNotNil(result["timestamp"] as? String)
    }

    func testVersion() throws {
        let result = try successResult(processor.process(request(command: "bridge.getVersion")))
        XCTAssertEqual(result["bridgeVersion"] as? Int, 1)
        XCTAssertEqual(result["protocol"] as? String, "apollo-desktop-bridge")
    }

    func testCapabilitiesAreTruthful() throws {
        let result = try successResult(processor.process(request(command: "bridge.getCapabilities")))
        XCTAssertEqual(result["platform"] as? String, "macos")
        let capabilities = try XCTUnwrap(result["capabilities"] as? [String: Any])
        XCTAssertEqual(capabilities["printing"] as? Bool, false)
        XCTAssertEqual(capabilities["cashDrawer"] as? Bool, false)
        XCTAssertEqual(capabilities["printerStatus"] as? Bool, false)
        XCTAssertEqual(capabilities["deviceSettings"] as? Bool, false)
    }

    func testInvalidProtocolVersion() throws {
        var value = request(command: "bridge.ping")
        value["version"] = 2
        XCTAssertEqual(try error(value).code, "UNSUPPORTED_VERSION")
    }

    func testUnknownCommand() throws {
        XCTAssertEqual(try error(request(command: "shell.execute")).code, "UNKNOWN_COMMAND")
    }

    func testMalformedPayload() throws {
        XCTAssertEqual(
            try error(request(command: "bridge.ping", payload: ["nonce": 42])).code,
            "INVALID_REQUEST"
        )
        XCTAssertEqual(
            try error(request(command: "bridge.getVersion", payload: ["extra": true])).code,
            "INVALID_REQUEST"
        )
    }

    func testOversizedPayload() throws {
        let value = request(command: "bridge.ping", payload: ["nonce": String(repeating: "x", count: 300_000)])
        XCTAssertEqual(try error(value).code, "PAYLOAD_TOO_LARGE")
    }

    func testRequestIDIsPreserved() {
        let response = processor.process(request(command: "bridge.ping"))
        XCTAssertEqual(response["requestId"] as? String, requestID)
    }

    func testErrorIsDeterministic() throws {
        let value = request(command: "bridge.ping", payload: ["unexpected": true])
        let first = try error(value)
        let second = try error(value)
        XCTAssertEqual(first.code, second.code)
        XCTAssertEqual(first.message, second.message)
    }

    func testUnsupportedHardwareCapability() throws {
        let response = processor.process(request(command: "printer.list"))
        XCTAssertEqual(try error(response).code, "UNSUPPORTED_CAPABILITY")
    }

    func testStrictEnvelopeRejectsExtraProperties() throws {
        var value = request(command: "bridge.ping")
        value["extra"] = true
        XCTAssertEqual(try error(value).code, "INVALID_REQUEST")
    }

    private func request(command: String, payload: [String: Any] = [:]) -> [String: Any] {
        ["version": 1, "requestId": requestID, "command": command, "payload": payload]
    }

    private func successResult(_ response: [String: Any]) throws -> [String: Any] {
        XCTAssertEqual(response["ok"] as? Bool, true)
        return try XCTUnwrap(response["result"] as? [String: Any])
    }

    private func error(_ requestOrResponse: [String: Any]) throws -> (code: String, message: String) {
        let response: [String: Any]
        if requestOrResponse["ok"] == nil {
            response = processor.process(requestOrResponse)
        } else {
            response = requestOrResponse
        }
        XCTAssertEqual(response["ok"] as? Bool, false)
        let value = try XCTUnwrap(response["error"] as? [String: Any])
        return (
            try XCTUnwrap(value["code"] as? String),
            try XCTUnwrap(value["message"] as? String)
        )
    }
}
