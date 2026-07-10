import Foundation

struct BridgeDispatcher {
    private let now: () -> Date

    init(now: @escaping () -> Date = Date.init) {
        self.now = now
    }

    func dispatch(_ request: BridgeRequest) throws -> Any {
        switch request.command {
        case .getVersion:
            return [
                "bridgeVersion": BridgeProtocolV1.version,
                "protocol": BridgeProtocolV1.name
            ]
        case .getCapabilities:
            return [
                "bridgeVersion": BridgeProtocolV1.version,
                "platform": "macos",
                "capabilities": [
                    "printing": false,
                    "cashDrawer": false,
                    "printerStatus": false,
                    "deviceSettings": false
                ]
            ]
        case .ping:
            return [
                "pong": request.payload["nonce"] as? String ?? "",
                "timestamp": timestamp(now())
            ]
        case .printerList, .printerStatus, .printerPrintTest, .printerPrintJob,
             .drawerStatus, .drawerOpen, .deviceGetProfile:
            let capability = request.command.capabilityName ?? "hardware"
            throw BridgeError(
                code: .unsupportedCapability,
                message: "Capability \(capability) is unavailable in this macOS build."
            )
        }
    }

    private func timestamp(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
