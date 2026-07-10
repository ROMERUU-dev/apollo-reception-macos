import XCTest
@testable import ApolloReception

final class NavigationPolicyTests: XCTestCase {
    private var policy: NavigationPolicy!

    override func setUpWithError() throws {
        policy = NavigationPolicy(origins: OriginPolicy(
            apolloOrigin: try WebOrigin(url: XCTUnwrap(URL(string: "https://apollo.example"))),
            oidcOrigins: [try WebOrigin(url: XCTUnwrap(URL(string: "https://login.example")))],
            externalOrigins: [try WebOrigin(url: XCTUnwrap(URL(string: "https://docs.example")))]
        ))
    }

    func testApolloOriginIsAllowed() {
        XCTAssertEqual(disposition("https://apollo.example/recepcion"), .allow)
    }

    func testOIDCOriginIsAllowed() {
        XCTAssertEqual(disposition("https://login.example/oauth/authorize"), .allow)
    }

    func testUnknownHTTPSOriginIsBlocked() {
        XCTAssertEqual(disposition("https://unknown.example/"), .block)
    }

    func testJavaScriptSchemeIsBlocked() {
        XCTAssertEqual(disposition("javascript:alert(1)"), .block)
    }

    func testFileSchemeIsBlocked() {
        XCTAssertEqual(disposition("file:///tmp/index.html"), .block)
    }

    func testMalformedURLIsBlocked() {
        XCTAssertEqual(policy.disposition(for: NavigationRequest(url: nil, isUserInitiated: false, opensNewWindow: false)), .block)
    }

    func testAllowlistedExternalLinkOpensOutsideOnlyWhenUserInitiated() {
        XCTAssertEqual(disposition("https://docs.example/help", userInitiated: true), .openExternally)
        XCTAssertEqual(disposition("https://docs.example/help", userInitiated: false), .block)
    }

    func testApolloNewWindowLoadsInCurrentWebView() {
        XCTAssertEqual(disposition("https://apollo.example/recepcion/settings", opensNewWindow: true), .loadInCurrentWebView)
    }

    func testBridgePrivilegeBelongsOnlyToApolloOrigin() {
        let origins = policy.origins
        XCTAssertTrue(origins.allowsBridge(scheme: "https", host: "apollo.example", port: 443))
        XCTAssertFalse(origins.allowsBridge(scheme: "https", host: "login.example", port: 443))
        XCTAssertFalse(origins.allowsBridge(scheme: "https", host: "unknown.example", port: 443))
    }

    private func disposition(
        _ value: String,
        userInitiated: Bool = false,
        opensNewWindow: Bool = false
    ) -> NavigationDisposition {
        policy.disposition(for: NavigationRequest(
            url: URL(string: value),
            isUserInitiated: userInitiated,
            opensNewWindow: opensNewWindow
        ))
    }
}
