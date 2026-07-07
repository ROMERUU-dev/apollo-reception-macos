# Bridge v1 command registry

The authoritative request, response-envelope, payload, and result schemas are in `../bridge-v1.schema.json`. The allowlist contains exactly ten commands: `bridge.getVersion`, `bridge.getCapabilities`, `bridge.ping`, `printer.list`, `printer.status`, `printer.printTest`, `printer.printJob`, `drawer.status`, `drawer.open`, and `device.getProfile`.

No extension command or arbitrary host-operation escape hatch is supported.
