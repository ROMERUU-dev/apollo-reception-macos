import CoreFoundation
import Foundation

struct BridgeRequest {
    let version: Int
    let requestID: String
    let command: BridgeCommand
    let payload: [String: Any]
}

struct BridgeRequestValidator {
    func validate(_ value: Any) throws -> BridgeRequest {
        let data: Data
        do {
            guard JSONSerialization.isValidJSONObject(value) else { throw BridgeError.invalidObject }
            data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
        } catch let error as BridgeError {
            throw error
        } catch {
            throw BridgeError.invalidObject
        }

        guard data.count <= BridgeProtocolV1.maximumMessageBytes else {
            throw BridgeError(
                code: .payloadTooLarge,
                message: "Bridge message exceeds \(BridgeProtocolV1.maximumMessageBytes) bytes."
            )
        }
        guard let object = value as? [String: Any] else { throw BridgeError.invalidObject }
        guard Set(object.keys) == ["version", "requestId", "command", "payload"] else {
            throw BridgeError.invalidEnvelope
        }

        guard let version = strictInteger(object["version"]) else { throw BridgeError.invalidEnvelope }
        guard version == BridgeProtocolV1.version else {
            throw BridgeError(code: .unsupportedVersion, message: "Only bridge protocol version 1 is supported.")
        }
        guard let requestID = object["requestId"] as? String,
              UUID(uuidString: requestID) != nil else {
            throw BridgeError(code: .invalidRequest, message: "requestId must be a UUID.")
        }
        guard let commandValue = object["command"] as? String,
              let command = BridgeCommand(rawValue: commandValue) else {
            throw BridgeError(code: .unknownCommand, message: "Command is not in the bridge v1 allowlist.")
        }
        guard let payload = object["payload"] as? [String: Any] else {
            throw BridgeError(code: .invalidRequest, message: "Invalid \(command.rawValue) request payload.")
        }

        try validatePayload(payload, for: command)
        return BridgeRequest(version: version, requestID: requestID, command: command, payload: payload)
    }

    private func validatePayload(_ payload: [String: Any], for command: BridgeCommand) throws {
        let isValid: Bool
        switch command {
        case .getVersion, .getCapabilities, .printerList, .drawerStatus, .deviceGetProfile:
            isValid = payload.isEmpty
        case .ping:
            isValid = exactKeys(payload, required: [], allowed: ["nonce"])
                && optionalString(payload["nonce"], minimum: 0, maximum: 128)
        case .printerStatus:
            isValid = exactKeys(payload, required: [], allowed: ["printerId"])
                && optionalString(payload["printerId"], minimum: 1, maximum: 120)
        case .printerPrintTest:
            isValid = validatePrintOptions(payload)
        case .printerPrintJob:
            isValid = validatePrintJob(payload)
        case .drawerOpen:
            isValid = validateDrawerOpen(payload)
        }
        guard isValid else {
            throw BridgeError(code: .invalidRequest, message: "Invalid \(command.rawValue) request payload.")
        }
    }

    private func validatePrintOptions(_ value: [String: Any]) -> Bool {
        guard exactKeys(value, required: [], allowed: ["printerId", "copies", "width"]),
              optionalString(value["printerId"], minimum: 1, maximum: 120) else { return false }
        if let copiesValue = value["copies"] {
            guard let copies = strictInteger(copiesValue), (1...5).contains(copies) else { return false }
        }
        if let width = value["width"] as? String, !["58mm", "80mm"].contains(width) { return false }
        if value.keys.contains("width") && value["width"] as? String == nil { return false }
        return true
    }

    private func validatePrintJob(_ value: [String: Any]) -> Bool {
        guard exactKeys(value, required: ["printJobId", "document", "options"], allowed: ["printJobId", "document", "options"]),
              let printJobID = value["printJobId"] as? String,
              UUID(uuidString: printJobID) != nil,
              let document = value["document"] as? [String: Any],
              let options = value["options"] as? [String: Any] else { return false }
        return validateReceipt(document) && validatePrintOptions(options)
    }

