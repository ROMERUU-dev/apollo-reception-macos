# Native macOS layer

`ApolloReception/` contains the real SwiftUI/AppKit/WebKit application and its Xcode project. The product is `ApolloReception.app`; it embeds the existing Apollo `/recepcion` web route in a persistent `WKWebView` and exposes the narrow Bridge Protocol v1 handler.

This phase implements only `bridge.ping`, `bridge.getVersion`, and `bridge.getCapabilities`. Printing, printer status, cash drawer, and device settings all report unavailable. There is no printer SDK, ESC/POS library, raw USB/serial API, signing configuration, notarization, or installer.

See [macOS native shell](../docs/macos-native-shell.md) for configuration, build, test, and validation boundaries.
