# Apollo Reception for macOS

Apollo Reception keeps the existing Apollo React `/recepcion` UI and adds a narrow, versioned desktop bridge for device capabilities. It does not rewrite Reception in Swift.

**Current status: macOS Native Shell Phase.** The portable Linux foundation remains intact, and a real SwiftUI/AppKit `ApolloReception.app` now embeds WKWebView plus the minimum Bridge Protocol v1 implementation. No patient or production data belongs in this public repository.

## Architecture

```text
Apollo React /recepcion
        │
ReceiptPrintingService / CashDrawerService
        │
ApolloDesktopBridge
   ├── BrowserAdapter
   ├── MockDesktopAdapter (Linux development only)
   └── Mac WKWebView transport
                │
        Swift + WKWebView bridge shell
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
- `@apollo/bridge-client`: correlated client, timeout/cancellation handling, and BrowserAdapter.
- `@apollo/receipt-core`: structured tickets, safe decimal money, text preview, and escaped HTML preview.
- `@apollo/hardware-mock`: deterministic Linux device adapter and validated in-process transport.
- `@apollo/react-integration`: centralized printing/drawer services and fail-closed mode selection.

See [Apollo integration](docs/apollo-integration.md) for the adoption boundary. The package dependency should be pinned to a reviewed tag or commit; do not copy source into Apollo or make the web build depend on macOS.

## Native macOS shell

The real Xcode project, configuration model, navigation/origin policies, Swift bridge, tests, and CLI build commands live under `macos/ApolloReception`. See [macOS native shell](docs/macos-native-shell.md).

Only bridge introspection is enabled. Printing, printer status, drawer control, and device settings remain unavailable and are reported as such.

## Explicitly not validated

This phase does **not** claim a working Apollo production login/OIDC flow, AppKit printing, printer vendor SDK, ESC/POS transport, physical drawer control, Apple Silicon run, Apple signing, notarization, or DMG. Those require the missing deployment configuration, accounts, distribution decisions, and real target hardware described in [macOS handoff](docs/macos-handoff.md).
