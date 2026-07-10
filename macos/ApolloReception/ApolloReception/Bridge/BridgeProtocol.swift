import Foundation

enum BridgeProtocolV1 {
    static let version = 1
    static let name = "apollo-desktop-bridge"
    static let maximumMessageBytes = 256 * 1024
    static let fallbackRequestID = "00000000-0000-4000-8000-000000000000"
}

enum BridgeCommand: String, CaseIterable {
    case getVersion = "bridge.getVersion"
    case getCapabilities = "bridge.getCapabilities"
    case ping = "bridge.ping"
    case printerList = "printer.list"
    case printerStatus = "printer.status"
    case printerPrintTest = "printer.printTest"
    case printerPrintJob = "printer.printJob"
    case drawerStatus = "drawer.status"
    case drawerOpen = "drawer.open"
    case deviceGetProfile = "device.getProfile"

    var capabilityName: String? {
        switch self {
        case .printerList, .printerStatus, .printerPrintTest, .printerPrintJob:
            return "printing"
        case .drawerStatus, .drawerOpen:
            return "cashDrawer"
        case .deviceGetProfile:
            return "deviceSettings"
        case .getVersion, .getCapabilities, .ping:
            return nil
        }
    }
}
