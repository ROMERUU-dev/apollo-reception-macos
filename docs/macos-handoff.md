# macOS handoff

This is the actionable plan for opening the project on a real Mac with Xcode.
Everything that can be built portably from Linux is already in the repository;
the remaining work needs macOS, Xcode, Apple signing, and real devices and is
intentionally **not** faked here.

## Reuse from the Linux phase

- Protocol and receipt JSON Schemas (`protocol/*.schema.json`).
- TypeScript client, browser fallback, capability model, and React-facing services.
- Receipt types and renderers for preview/reference behavior.
- Mock adapter, contract corpus, deterministic errors, idempotency tests, and synthetic fixtures.
- Security, origin, navigation, logging, and grant requirements.

## Portable scaffolding already in the repo

These pieces were buildable without a Mac and are covered by Linux CI. Consume
them in the Mac Phase instead of re-deriving the contract.

1. **Apollo composition root** — `packages/react-integration/src/platform/desktop.ts`
   (`composeDesktopPlatform`). This is the single module Apollo adopts as
   `src/platform/desktop`. It selects the browser adapter by default, the mock
   adapter only in development with `VITE_APOLLO_DESKTOP_MODE=mock`, and the
   native macOS adapter only after a validated WKWebView handshake, then exports
   one `ReceiptPrintingService`, one `CashDrawerService`, and capability state.
   The native and mock paths are injected, so `@apollo/hardware-mock` and native
   code stay out of the web bundle.

2. **`apolloBridge` channel, JavaScript half** — `packages/bridge-client/src/webkit-transport.ts`.
   - Posts requests to `window.webkit.messageHandlers.apolloBridge.postMessage(request)`.
   - Installs `window.__APOLLO_DESKTOP_BRIDGE__.deliver(response)` as the async,
     `requestId`-correlated response channel. Uncorrelated or late replies are
     dropped; the client still enforces timeout, cancellation, and correlation.
   - `createMacDesktopBridge()` builds the client over this transport;
     `handshakeMacDesktopBridge()` is the validated handshake (protocol + version)
     that must succeed before native actions are trusted.
   - Contract tests (no WKWebView needed): `packages/bridge-client/src/webkit-transport.test.ts`.
   The Swift shell must mirror this exact channel: decode `BridgeRequest`,
   validate, dispatch one adapter method, and call `deliver` with a
   `BridgeResponse` carrying the same `requestId`.

3. **WKWebView navigation/origin policy** — `packages/webview-policy/src/policy.ts`
   (`defineWebViewPolicy`, `evaluateNavigation`, `isAllowedMessageOrigin`).
   This encodes the Mac-phase rules as reviewable, tested data: allow only the
   configured HTTPS app origin plus enumerated OIDC origins, allow only
   controlled route prefixes, block everything else, and route external links
   out. Mirror these decisions in `WKNavigationDelegate` and the message-handler
   origin/frame check. The example policy (`example.ts`) uses placeholder
   `.example` origins only — the real origin is configured at runtime on the Mac.

4. **Generated Swift Codable models** — `macos/Generated/ApolloBridgeModels.swift`,
   produced by `@apollo/swift-models` from the JSON Schemas.
   - Regenerate: `npm run generate:swift`. Verify in CI: `npm run check:swift`
     (also asserted by `packages/swift-models/src/generate.test.ts`).
   - The generator reads enum vocabularies from the schema and verifies every
     struct's property and required sets against the schema before emitting, so
     the models cannot silently drift from the protocol.
   - Free-form `BridgeError.details` uses the hand-written
     `macos/Support/JSONValue.swift`. Command/response dispatch is intentionally
     hand-written in the shell, not generated.

## Mac Phase checklist

Nothing below has been built or validated from Linux.

### M0 — Environment and project
- [ ] Select the supported macOS deployment target from product/device requirements.
- [ ] Acquire representative Intel/Apple Silicon Mac hardware as applicable.
- [ ] Install a supported Xcode and Apple SDK.
- [ ] Generate a real Xcode project through Xcode; do not handcraft a fake project.
- [ ] Add `macos/Generated/ApolloBridgeModels.swift` and `macos/Support/JSONValue.swift` to the target; wire `npm run check:swift` into the project's pre-build or CI so schema drift fails the build.

### M1 — Shell, WKWebView, and the bridge channel
- [ ] Build the minimal Swift/AppKit or SwiftUI shell containing a `WKWebView`.
- [ ] Register the `apolloBridge` `WKScriptMessageHandler` and decode `BridgeRequestEnvelope` using the generated models.
- [ ] Re-enforce the schema semantics in Swift: protocol version `1`, the fixed ten-command allowlist, strict payload validation, and the 256 KiB message limit.
- [ ] Return responses by evaluating `window.__APOLLO_DESKTOP_BRIDGE__.deliver(<BridgeResponse>)`, correlated by `requestId`, matching the JavaScript transport contract.
- [ ] Apply per-command rate limits and a global in-flight request cap.
- [ ] Confirm `composeDesktopPlatform` selects the native adapter only after `handshakeMacDesktopBridge` succeeds, and falls back to the browser adapter otherwise.

### M2 — Security and session
- [ ] Load the runtime-configured Apollo HTTPS origin and the minimum enumerated OIDC origins into a `WebViewPolicy`; keep real origins out of the repo.
- [ ] Enforce `evaluateNavigation` decisions in `WKNavigationDelegate`: allow controlled routes, block arbitrary navigation, open approved external links outside the WebView.
- [ ] Reject bridge messages from disallowed frames/origins before decoding (`isAllowedMessageOrigin`: app origin, main frame only).
- [ ] Test OIDC login, refresh, logout, reauthentication, cookies, redirects, and failure recovery inside the WebView.
- [ ] Redact tokens, grants, patient data, receipt content, and credentials from Unified Logging and crash reports.
- [ ] Store local device settings in an appropriate protected store; never expose arbitrary filesystem access.
- [ ] Implement and verify backend one-time hardware grants (`drawer.open`) bound to actor/action/reason/cash-session/device/expiry, with one-time use and replay rejection, before enabling drawer actions.

### M3 — Printer and cash drawer hardware
- [ ] Select supported printer models, widths, connection modes, and driver/vendor SDK strategy.
- [ ] Decide AppKit printing versus vendor SDK per selected hardware.
- [ ] Select the drawer connection topology (usually printer-driven) and supported hardware.
- [ ] Implement native printer/drawer status and device-settings adapters behind the ten allowlisted commands only.
- [ ] Test offline, out-of-paper, cover-open, busy, cancellation, duplicate jobs, and recovery on real devices.
- [ ] Test actual 58 mm and 80 mm output: fonts, wrapping, logos, QR, copies, and cutting behavior.

### M4 — Packaging and distribution
- [ ] Configure bundle identifier, entitlements, hardened runtime, sandbox decisions, and least privilege.
- [ ] Configure Apple Developer signing identities and provisioning as required.
- [ ] Archive, sign, notarize, staple, and validate the distribution artifact.

### M5 — Operations
- [ ] Define update, rollback, telemetry-redaction, and support procedures.
- [ ] Add real macOS CI (Xcode build + unit tests) only when a genuine project and runner strategy exist. Keep Linux CI as the portable contract gate, including `npm run check:swift`.

## Definition of done

Mac completion requires evidence from Xcode builds and real hardware: a signed,
notarized artifact; green macOS CI alongside Linux CI; and recorded device tests
for every printer and drawer state above. Capability negotiation is not
authorization — `cashDrawer: true` only says an adapter exists; `drawer.open`
still requires a validated backend grant.
