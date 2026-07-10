import Foundation
@preconcurrency import WebKit

final class BridgeMessageHandler: NSObject, WKScriptMessageHandlerWithReply {
    static let name = "apolloBridge"

    private let originPolicy: OriginPolicy
    private let processor: BridgeMessageProcessor
    private let gate = BridgeConcurrencyGate(limit: 16)

    init(originPolicy: OriginPolicy, processor: BridgeMessageProcessor = BridgeMessageProcessor()) {
        self.originPolicy = originPolicy
        self.processor = processor
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard message.frameInfo.isMainFrame else {
            replyHandler(processor.reject(
                message.body,
                error: BridgeError(code: .invalidRequest, message: "Bridge messages are allowed only from the main frame.")
            ), nil)
            return
        }

        let securityOrigin = message.frameInfo.securityOrigin
        guard originPolicy.allowsBridge(
            scheme: securityOrigin.protocol,
            host: securityOrigin.host,
            port: securityOrigin.port
        ) else {
            replyHandler(processor.reject(
                message.body,
                error: BridgeError(code: .invalidRequest, message: "Bridge message origin is not allowed.")
            ), nil)
            return
        }

        guard gate.enter() else {
            replyHandler(processor.reject(
                message.body,
                error: BridgeError(code: .internalError, message: "Bridge request concurrency limit exceeded.")
            ), nil)
            return
        }
        defer { gate.leave() }
        replyHandler(processor.process(message.body), nil)
    }
}

private final class BridgeConcurrencyGate {
    private let lock = NSLock()
    private let limit: Int
    private var active = 0

    init(limit: Int) {
        self.limit = limit
    }

    func enter() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard active < limit else { return false }
        active += 1
        return true
    }

    func leave() {
        lock.lock()
        active = max(0, active - 1)
        lock.unlock()
    }
}
