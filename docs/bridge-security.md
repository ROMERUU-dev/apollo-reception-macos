# Bridge security

## Enforced in the Linux foundation

- Protocol version is exactly `1`; request and response shapes reject extra properties.
- Commands use a fixed ten-command allowlist.
- Payloads and results receive runtime JSON Schema validation.
- Messages larger than 256 KiB are rejected before dispatch.
- Every request uses a UUID `requestId`; mismatched response correlation is rejected.
- Client calls have deterministic timeout and cancellation behavior.
- Receipt HTML escapes every data field.
- Browser adapter reports unavailable capabilities rather than simulating hardware.
- Mock logs omit receipt content, authorization grants, tokens, and patient fields.
- Print input is a validated `ReceiptDocument`; raw bytes are prohibited.

Explicitly prohibited: `shell.execute`, `system.command`, arbitrary file reads/writes, `usb.raw`, `serial.raw`, arbitrary ESC/POS, and `printer.rawBytes` from JavaScript.

## Required in Mac Phase

The origin, navigation, route, and external-link rules below are encoded
portably as reviewable, tested configuration in `@apollo/webview-policy`
(`defineWebViewPolicy`, `evaluateNavigation`, `isAllowedMessageOrigin`). The
Swift shell must mirror those decisions; the real origin is configured at
runtime and never committed.

- Allow only the configured Apollo HTTPS origin and the minimum explicitly enumerated OIDC origins.
- Allow controlled Apollo routes; do not load arbitrary sites.
- Block arbitrary navigation. Open approved external links outside WKWebView under a documented policy.
- Reject messages from disallowed frames/origins before decoding.
- Apply per-command rate limits and a global in-flight request limit.
- Enforce the same payload limit and schema semantics in Swift.
- Redact tokens, grants, patient data, receipt content, and credentials from Unified Logging and crash reports.
- Store local device settings in an appropriate protected store; never expose arbitrary filesystem access.
- Bind sensitive grants to device/action/actor/session/expiry and enforce one-time use.

Capability negotiation is not authorization. In particular, `cashDrawer: true` only says an adapter exists; it does not permit `drawer.open`.
