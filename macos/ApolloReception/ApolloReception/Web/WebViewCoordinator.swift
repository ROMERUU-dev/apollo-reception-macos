import AppKit
@preconcurrency import WebKit

@MainActor
final class WebViewCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    private let navigationPolicy: NavigationPolicy
    private unowned let appState: AppState

    weak var webView: WKWebView?
    var bridgeHandler: BridgeMessageHandler?
    var lastReloadGeneration = 0

    init(configuration: AppConfiguration, appState: AppState) {
        navigationPolicy = NavigationPolicy(origins: OriginPolicy(configuration: configuration))
        self.appState = appState
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        let disposition = navigationPolicy.disposition(for: NavigationRequest(
            url: navigationAction.request.url,
            isUserInitiated: navigationAction.navigationType == .linkActivated,
            opensNewWindow: navigationAction.targetFrame == nil
        ))

        switch disposition {
        case .allow:
            decisionHandler(.allow)
        case .loadInCurrentWebView:
            decisionHandler(.cancel)
            webView.load(navigationAction.request)
        case .openExternally:
            decisionHandler(.cancel)
            if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        case .block:
            appState.noteBlockedNavigation(navigationAction.request.url)
            decisionHandler(.cancel)
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        let disposition = navigationPolicy.disposition(for: NavigationRequest(
            url: navigationResponse.response.url,
            isUserInitiated: false,
            opensNewWindow: false
        ))
        decisionHandler(disposition == .allow ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        appState.beginLoading(webView.url)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        appState.finishLoading(webView.url)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        report(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        report(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        appState.failLoading("Web content stopped unexpectedly. Reload is available.")
    }

    private func report(_ error: Error) {
        let value = error as NSError
        if value.domain == NSURLErrorDomain && value.code == NSURLErrorCancelled { return }
        appState.failLoading("Web load failed (\(value.domain) \(value.code)).")
    }
}
