# macOS handoff

## Reuse from the Linux phase

- Protocol and receipt JSON Schemas.
- TypeScript client, browser fallback, capability model, and React-facing services.
- Receipt types and renderers for preview/reference behavior.
- Mock adapter, contract corpus, deterministic errors, idempotency tests, and synthetic fixtures.
- Security, origin, navigation, logging, and grant requirements.

## Mac Phase checklist

- [ ] Select supported macOS deployment target from product/device requirements.
- [ ] Acquire representative Intel/Apple Silicon Mac hardware as applicable.
- [ ] Install a supported Xcode and Apple SDK.
- [ ] Generate a real Xcode project through Xcode; do not handcraft a fake project.
- [ ] Build the minimal Swift/AppKit or SwiftUI shell containing WKWebView.
- [ ] Generate or mechanically verify Codable protocol models from JSON Schema.
- [ ] Implement `apolloBridge` message handler and correlated async response channel.
- [ ] Enforce configured Apollo HTTPS origin, minimum OIDC origins, frame policy, route policy, and external-link behavior.
- [ ] Test OIDC login, refresh, logout, reauthentication, cookies, redirects, and failure recovery inside WKWebView.
- [ ] Select supported printer models, widths, connection modes, and driver/vendor SDK strategy.
- [ ] Decide AppKit printing versus vendor SDK per selected hardware.
- [ ] Select drawer connection topology (usually printer-driven) and supported hardware.
- [ ] Implement native printer/drawer status and device settings adapters.
- [ ] Implement and verify backend one-time hardware grants before enabling drawer actions.
- [ ] Test offline, out-of-paper, cover-open, busy, cancellation, duplicate jobs, and recovery on real devices.
- [ ] Test actual 58 mm and 80 mm output, fonts, wrapping, logos, QR, copies, and cutting behavior.
- [ ] Configure bundle identifier, entitlements, hardened runtime, sandbox decisions, and least privilege.
- [ ] Configure Apple Developer signing identities and provisioning as required.
- [ ] Archive, sign, notarize, staple, and validate the distribution artifact.
- [ ] Define update, rollback, telemetry-redaction, and support procedures.

Mac completion requires evidence from Xcode builds and real hardware. Linux CI must remain as the portable contract gate; add real macOS CI only when a genuine project and runner strategy exist.