    private func validateDrawerOpen(_ value: [String: Any]) -> Bool {
        let reasons = ["cash_payment", "cash_deposit", "cash_withdrawal", "cash_opening", "cash_closing", "supervisor_override"]
        guard exactKeys(
            value,
            required: ["actionId", "authorizationGrant", "reasonCode"],
            allowed: ["actionId", "authorizationGrant", "reasonCode"]
        ), let actionID = value["actionId"] as? String,
           UUID(uuidString: actionID) != nil,
           requiredString(value["authorizationGrant"], minimum: 16, maximum: 4096),
           let reason = value["reasonCode"] as? String,
           reasons.contains(reason) else { return false }
        return true
    }

    private func validateReceipt(_ value: [String: Any]) -> Bool {
        let required: Set<String> = ["version", "kind", "documentId", "issuedAt", "facility", "lines", "subtotal", "adjustments", "total", "payments"]
        let allowed = required.union(["reference", "header", "customer", "change", "footer", "qrReference"])
        guard exactKeys(value, required: required, allowed: allowed),
              strictInteger(value["version"]) == 1,
              let kind = value["kind"] as? String,
              ["payment", "quote", "cash_opening", "cash_close", "voucher"].contains(kind),
              let documentID = value["documentId"] as? String,
              UUID(uuidString: documentID) != nil,
              requiredDate(value["issuedAt"]),
              optionalString(value["reference"], minimum: 1, maximum: 80),
              optionalString(value["qrReference"], minimum: 0, maximum: 512),
              let facility = value["facility"] as? [String: Any], validateFacility(facility),
              optionalObject(value["customer"], validator: validateCustomer),
              optionalObject(value["header"], validator: validateTextBlock),
              optionalObject(value["footer"], validator: validateTextBlock),
              let lines = value["lines"] as? [Any], lines.count <= 100, lines.allSatisfy(validateLine),
              let subtotal = value["subtotal"] as? [String: Any], validateMoney(subtotal),
              let adjustments = value["adjustments"] as? [Any], adjustments.count <= 50, adjustments.allSatisfy(validateAdjustment),
              let total = value["total"] as? [String: Any], validateMoney(total),
              let payments = value["payments"] as? [Any], payments.count <= 20, payments.allSatisfy(validatePayment),
              optionalObject(value["change"], validator: validateMoney) else { return false }
        return true
    }

    private func validateFacility(_ value: [String: Any]) -> Bool {
        guard exactKeys(value, required: ["name"], allowed: ["name", "legalName", "taxId", "address", "phone", "logoReference"]),
              requiredString(value["name"], minimum: 1, maximum: 160),
              optionalString(value["legalName"], minimum: 0, maximum: 160),
              optionalString(value["taxId"], minimum: 0, maximum: 20),
              optionalString(value["address"], minimum: 0, maximum: 255),
              optionalString(value["phone"], minimum: 0, maximum: 32),
              optionalString(value["logoReference"], minimum: 1, maximum: 80) else { return false }
        if let logo = value["logoReference"] as? String {
            return matches(logo, pattern: "^[A-Za-z0-9._-]{1,80}$")
        }
        return true
    }

    private func validateCustomer(_ value: [String: Any]) -> Bool {
        exactKeys(value, required: [], allowed: ["displayName", "reference"])
            && optionalString(value["displayName"], minimum: 0, maximum: 160)
            && optionalString(value["reference"], minimum: 0, maximum: 80)
    }

