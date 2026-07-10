import XCTest
@testable import ApolloReception

final class AppConfigurationTests: XCTestCase {
    func testFailsClosedWithoutEnvironment() throws {
        XCTAssertThrowsError(try load([:])) { error in
            XCTAssertEqual(error as? AppConfigurationError, .missing(AppConfiguration.environmentKey))
        }
    }

    func testProductionRequiresHTTPS() throws {
        XCTAssertThrowsError(try load([
            AppConfiguration.environmentKey: "production",
            AppConfiguration.baseURLKey: "http://apollo.example"
        ])) { error in
            XCTAssertEqual(error as? AppConfigurationError, .insecureURL(AppConfiguration.baseURLKey))
        }
    }

    func testLocalAllowsOnlyLoopbackHTTP() throws {
        let configuration = try load([
            AppConfiguration.environmentKey: "local",
            AppConfiguration.baseURLKey: "http://127.0.0.1:4173"
        ])
        XCTAssertEqual(configuration.receptionURL.absoluteString, "http://127.0.0.1:4173/recepcion")

        XCTAssertThrowsError(try load([
            AppConfiguration.environmentKey: "local",
            AppConfiguration.baseURLKey: "http://192.168.1.2:4173"
        ]))
    }

    func testOriginsRejectPathsAndCredentials() throws {
        XCTAssertThrowsError(try load([
            AppConfiguration.environmentKey: "staging",
            AppConfiguration.baseURLKey: "https://apollo.example/base"
        ]))
        XCTAssertThrowsError(try load([
            AppConfiguration.environmentKey: "staging",
            AppConfiguration.baseURLKey: "https://user:pass@apollo.example"
        ]))
    }

    func testOIDCAndExternalOriginsAreExplicit() throws {
        let configuration = try load([
            AppConfiguration.environmentKey: "staging",
            AppConfiguration.baseURLKey: "https://apollo.example",
            AppConfiguration.oidcOriginsKey: "https://login.example",
            AppConfiguration.externalOriginsKey: "https://docs.example"
        ])
        XCTAssertTrue(configuration.oidcOrigins.contains(try WebOrigin(url: XCTUnwrap(URL(string: "https://login.example")))))
        XCTAssertTrue(configuration.externalOrigins.contains(try WebOrigin(url: XCTUnwrap(URL(string: "https://docs.example")))))
    }

    private func load(_ values: [String: String]) throws -> AppConfiguration {
        let suite = "ApolloReceptionTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        return try AppConfiguration.load(processEnvironment: values, userDefaults: defaults)
    }
}
