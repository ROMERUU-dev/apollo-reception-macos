import type { BridgeErrorBody, BridgeErrorCode } from '@apollo/bridge-contract';

export class DesktopBridgeError extends Error {
  constructor(public readonly code: BridgeErrorCode, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'DesktopBridgeError';
  }
}

export class UnsupportedCapabilityError extends DesktopBridgeError {
  constructor(capability: string) {
    super('UNSUPPORTED_CAPABILITY', `Desktop capability is unavailable: ${capability}.`, { capability });
    this.name = 'UnsupportedCapabilityError';
  }
}

export class BridgeRemoteError extends DesktopBridgeError {
  constructor(error: BridgeErrorBody) {
    super(error.code, error.message, error.details);
    this.name = 'BridgeRemoteError';
  }
}
