import Foundation

struct BridgeResponse {
    static func success(requestID: String, result: Any) -> [String: Any] {
        [
            "version": BridgeProtocolV1.version,
            "requestId": requestID,
            "ok": true,
            "result": result
        ]
    }

    static func failure(requestID: String, error: BridgeError) -> [String: Any] {
        [
            "version": BridgeProtocolV1.version,
            "requestId": requestID,
            "ok": false,
            "error": [
                "code": error.code.rawValue,
                "message": String(error.message.prefix(240))
            ]
        ]
    }
}
