import Foundation

struct NavigationRequest {
    let url: URL?
    let isUserInitiated: Bool
    let opensNewWindow: Bool
}

enum NavigationDisposition: Equatable {
    case allow
    case loadInCurrentWebView
    case openExternally
    case block
}

struct NavigationPolicy {
    let origins: OriginPolicy

    func disposition(for request: NavigationRequest) -> NavigationDisposition {
        switch origins.classify(request.url) {
        case .apollo, .oidc:
            return request.opensNewWindow ? .loadInCurrentWebView : .allow
        case .external:
            return request.isUserInitiated ? .openExternally : .block
        case .blocked:
            return .block
        }
    }
}
