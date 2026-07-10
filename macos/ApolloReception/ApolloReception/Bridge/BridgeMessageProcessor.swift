import Foundation

struct BridgeMessageProcessor {
    private let validator: BridgeRequestValidator
    private let dispatcher: BridgeDispatcher

    init(
        validator: BridgeRequestValidator = BridgeRequestValidator(),
        dispatcher: BridgeDispatcher = BridgeDispatcher()
    ) {
        self.validator = validator
        self.dispatcher = dispatcher
    }

    func process(_ body: Any) -> [String: Any] {
        let requestID = requestID(from: body)
        do {
            let request = try validator.validate(body)
            let result = try dispatcher.dispatch(request)
            return BridgeResponse.success(requestID: request.requestID, result: result)
        } catch let error as BridgeError {
            return BridgeResponse.failure(requestID: requestID, error: error)
        } catch {
            return BridgeResponse.failure(
                requestID: requestID,
                error: BridgeError(code: .internalError, message: "Bridge request failed internally.")
            )
        }
    }

    func reject(_ body: Any, error: BridgeError) -> [String: Any] {
        BridgeResponse.failure(requestID: requestID(from: body), error: error)
    }

    private func requestID(from body: Any) -> String {
        guard let value = (body as? [String: Any])?["requestId"] as? String,
              UUID(uuidString: value) != nil else { return BridgeProtocolV1.fallbackRequestID }
        return value
    }
}
