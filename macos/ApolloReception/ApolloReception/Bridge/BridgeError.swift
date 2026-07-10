import Foundation

enum BridgeErrorCode: String, CaseIterable {
    case invalidRequest = "INVALID_REQUEST"
    case unsupportedVersion = "UNSUPPORTED_VERSION"
    case unknownCommand = "UNKNOWN_COMMAND"
    case payloadTooLarge = "PAYLOAD_TOO_LARGE"
    case timeout = "TIMEOUT"
    case cancelled = "CANCELLED"
    case unsupportedCapability = "UNSUPPORTED_CAPABILITY"
    case printerUnavailable = "PRINTER_UNAVAILABLE"
    case printerOffline = "PRINTER_OFFLINE"
    case printerOutOfPaper = "PRINTER_OUT_OF_PAPER"
    case printerCoverOpen = "PRINTER_COVER_OPEN"
    case printerBusy = "PRINTER_BUSY"
    case printFailed = "PRINT_FAILED"
    case drawerUnavailable = "DRAWER_UNAVAILABLE"
    case drawerUnauthorized = "DRAWER_UNAUTHORIZED"
    case duplicateAction = "DUPLICATE_ACTION"
    case internalError = "INTERNAL_ERROR"
}

struct BridgeError: Error, Equatable {
    let code: BridgeErrorCode
    let message: String

    static let invalidObject = BridgeError(
        code: .invalidRequest,
        message: "Bridge request must be a JSON object."
    )

    static let invalidEnvelope = BridgeError(
        code: .invalidRequest,
        message: "Bridge request must contain exactly version, requestId, command, and payload."
    )
}
