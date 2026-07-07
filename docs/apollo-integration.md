# Apollo React integration

The audited Apollo frontend uses npm, React 19, Vite, and Node 22. Reception is `/recepcion`; `CashModule` centralizes cash UI. Existing ticket settings cover facility text, display flags, and 58/80/letter width. Its only print action is `window.print()` on a synthetic preview. There is no drawer action or device-status UI.

The backend already provides receptionist authorization plus short-lived Cash access, and models `CashSession`, `Payment`, `CashMovement`, `Charge`, `Adjustment`, and ticket settings with Decimal fields. Payment creates cash movements for cash received and MXN change. Cash/payment mutations currently lack idempotency; no hardware-action grant exists. Those gaps must be resolved before production drawer control.

## Adoption strategy

Do not copy package source. After this repository is reviewed, pin a tag or full commit as an npm Git dependency (or publish the packages to a controlled registry). Keep desktop packages optional to the web build.

Create a single Apollo composition module, conceptually `src/platform/desktop/index.ts`, which:

1. selects BrowserAdapter by default;
2. selects MockDesktopAdapter only when `import.meta.env.DEV` and `VITE_APOLLO_DESKTOP_MODE === "mock"`;
3. later detects/constructs MacDesktopAdapter only after a validated WKWebView handshake;
4. exports one `ReceiptPrintingService`, one `CashDrawerService`, and capability state.

`CashModule` should call service methods after a successful backend transaction. It must not call bridge commands directly. Browser printing should continue through an explicit `window.print` fallback. Browser drawer UI stays unavailable. Device status can later fit under Reception → Configuración without redesigning Reception.

No Apollo files were changed in this phase: the relevant backend worktree had unrelated local changes, while the clean frontend branch is part of an active stacked F2 Draft PR. Injecting an unpublished desktop dependency there would mix concerns and destabilize the existing review chain.
