# Hardware model

## Printer

States: `ready`, `offline`, `out_of_paper`, `cover_open`, `busy`, `error`, and `unavailable`. A print accepts a validated receipt document, `printJobId`, printer selection, copies (1–5), and 58/80 mm width. Duplicate `printJobId` returns the original mock result and does not create another job.

## Cash drawer

States: `available`, `unavailable`, `open`, `closed`, and `unknown`. An open action requires:

```json
{
  "actionId": "uuid",
  "authorizationGrant": "opaque-short-lived-grant",
  "reasonCode": "cash_payment"
}
```

Duplicate `actionId` is idempotent in the mock. The mock verifier only exercises policy behavior and does not mint production grants.

## Future backend grant

Apollo currently has a receptionist role and fresh cash-access session, but no hardware-action grant endpoint. Add a future `POST /hardware-actions/drawer-open` that validates actor, role, fresh reauthentication/PIN policy, open cash session, reason, and related payment/movement. It should issue a signed or server-verifiable one-time grant with a very short expiry, device audience, action id, reason, actor, and cash-session binding. Consumption must be audited and replay rejected.

The current cash-access cookie cannot be passed to native code as a substitute: it is HTTP-only, broader than one action, and not device-bound.
