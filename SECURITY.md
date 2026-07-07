# Security policy

Do not commit patient data, DICOM files, production identifiers, credentials, private URLs, database copies, private keys, certificates, or real Apollo environment files.

Report security issues privately to the repository owner. Do not disclose vulnerabilities in a public issue until a coordinated fix is available.

The desktop bridge must expose only versioned, allowlisted commands with strict runtime validation. Arbitrary shell, filesystem, USB, serial, and raw printer commands are out of scope by design. Authorization grants, tokens, full receipt payloads, and patient fields must never be written to device logs.

The Linux mock grant verifier is test infrastructure, not a production authorization issuer. Production drawer access requires a short-lived, one-time backend grant bound to actor, action, reason, cash session, device, and expiry.
