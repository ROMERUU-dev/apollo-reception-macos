import Foundation

struct WebOrigin: Hashable, CustomStringConvertible {
    let scheme: String
    let host: String
    let port: Int

    init(url: URL) throws {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let scheme = components.scheme?.lowercased(),
              let host = components.host?.lowercased(),
              components.user == nil,
              components.password == nil else {
            throw AppConfigurationError.invalidURL("origin")
        }
        self.scheme = scheme
        self.host = host
        self.port = components.port ?? Self.defaultPort(for: scheme)
    }

    init?(scheme: String, host: String, port: Int) {
        let normalizedScheme = scheme.lowercased()
        let normalizedHost = host.lowercased()
        guard !normalizedScheme.isEmpty, !normalizedHost.isEmpty else { return nil }
        self.scheme = normalizedScheme
        self.host = normalizedHost
        self.port = port == 0 ? Self.defaultPort(for: normalizedScheme) : port
    }

    var description: String {
        let defaultPort = Self.defaultPort(for: scheme)
        return port == defaultPort ? "\(scheme)://\(host)" : "\(scheme)://\(host):\(port)"
    }

    static func isLoopbackHost(_ host: String) -> Bool {
        let normalized = host.lowercased()
        return normalized == "localhost" || normalized == "127.0.0.1" || normalized == "::1"
    }

    private static func defaultPort(for scheme: String) -> Int {
        switch scheme {
        case "https": return 443
        case "http": return 80
        default: return -1
        }
    }
}

enum OriginClassification: Equatable {
    case apollo
    case oidc
    case external
    case blocked
}

struct OriginPolicy {
    let apolloOrigin: WebOrigin
    let oidcOrigins: Set<WebOrigin>
    let externalOrigins: Set<WebOrigin>

    init(apolloOrigin: WebOrigin, oidcOrigins: Set<WebOrigin>, externalOrigins: Set<WebOrigin>) {
        self.apolloOrigin = apolloOrigin
        self.oidcOrigins = oidcOrigins
        self.externalOrigins = externalOrigins
    }

    init(configuration: AppConfiguration) {
        apolloOrigin = configuration.apolloOrigin
        oidcOrigins = configuration.oidcOrigins
        externalOrigins = configuration.externalOrigins
    }

    func classify(_ url: URL?) -> OriginClassification {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.user == nil,
              components.password == nil,
              let origin = try? WebOrigin(url: url) else { return .blocked }
        if origin == apolloOrigin { return .apollo }
        if oidcOrigins.contains(origin) { return .oidc }
        if externalOrigins.contains(origin) { return .external }
        return .blocked
    }

    func allowsBridge(scheme: String, host: String, port: Int) -> Bool {
        guard let origin = WebOrigin(scheme: scheme, host: host, port: port) else { return false }
        return origin == apolloOrigin
    }

    func allowsBridge(documentURL: URL?) -> Bool {
        guard classify(documentURL) == .apollo,
              let path = documentURL?.path.lowercased() else { return false }

        // Apollo currently hosts Keycloak and oauth2-proxy below the same HTTPS
        // origin as React. Those documents may navigate in the WKWebView, but
        // must never inherit the privileged React bridge merely by sharing an
        // origin.
        return !Self.isAuthenticationPath(path)
    }

    private static func isAuthenticationPath(_ path: String) -> Bool {
        path == "/auth" || path.hasPrefix("/auth/") ||
            path == "/oauth2" || path.hasPrefix("/oauth2/")
    }
}
