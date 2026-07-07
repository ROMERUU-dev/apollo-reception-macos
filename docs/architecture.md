# Architecture

Apollo Reception is a hybrid application: the existing React route remains the only primary UI, while a future macOS shell owns a WKWebView and allowlisted native device adapters. React depends only on `ApolloDesktopBridge`, never AppKit or vendor SDKs.

The portable layers are:

1. JSON Schema protocol v1 and TypeScript contract.
2. A correlated client with validation, timeout, cancellation, and deterministic errors.
3. Browser and Linux mock adapters.
4. Structured Receipt Core and safe previews.
5. Central printing and drawer services for Apollo React.

The future native flow is:

```text
React
  → window.webkit.messageHandlers.apolloBridge.postMessage(request)
  → Swift decodes BridgeRequest
  → schema-equivalent strict validation and command allowlist
  → one native adapter method
  → BridgeResponse correlated by requestId
  → React promise resolution
```

This flow is an implementation plan, not a Linux validation of WKWebView or Swift.

## Boundaries

- Receipt documents are structured data, never arbitrary HTML or ESC/POS.
- The client negotiates capabilities; hardware is never assumed.
- Browser remains functional and reports drawer/status limitations honestly.
- Mock mode is selected explicitly and is rejected outside development.
- A print job has its own idempotency key (`printJobId`). A drawer action has `actionId` plus a backend grant.
- Simulator logs retain command, correlation identifier, result, error code, and timestamp only.

Swift portable models were deferred because Swift is absent on the Linux host and hand-maintained duplicate models would drift. Mac Phase should generate or mechanically verify Codable models from the versioned schema.
