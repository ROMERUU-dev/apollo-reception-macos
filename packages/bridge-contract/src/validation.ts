import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import bridgeSchema from '../../../protocol/bridge-v1.schema.json' with { type: 'json' };
import receiptSchema from '../../../protocol/receipt-v1.schema.json' with { type: 'json' };
import {
  BRIDGE_COMMANDS,
  MAX_BRIDGE_PAYLOAD_BYTES,
  type BridgeCommand,
  type BridgeErrorCode,
  type BridgeRequest,
  type BridgeResponse,
  type BridgeResultMap,
} from './types.js';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(receiptSchema);
ajv.addSchema(bridgeSchema);

const requestValidator = ajv.compile({ $ref: `${bridgeSchema.$id}#/definitions/requests` });
const responseValidator = ajv.compile({ $ref: `${bridgeSchema.$id}#/definitions/responseEnvelope` });
const resultValidators = Object.fromEntries(BRIDGE_COMMANDS.map((command) => [
  command,
  ajv.compile({ $ref: `${bridgeSchema.$id}#/definitions/results/${command}` }),
])) as Record<BridgeCommand, ValidateFunction>;

export class ContractValidationError extends Error {
  constructor(public readonly code: BridgeErrorCode, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'ContractValidationError';
  }
}

function errorSummary(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? []).slice(0, 4).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`).join('; ');
}

export function serializedSize(value: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
  catch { throw new ContractValidationError('INVALID_REQUEST', 'Bridge message must be JSON serializable.'); }
}

export function validateBridgeRequest(value: unknown): BridgeRequest {
  const size = serializedSize(value);
  if (size > MAX_BRIDGE_PAYLOAD_BYTES) throw new ContractValidationError('PAYLOAD_TOO_LARGE', `Bridge message exceeds ${MAX_BRIDGE_PAYLOAD_BYTES} bytes.`);
  if (!value || typeof value !== 'object') throw new ContractValidationError('INVALID_REQUEST', 'Bridge request must be an object.');
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) throw new ContractValidationError('UNSUPPORTED_VERSION', 'Only bridge protocol version 1 is supported.');
  if (typeof candidate.command !== 'string' || !BRIDGE_COMMANDS.includes(candidate.command as BridgeCommand)) {
    throw new ContractValidationError('UNKNOWN_COMMAND', 'Command is not in the bridge v1 allowlist.');
  }
  if (!requestValidator(value)) throw new ContractValidationError('INVALID_REQUEST', `Invalid ${candidate.command} request: ${errorSummary(requestValidator.errors)}`);
  return value as BridgeRequest;
}

export function validateBridgeResponse(value: unknown): BridgeResponse {
  if (serializedSize(value) > MAX_BRIDGE_PAYLOAD_BYTES) throw new ContractValidationError('PAYLOAD_TOO_LARGE', `Bridge response exceeds ${MAX_BRIDGE_PAYLOAD_BYTES} bytes.`);
  if (!responseValidator(value)) throw new ContractValidationError('INVALID_REQUEST', `Invalid bridge response: ${errorSummary(responseValidator.errors)}`);
  return value as BridgeResponse;
}

export function validateCommandResult<C extends BridgeCommand>(command: C, value: unknown): BridgeResultMap[C] {
  const validator = resultValidators[command];
  if (!validator(value)) throw new ContractValidationError('INVALID_REQUEST', `Invalid ${command} result: ${errorSummary(validator.errors)}`);
  return value as BridgeResultMap[C];
}
