// Apollo desktop bridge — generated Swift Codable models.
//
// GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: protocol/bridge-v1.schema.json, protocol/receipt-v1.schema.json
// Regenerate with: npm run generate:swift
// Verified in CI by @apollo/swift-models (drift check against the committed file).
//
// Free-form JSON (BridgeError.details) uses the hand-written JSONValue helper in
// macos/Support/JSONValue.swift. These models carry no device or dispatch logic.

import Foundation

// MARK: - Protocol identity and envelopes

public enum BridgeProtocolInfo {
    public static let version = 1
    public static let name = "apollo-desktop-bridge"
}

public typealias BridgeErrorDetails = [String: JSONValue]

/// Command envelope. The Swift shell decodes `command` first, then decodes the
/// matching `Payload` type; payload decoding is command-specific and lives in
/// the hand-written dispatcher, not in these generated models.
public struct BridgeRequestEnvelope<Payload: Codable & Sendable>: Codable, Sendable {
    public let version: Int
    public let requestId: String
    public let command: BridgeCommand
    public let payload: Payload

    public init(version: Int = BridgeProtocolInfo.version, requestId: String, command: BridgeCommand, payload: Payload) {
        self.version = version
        self.requestId = requestId
        self.command = command
        self.payload = payload
    }
}

public struct BridgeSuccessResponse<ResultBody: Codable & Sendable>: Codable, Sendable {
    public let version: Int
    public let requestId: String
    public let ok: Bool
    public let result: ResultBody

    public init(version: Int = BridgeProtocolInfo.version, requestId: String, ok: Bool = true, result: ResultBody) {
        self.version = version
        self.requestId = requestId
        self.ok = ok
        self.result = result
    }
}

public struct BridgeFailureResponse: Codable, Sendable {
    public let version: Int
    public let requestId: String
    public let ok: Bool
    public let error: BridgeError

    public init(version: Int = BridgeProtocolInfo.version, requestId: String, ok: Bool = false, error: BridgeError) {
        self.version = version
        self.requestId = requestId
        self.ok = ok
        self.error = error
    }
}

// MARK: - Enumerations

public enum BridgeCommand: String, Codable, Sendable {
    case bridgeGetVersion = "bridge.getVersion"
    case bridgeGetCapabilities = "bridge.getCapabilities"
    case bridgePing = "bridge.ping"
    case printerList = "printer.list"
    case printerStatus = "printer.status"
    case printerPrintTest = "printer.printTest"
    case printerPrintJob = "printer.printJob"
    case drawerStatus = "drawer.status"
    case drawerOpen = "drawer.open"
    case deviceGetProfile = "device.getProfile"
}

public enum BridgeErrorCode: String, Codable, Sendable {
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

public enum BridgePlatform: String, Codable, Sendable {
    case browser
    case mockLinux = "mock-linux"
    case macos
}

public enum PrinterState: String, Codable, Sendable {
    case ready
    case offline
    case outOfPaper = "out_of_paper"
    case coverOpen = "cover_open"
    case busy
    case error
    case unavailable
}

public enum PrintJobStatus: String, Codable, Sendable {
    case accepted
    case completed
    case failed
}

public enum DrawerState: String, Codable, Sendable {
    case available
    case unavailable
    case open
    case closed
    case unknown
}

public enum DrawerActionStatus: String, Codable, Sendable {
    case opened
    case rejected
}

public enum DrawerReasonCode: String, Codable, Sendable {
    case cashPayment = "cash_payment"
    case cashDeposit = "cash_deposit"
    case cashWithdrawal = "cash_withdrawal"
    case cashOpening = "cash_opening"
    case cashClosing = "cash_closing"
    case supervisorOverride = "supervisor_override"
}

public enum ReceiptWidth: String, Codable, Sendable {
    case _58mm = "58mm"
    case _80mm = "80mm"
}

public enum ReceiptKind: String, Codable, Sendable {
    case payment
    case quote
    case cashOpening = "cash_opening"
    case cashClose = "cash_close"
    case voucher
}

public enum AdjustmentType: String, Codable, Sendable {
    case fixedDiscount = "fixed_discount"
    case percentageDiscount = "percentage_discount"
    case courtesy
    case socialSupport = "social_support"
    case other
}

public enum PaymentMethod: String, Codable, Sendable {
    case cash
    case card
    case transfer
    case other
}

public enum Currency: String, Codable, Sendable {
    case mxn = "MXN"
    case usd = "USD"
}

// MARK: - Receipt document

public struct ReceiptMoney: Codable, Sendable {
    public let currency: Currency
    public let amount: String

