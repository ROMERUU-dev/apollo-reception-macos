# Apollo Reception for macOS

Apollo Reception keeps the existing Apollo React `/recepcion` UI and adds a narrow, versioned desktop bridge for device capabilities. It does not rewrite Reception in Swift.

**Current status: Linux Foundation Phase.** The bridge protocol and client, browser and Linux mock adapters, receipt model/renderers, hardware simulator, React-facing services, tests, and Linux CI are implemented portably. No patient or production data belongs in this public repository.

## Architecture

```text
Apollo React /recepcion
        │
ReceiptPrintingService / CashDrawerService
        │
ApolloDesktopBridge
   ├── BrowserAdapter
   ├── MockDesktopAdapter (Linux development only)
   └── future MacDesktopAdapter
                │
        Swift + WKWebView + native device adapters
```

The web page can send only ten strict commands. There is no arbitrary shell, filesystem, USB, serial, or raw printer-byte API.

## Run on Linux

Node 22.12 or newer and npm 10 or newer are required.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run simulator
```

For a non-interactive demonstration of all required states:

```bash
npm run simulator:demo
```

The browser simulator supports ready/offline/out-of-paper/busy printer states, available/unavailable/open/closed drawer states, redacted event logs, authorized and rejected mock actions, and 58/80 mm conceptual previews. It does not access physical devices.

## Packages

- `@apollo/bridge-contract`: protocol types, JSON Schema runtime validation, size limits, and deterministic envelopes.
- `@apollo/bridge-client`: correlated client, timeout/cancellation handling, BrowserAdapter, and the `apolloBridge` WKWebView transport (JavaScript half of the native channel).
- `@apollo/receipt-core`: structured tickets, safe decimal money, text preview, and escaped HTML preview.
- `@apollo/hardware-mock`: deterministic Linux device adapter and validated in-process transport.
- `@apollo/react-integration`: the Apollo composition root (`composeDesktopPlatform`), centralized printing/drawer services, and fail-closed mode selection.
- `@apollo/webview-policy`: portable WKWebView origin/navigation/route/external-link policy as reviewable, tested configuration.
- `@apollo/swift-models`: generates Swift Codable models from the JSON Schemas (`npm run generate:swift`, drift-checked by `npm run check:swift`).

See [Apollo integration](docs/apollo-integration.md) for the adoption boundary. The package dependency should be pinned to a reviewed tag or commit; do not copy source into Apollo or make the web build depend on macOS.

## Explicitly not validated

This repository does **not** currently contain or claim a working macOS app, Xcode project, WKWebView handler, AppKit printing, printer vendor SDK, ESC/POS transport, physical drawer control, Apple signing, notarization, `.app`, or DMG. Those require the Mac Phase and real target hardware described in [macOS handoff](docs/macos-handoff.md).
