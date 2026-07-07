# Security policy

Do not commit patient data, DICOM files, production identifiers, credentials, private URLs, database copies, private keys, certificates, or real Apollo environment files.

Report security issues privately to the repository owner. Do not disclose vulnerabilities in a public issue until a coordinated fix is available.

The desktop bridge must expose only versioned, allowlisted commands with strict runtime validation. Arbitrary shell, filesystem, USB, serial, and raw printer commands are out of scope by design.