    public init(currency: Currency, amount: String) {
        self.currency = currency
        self.amount = amount
    }
}

public struct ReceiptTextBlock: Codable, Sendable {
    public let lines: [String]

    public init(lines: [String]) {
        self.lines = lines
    }
}

public struct ReceiptFacility: Codable, Sendable {
    public let name: String
    public let legalName: String?
    public let taxId: String?
    public let address: String?
    public let phone: String?
    public let logoReference: String?

    public init(name: String, legalName: String? = nil, taxId: String? = nil, address: String? = nil, phone: String? = nil, logoReference: String? = nil) {
        self.name = name
        self.legalName = legalName
        self.taxId = taxId
        self.address = address
        self.phone = phone
        self.logoReference = logoReference
    }
}

public struct ReceiptCustomer: Codable, Sendable {
    public let displayName: String?
    public let reference: String?

    public init(displayName: String? = nil, reference: String? = nil) {
        self.displayName = displayName
        self.reference = reference
    }
}

public struct ReceiptLine: Codable, Sendable {
    public let code: String?
    public let description: String
    public let quantity: String
    public let unitAmount: ReceiptMoney
    public let total: ReceiptMoney

    public init(code: String? = nil, description: String, quantity: String, unitAmount: ReceiptMoney, total: ReceiptMoney) {
        self.code = code
        self.description = description
        self.quantity = quantity
        self.unitAmount = unitAmount
        self.total = total
    }
}

public struct ReceiptAdjustment: Codable, Sendable {
    public let type: AdjustmentType
    public let label: String
    public let amount: ReceiptMoney
    public let percentage: String?

    public init(type: AdjustmentType, label: String, amount: ReceiptMoney, percentage: String? = nil) {
        self.type = type
        self.label = label
        self.amount = amount
        self.percentage = percentage
    }
}

public struct ReceiptPayment: Codable, Sendable {
    public let method: PaymentMethod
    public let label: String?
    public let amount: ReceiptMoney
    public let exchangeRate: String?

    public init(method: PaymentMethod, label: String? = nil, amount: ReceiptMoney, exchangeRate: String? = nil) {
        self.method = method
        self.label = label
        self.amount = amount
        self.exchangeRate = exchangeRate
    }
}

public struct ReceiptDocument: Codable, Sendable {
    public let version: Int
    public let kind: ReceiptKind
    public let documentId: String
    public let reference: String?
    public let issuedAt: String
    public let header: ReceiptTextBlock?
    public let facility: ReceiptFacility
    public let customer: ReceiptCustomer?
    public let lines: [ReceiptLine]
    public let subtotal: ReceiptMoney
    public let adjustments: [ReceiptAdjustment]
    public let total: ReceiptMoney
    public let payments: [ReceiptPayment]
    public let change: ReceiptMoney?
    public let footer: ReceiptTextBlock?
    public let qrReference: String?

    public init(version: Int, kind: ReceiptKind, documentId: String, reference: String? = nil, issuedAt: String, header: ReceiptTextBlock? = nil, facility: ReceiptFacility, customer: ReceiptCustomer? = nil, lines: [ReceiptLine], subtotal: ReceiptMoney, adjustments: [ReceiptAdjustment], total: ReceiptMoney, payments: [ReceiptPayment], change: ReceiptMoney? = nil, footer: ReceiptTextBlock? = nil, qrReference: String? = nil) {
        self.version = version
        self.kind = kind
        self.documentId = documentId
        self.reference = reference
        self.issuedAt = issuedAt
        self.header = header
        self.facility = facility
        self.customer = customer
        self.lines = lines
        self.subtotal = subtotal
        self.adjustments = adjustments
        self.total = total
        self.payments = payments
        self.change = change
        self.footer = footer
        self.qrReference = qrReference
    }
}

// MARK: - Bridge results

public struct PrinterSelector: Codable, Sendable {
    public let printerId: String?

    public init(printerId: String? = nil) {
        self.printerId = printerId
    }
}

public struct PrintOptions: Codable, Sendable {
    public let printerId: String?
    public let copies: Int?
    public let width: ReceiptWidth?