    private func validateLine(_ raw: Any) -> Bool {
        guard let value = raw as? [String: Any],
              exactKeys(value, required: ["description", "quantity", "unitAmount", "total"], allowed: ["code", "description", "quantity", "unitAmount", "total"]),
              optionalString(value["code"], minimum: 0, maximum: 40),
              requiredString(value["description"], minimum: 1, maximum: 240),
              requiredDecimal(value["quantity"]),
              let unitAmount = value["unitAmount"] as? [String: Any], validateMoney(unitAmount),
              let total = value["total"] as? [String: Any], validateMoney(total) else { return false }
        return true
    }

    private func validateAdjustment(_ raw: Any) -> Bool {
        guard let value = raw as? [String: Any],
              exactKeys(value, required: ["type", "label", "amount"], allowed: ["type", "label", "amount", "percentage"]),
              let type = value["type"] as? String,
              ["fixed_discount", "percentage_discount", "courtesy", "social_support", "other"].contains(type),
              requiredString(value["label"], minimum: 1, maximum: 120),
              let amount = value["amount"] as? [String: Any], validateMoney(amount),
              optionalDecimal(value["percentage"]) else { return false }
        return true
    }

    private func validatePayment(_ raw: Any) -> Bool {
        guard let value = raw as? [String: Any],
              exactKeys(value, required: ["method", "amount"], allowed: ["method", "label", "amount", "exchangeRate"]),
              let method = value["method"] as? String,
              ["cash", "card", "transfer", "other"].contains(method),
              optionalString(value["label"], minimum: 0, maximum: 80),
              let amount = value["amount"] as? [String: Any], validateMoney(amount),
              optionalDecimal(value["exchangeRate"]) else { return false }
        return true
    }

    private func validateMoney(_ value: [String: Any]) -> Bool {
        guard exactKeys(value, required: ["currency", "amount"], allowed: ["currency", "amount"]),
              let currency = value["currency"] as? String,
              ["MXN", "USD"].contains(currency),
              let amount = value["amount"] as? String else { return false }
        return matches(amount, pattern: "^(0|[1-9][0-9]*)\\.[0-9]{2}$")
    }

    private func validateTextBlock(_ value: [String: Any]) -> Bool {
        guard exactKeys(value, required: ["lines"], allowed: ["lines"]),
              let lines = value["lines"] as? [Any], lines.count <= 10 else { return false }
        return lines.allSatisfy { requiredString($0, minimum: 0, maximum: 240) }
    }

    private func exactKeys(_ value: [String: Any], required: Set<String>, allowed: Set<String>) -> Bool {
        let keys = Set(value.keys)
        return required.isSubset(of: keys) && keys.isSubset(of: allowed)
    }

    private func strictInteger(_ raw: Any?) -> Int? {
        guard let number = raw as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        let double = number.doubleValue
        guard double.rounded() == double else { return nil }
        return Int(exactly: double)
    }

    private func requiredString(_ raw: Any?, minimum: Int, maximum: Int) -> Bool {
        guard let string = raw as? String else { return false }
        return string.count >= minimum && string.count <= maximum
    }

    private func optionalString(_ raw: Any?, minimum: Int, maximum: Int) -> Bool {
        raw == nil || requiredString(raw, minimum: minimum, maximum: maximum)
    }

    private func requiredDecimal(_ raw: Any?) -> Bool {
        guard let string = raw as? String else { return false }
        return matches(string, pattern: "^(0|[1-9][0-9]*)(\\.[0-9]{1,6})?$")
    }

    private func optionalDecimal(_ raw: Any?) -> Bool {
        raw == nil || requiredDecimal(raw)
    }

    private func requiredDate(_ raw: Any?) -> Bool {
        guard let string = raw as? String else { return false }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if formatter.date(from: string) != nil { return true }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string) != nil
    }

    private func optionalObject(
        _ raw: Any?,
        validator: ([String: Any]) -> Bool
    ) -> Bool {
        guard let raw else { return true }
        guard let object = raw as? [String: Any] else { return false }
        return validator(object)
    }

    private func matches(_ value: String, pattern: String) -> Bool {
        value.range(of: pattern, options: .regularExpression) != nil
    }
}
