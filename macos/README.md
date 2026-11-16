# Native macOS layer — pending

This directory still contains no `.xcodeproj`, Swift shell, WKWebView, AppKit
printer implementation, device SDK, signing asset, or package artifact. None of
those has been built or validated from Linux.

What is present is portable scaffolding generated or hand-written without a Mac:

- `Generated/ApolloBridgeModels.swift` — Codable models generated from
  `protocol/*.schema.json` by `@apollo/swift-models`. Do not edit by hand;
  regenerate with `npm run generate:swift` and verify with `npm run check:swift`.
- `Support/JSONValue.swift` — hand-written helper backing `BridgeError.details`.

Mac Phase will add the genuine Xcode-generated project, the Swift `apolloBridge`
message handler and correlated response channel, the strict origin/navigation
policy, and native printer/drawer/device adapters. See
[macOS handoff](../docs/macos-handoff.md) for the exact steps and for the
portable TypeScript scaffolding (composition root, WKWebView transport, and
navigation policy) the shell should consume.