    public init(printerId: String? = nil, copies: Int? = nil, width: ReceiptWidth? = nil) {
        self.printerId = printerId
        self.copies = copies
        self.width = width
    }
}

public struct BridgeCapabilityFlags: Codable, Sendable {
    public let printing: Bool
    public let cashDrawer: Bool
    public let printerStatus: Bool
    public let deviceSettings: Bool

    public init(printing: Bool, cashDrawer: Bool, printerStatus: Bool, deviceSettings: Bool) {
        self.printing = printing
        self.cashDrawer = cashDrawer
        self.printerStatus = printerStatus
        self.deviceSettings = deviceSettings
    }
}

public struct BridgeCapabilities: Codable, Sendable {
    public let bridgeVersion: Int
    public let platform: BridgePlatform
    public let capabilities: BridgeCapabilityFlags

    public init(bridgeVersion: Int, platform: BridgePlatform, capabilities: BridgeCapabilityFlags) {
        self.bridgeVersion = bridgeVersion
        self.platform = platform
        self.capabilities = capabilities
    }
}

public struct PrinterInfo: Codable, Sendable {
    public let id: String
    public let name: String
    public let isDefault: Bool
    public let supportedWidths: [ReceiptWidth]

    public init(id: String, name: String, isDefault: Bool, supportedWidths: [ReceiptWidth]) {
        self.id = id
        self.name = name
        self.isDefault = isDefault
        self.supportedWidths = supportedWidths
    }
}

public struct PrinterStatus: Codable, Sendable {
    public let printerId: String
    public let state: PrinterState
    public let message: String?

    public init(printerId: String, state: PrinterState, message: String? = nil) {
        self.printerId = printerId
        self.state = state
        self.message = message
    }
}

public struct PrintJobResult: Codable, Sendable {
    public let printJobId: String
    public let status: PrintJobStatus
    public let acceptedAt: String
    public let completedAt: String?
    public let errorCode: String?

    public init(printJobId: String, status: PrintJobStatus, acceptedAt: String, completedAt: String? = nil, errorCode: String? = nil) {
        self.printJobId = printJobId
        self.status = status
        self.acceptedAt = acceptedAt
        self.completedAt = completedAt
        self.errorCode = errorCode
    }
}

public struct DrawerStatus: Codable, Sendable {
    public let state: DrawerState
    public let message: String?

    public init(state: DrawerState, message: String? = nil) {
        self.state = state
        self.message = message
    }
}

public struct DrawerResult: Codable, Sendable {
    public let actionId: String
    public let status: DrawerActionStatus
    public let reasonCode: DrawerReasonCode
    public let performedAt: String

    public init(actionId: String, status: DrawerActionStatus, reasonCode: DrawerReasonCode, performedAt: String) {
        self.actionId = actionId
        self.status = status
        self.reasonCode = reasonCode
        self.performedAt = performedAt
    }
}

public struct DeviceProfile: Codable, Sendable {
    public let deviceId: String
    public let displayName: String
    public let platform: BridgePlatform
    public let settingsWritable: Bool

    public init(deviceId: String, displayName: String, platform: BridgePlatform, settingsWritable: Bool) {
        self.deviceId = deviceId
        self.displayName = displayName
        self.platform = platform
        self.settingsWritable = settingsWritable
    }
}

public struct BridgeError: Codable, Sendable {
    public let code: BridgeErrorCode
    public let message: String
    public let details: BridgeErrorDetails?

    public init(code: BridgeErrorCode, message: String, details: BridgeErrorDetails? = nil) {
        self.code = code
        self.message = message
        self.details = details
    }
}

// MARK: - Command payloads

public struct EmptyPayload: Codable, Sendable {
    public init() {}
}

public struct BridgePingPayload: Codable, Sendable {
    public let nonce: String?

    public init(nonce: String? = nil) {
        self.nonce = nonce
    }
}

public struct PrintJobPayload: Codable, Sendable {
    public let printJobId: String
    public let document: ReceiptDocument
    public let options: PrintOptions

    public init(printJobId: String, document: ReceiptDocument, options: PrintOptions) {
        self.printJobId = printJobId
        self.document = document
        self.options = options
    }
}

public struct DrawerOpenPayload: Codable, Sendable {
    public let actionId: String
    public let authorizationGrant: String
    public let reasonCode: DrawerReasonCode

    public init(actionId: String, authorizationGrant: String, reasonCode: DrawerReasonCode) {
        self.actionId = actionId
        self.authorizationGrant = authorizationGrant
        self.reasonCode = reasonCode
    }
}
