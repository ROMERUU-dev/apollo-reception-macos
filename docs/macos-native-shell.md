# macOS native shell

## Product and architecture

The Xcode project is `macos/ApolloReception/ApolloReception.xcodeproj` and produces `ApolloReception.app`.

```text
ApolloReception.app
  ├── SwiftUI lifecycle and AppKit interoperability
  ├── persistent WKWebView
  │     └── configured Apollo /recepcion route
  └── WKScriptMessageHandlerWithReply: apolloBridge
        ├── strict Bridge Protocol v1 request validation
        ├── bridge.ping
        ├── bridge.getVersion
        └── bridge.getCapabilities
```

The reply handler resolves the Promise returned by `window.webkit.messageHandlers.apolloBridge.postMessage(request)`. No dynamic JavaScript evaluation, selector reflection, shell, filesystem, USB, serial, or raw printer bytes are exposed. The TypeScript client includes `createApolloWebKitTransport` for this Promise transport.

## Configuration

The app fails closed unless both values exist:

- `APOLLO_ENVIRONMENT`: `local`, `development`, `staging`, or `production`
- `APOLLO_BASE_URL`: an origin only, without credentials, path, query, or fragment

Optional comma-separated origin allowlists are:

- `APOLLO_OIDC_ORIGINS`
- `APOLLO_EXTERNAL_ORIGINS`

Process environment values take precedence over macOS `UserDefaults`. Persistent non-secret configuration can be set with commands such as:

```bash
defaults write dev.romeruu.apollo-reception APOLLO_ENVIRONMENT -string staging
defaults write dev.romeruu.apollo-reception APOLLO_BASE_URL -string https://staging.example
defaults write dev.romeruu.apollo-reception APOLLO_OIDC_ORIGINS -string https://login.example
```

Development, staging, and production require HTTPS. Only the `local` environment accepts HTTP, and only for `localhost`, `127.0.0.1`, or `::1`. There is no production default.

## Navigation and OIDC behavior

- The exact Apollo origin and exact configured OIDC origins stay inside WKWebView.
- Cookies and website data use `WKWebsiteDataStore.default()`, so normal web sessions persist.
- New-window navigation to Apollo/OIDC is redirected into the existing WKWebView.
- An external HTTPS URL opens through the system only when its exact origin is allowlisted and the navigation is a user-activated link.
- Unknown HTTPS, `javascript:`, `file:`, malformed URLs, credentials in origins, and unknown schemes are blocked.
- Bridge messages must come from the Apollo main frame. OIDC and child frames cannot call the native bridge.
- Authentication remains Apollo web authentication; no parallel native login is implemented.

The connected PACS backend currently describes authentication as future work and no matching Apollo React/OIDC deployment URL or development account was available. Login, callback, refresh/expiry, logout, and reauthentication therefore remain unvalidated rather than simulated.

## Bridge compatibility and security

Swift models and validators implement the canonical v1 envelope and command payload constraints, including Receipt v1 constraints for print-job input even though hardware commands are disabled. Compatibility tests read the repository JSON Schema and compare the Swift command/error sets and the TypeScript 256 KiB constant.

- protocol version: exactly `1`
- request correlation: UUID `requestId` preserved in every response
- request limit: 256 KiB before dispatch
- command set: canonical ten-command allowlist
- native implementations: three bridge introspection commands only
- known hardware commands: deterministic `UNSUPPORTED_CAPABILITY`
- concurrency ceiling: 16 in-flight native messages
- hardware capabilities: all `false`

Timeout and cancellation remain enforced by `JsonBridgeClient`; native phase-one commands return synchronously through the WebKit Promise reply.

## Reproducible build and test

Xcode 15.2 is the newest stable Xcode for the physical Ventura host.

```bash
cd macos/ApolloReception
xcodebuild \
  -project ApolloReception.xcodeproj \
  -scheme ApolloReception \
  -configuration Debug \
  -destination 'platform=macOS,arch=x86_64' \
  CODE_SIGNING_ALLOWED=NO \
  build

xcodebuild \
  -project ApolloReception.xcodeproj \
  -scheme ApolloReception \
  -configuration Debug \
  -destination 'platform=macOS,arch=x86_64' \
  CODE_SIGNING_ALLOWED=NO \
  test
```

`project.yml` is the reproducible XcodeGen source and the generated Xcode project is committed so `xcodebuild` does not require XcodeGen. Regeneration requires XcodeGen 2.38.0 or newer; 2.38.0 was compiled locally from its upstream tag because the current Homebrew formula requires Xcode 15.3, which cannot run on Ventura.

## Physical Mac evidence and limits

The unsigned Debug app was launched directly on the physical Intel iMac against the synthetic loopback harness. The server observed:

```text
WKWebView loaded /recepcion
WKWebView bridge roundtrip: pass
WKWebView loaded /recepcion/settings
WKWebView bridge roundtrip: pass
```

An additional XCTest creates a real WKWebView, runs JavaScript, awaits the WebKit Promise reply, and verifies `requestId` plus the ping result. Screen capture was attempted, but macOS denied Terminal screen-recording access, so no screenshot is claimed.

The synthetic harness contains no PHI, credentials, tokens, or production data. It proves the native window, WKWebView, internal route navigation, and bridge channel; it does not prove the Apollo frontend, OIDC, production networking, signing, Apple Silicon, or hardware.
