# ADR 0001: macOS 13 deployment target

- Status: accepted for the Native Shell phase
- Date: 2026-07-09

## Context

The first physical validation host is an Intel `iMac18,3` with 8 GB RAM running macOS 13.7.6. Xcode 15.2 is the newest stable Xcode supported by this operating system. The shell needs SwiftUI, AppKit interoperability, persistent WKWebView storage, and `WKScriptMessageHandlerWithReply`; the newest required WebKit API is available before macOS 13.

No broader clinic hardware inventory or OS support requirement was available during this phase. This host cannot be treated as evidence for Apple Silicon or another clinic Mac.

## Decision

Set `MACOSX_DEPLOYMENT_TARGET` to `13.0`.

This keeps the actual validation host inside the supported product range, avoids claiming support for untested older macOS releases, and allows the controlled JavaScript Promise reply channel without compatibility shims. Local HTTP is allowed only for loopback development; deployed environments require HTTPS.

## Consequences

- The project builds and runs on the physical Intel Ventura host used in this phase.
- Apple Silicon remains a compile/CI and physical-device validation gap.
- Ventura and Homebrew are already outside their normal support tiers in 2026. Clinic deployment needs an OS/hardware lifecycle decision before production rollout.
- Revisit the target after the clinic Mac inventory, security-update policy, and distribution plan are known. Raising it will exclude this iMac; lowering it requires a new compatibility test matrix.
