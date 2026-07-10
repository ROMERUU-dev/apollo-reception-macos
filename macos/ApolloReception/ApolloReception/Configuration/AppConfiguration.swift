import Foundation

enum AppConfigurationError: Error, Equatable, LocalizedError {
    case missing(String)
    case invalidEnvironment(String)
    case invalidURL(String)
    case insecureURL(String)
    case originOnlyRequired(String)

    var errorDescription: String? {
        switch self {
        case .missing(let key):
            return "Missing required configuration: \(key)."
        case .invalidEnvironment(let value):
            return "Unsupported APOLLO_ENVIRONMENT: \(value)."
        case .invalidURL(let key):
            return "\(key) must contain valid absolute URL origins."
        case .insecureURL(let key):
            return "\(key) requires HTTPS, except loopback HTTP in the local environment."
        case .originOnlyRequired(let key):
            return "\(key) entries must be origins without credentials, paths, queries, or fragments."
        }
    }
}

struct AppConfiguration: Equatable {
    static let environmentKey = "APOLLO_ENVIRONMENT"
    static let baseURLKey = "APOLLO_BASE_URL"
    static let oidcOriginsKey = "APOLLO_OIDC_ORIGINS"
    static let externalOriginsKey = "APOLLO_EXTERNAL_ORIGINS"

    let environment: ApolloEnvironment
    let baseURL: URL
    let receptionURL: URL
    let apolloOrigin: WebOrigin
    let oidcOrigins: Set<WebOrigin>
    let externalOrigins: Set<WebOrigin>

    static func load(
        processEnvironment: [String: String] = ProcessInfo.processInfo.environment,
        userDefaults: UserDefaults = .standard
    ) throws -> AppConfiguration {
        func value(for key: String) -> String? {
            let processValue = processEnvironment[key]?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let processValue, !processValue.isEmpty { return processValue }
            let defaultsValue = userDefaults.string(forKey: key)?.trimmingCharacters(in: .whitespacesAndNewlines)
            return defaultsValue.flatMap { $0.isEmpty ? nil : $0 }
        }

        guard let environmentValue = value(for: environmentKey) else {
            throw AppConfigurationError.missing(environmentKey)
        }
        guard let environment = ApolloEnvironment(rawValue: environmentValue.lowercased()) else {
            throw AppConfigurationError.invalidEnvironment(environmentValue)
        }
        guard let baseValue = value(for: baseURLKey) else {
            throw AppConfigurationError.missing(baseURLKey)
        }

        let baseURL = try parseOriginURL(baseValue, key: baseURLKey, environment: environment)
        guard let receptionURL = URL(string: "/recepcion", relativeTo: baseURL)?.absoluteURL else {
            throw AppConfigurationError.invalidURL(baseURLKey)
        }
        let apolloOrigin = try WebOrigin(url: baseURL)
        let oidcOrigins = try parseOrigins(value(for: oidcOriginsKey), key: oidcOriginsKey, environment: environment)
        let externalOrigins = try parseOrigins(value(for: externalOriginsKey), key: externalOriginsKey, environment: environment)

        return AppConfiguration(
            environment: environment,
            baseURL: baseURL,
            receptionURL: receptionURL,
            apolloOrigin: apolloOrigin,
            oidcOrigins: oidcOrigins.subtracting([apolloOrigin]),
            externalOrigins: externalOrigins.subtracting([apolloOrigin]).subtracting(oidcOrigins)
        )
    }

    private static func parseOrigins(
        _ rawValue: String?,
        key: String,
        environment: ApolloEnvironment
    ) throws -> Set<WebOrigin> {
        guard let rawValue else { return [] }
        let values = rawValue.split(separator: ",", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        var result = Set<WebOrigin>()
        for value in values {
            let url = try parseOriginURL(value, key: key, environment: environment)
            result.insert(try WebOrigin(url: url))
        }
        return result
    }

    private static func parseOriginURL(
        _ value: String,
        key: String,
        environment: ApolloEnvironment
    ) throws -> URL {
        guard let components = URLComponents(string: value),
              components.url != nil,
              let scheme = components.scheme?.lowercased(),
              let host = components.host,
              !host.isEmpty else {
            throw AppConfigurationError.invalidURL(key)
        }
        guard components.user == nil,
              components.password == nil,
              components.query == nil,
              components.fragment == nil,
              components.path.isEmpty || components.path == "/" else {
            throw AppConfigurationError.originOnlyRequired(key)
        }

        let isLocalHTTP = environment == .local && scheme == "http" && WebOrigin.isLoopbackHost(host)
        guard scheme == "https" || isLocalHTTP else {
            throw AppConfigurationError.insecureURL(key)
        }

        var normalized = components
        normalized.path = "/"
        guard let url = normalized.url else { throw AppConfigurationError.invalidURL(key) }
        return url
    }
}
