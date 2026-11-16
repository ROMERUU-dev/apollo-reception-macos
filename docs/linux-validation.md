# Linux validation

Validation target: Ubuntu Linux only.

The required local commands are:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run simulator:demo
git diff --check
```

The demo covers printer ready, out of paper, print success/failure, drawer unavailable, authorized mock drawer action, and both receipt widths. Test fixtures are synthetic. Simulator event logs intentionally exclude clinical payloads.

Passing this validation demonstrates portable TypeScript and browser simulator behavior. It does not validate a macOS application, Swift, WKWebView, AppKit, vendor drivers, physical printing, or a physical drawer.
