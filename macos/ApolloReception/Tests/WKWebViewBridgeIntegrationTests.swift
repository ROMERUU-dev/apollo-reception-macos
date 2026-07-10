import WebKit
import XCTest
@testable import ApolloReception

@MainActor
final class WKWebViewBridgeIntegrationTests: XCTestCase {
    func testRealWKWebViewJavaScriptToSwiftRoundtrip() async throws {
        let scheme = "apollotest"
        let host = "reception"
        let requestID = "10000000-0000-4000-8000-000000000010"
        let contentController = WKUserContentController()
        let origin = try XCTUnwrap(WebOrigin(scheme: scheme, host: host, port: 0))
        let bridgeHandler = BridgeMessageHandler(originPolicy: OriginPolicy(
            apolloOrigin: origin,
            oidcOrigins: [],
            externalOrigins: []
        ))
        contentController.addScriptMessageHandler(
            bridgeHandler,
            contentWorld: .page,
            name: BridgeMessageHandler.name
        )

        let configuration = WKWebViewConfiguration()
        let schemeHandler = SyntheticSchemeHandler()
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: scheme)
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .init(x: 0, y: 0, width: 640, height: 480), configuration: configuration)
        let navigation = NavigationCompletion(testCase: self)
        webView.navigationDelegate = navigation
        webView.load(try XCTUnwrap(URLRequest(url: XCTUnwrap(URL(string: "\(scheme)://\(host)/recepcion")))))
        await fulfillment(of: [navigation.finished], timeout: 5)
        if let error = navigation.error { throw error }

        let value = try await webView.callAsyncJavaScript(
            "return await window.webkit.messageHandlers.apolloBridge.postMessage(request);",
            arguments: [
                "request": [
                    "version": 1,
                    "requestId": requestID,
                    "command": "bridge.ping",
                    "payload": ["nonce": "real-wkwebview"]
                ]
            ],
            in: nil,
            contentWorld: .page
        )

        let response = try XCTUnwrap(value as? [String: Any])
        XCTAssertEqual(response["requestId"] as? String, requestID)
        XCTAssertEqual(response["ok"] as? Bool, true)
        let result = try XCTUnwrap(response["result"] as? [String: Any])
        XCTAssertEqual(result["pong"] as? String, "real-wkwebview")
    }
}

private final class SyntheticSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let html = "<!doctype html><meta charset='utf-8'><title>Synthetic Apollo Reception</title>"
        let data = Data(html.utf8)
        let response = URLResponse(
            url: urlSchemeTask.request.url!,
            mimeType: "text/html",
            expectedContentLength: data.count,
            textEncodingName: "utf-8"
        )
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

private final class NavigationCompletion: NSObject, WKNavigationDelegate {
    let finished: XCTestExpectation
    private(set) var error: Error?

    init(testCase: XCTestCase) {
        finished = testCase.expectation(description: "WKWebView navigation finished")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        finished.fulfill()
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        self.error = error
        finished.fulfill()
    }
}
