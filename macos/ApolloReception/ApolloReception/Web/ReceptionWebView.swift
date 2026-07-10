import SwiftUI
import WebKit

struct ReceptionWebView: NSViewRepresentable {
    let configuration: AppConfiguration
    @ObservedObject var appState: AppState

    func makeCoordinator() -> WebViewCoordinator {
        WebViewCoordinator(configuration: configuration, appState: appState)
    }

    func makeNSView(context: Context) -> WKWebView {
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.websiteDataStore = .default()
        webConfiguration.preferences.javaScriptCanOpenWindowsAutomatically = false
        webConfiguration.defaultWebpagePreferences.allowsContentJavaScript = true

        let contentController = WKUserContentController()
        let bridgeHandler = BridgeMessageHandler(originPolicy: OriginPolicy(configuration: configuration))
        context.coordinator.bridgeHandler = bridgeHandler
        contentController.addScriptMessageHandler(bridgeHandler, contentWorld: .page, name: BridgeMessageHandler.name)
        contentController.addUserScript(WKUserScript(
            source: Self.bootstrapScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true,
            in: .page
        ))
        webConfiguration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        context.coordinator.webView = webView
        context.coordinator.lastReloadGeneration = appState.reloadGeneration
        webView.load(URLRequest(url: configuration.receptionURL))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastReloadGeneration != appState.reloadGeneration else { return }
        context.coordinator.lastReloadGeneration = appState.reloadGeneration
        if webView.url == nil {
            webView.load(URLRequest(url: configuration.receptionURL))
        } else {
            webView.reload()
        }
    }

    static func dismantleNSView(_ webView: WKWebView, coordinator: WebViewCoordinator) {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: BridgeMessageHandler.name,
            contentWorld: .page
        )
    }

    private static let bootstrapScript = """
    (() => {
      const handler = window.webkit?.messageHandlers?.apolloBridge;
      if (!handler || Object.prototype.hasOwnProperty.call(window, 'apolloNativeBridge')) return;
      const bridge = Object.freeze({
        postMessage: (request) => handler.postMessage(request)
      });
      Object.defineProperty(window, 'apolloNativeBridge', {
        value: bridge,
        configurable: false,
        enumerable: false,
        writable: false
      });
      window.dispatchEvent(new CustomEvent('apolloNativeBridgeReady', { detail: { version: 1 } }));
    })();
    """
}
