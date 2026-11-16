import bridgeSchema from '../../../protocol/bridge-v1.schema.json' with { type: 'json' };
import receiptSchema from '../../../protocol/receipt-v1.schema.json' with { type: 'json' };

/**
 * Deterministic JSON Schema -> Swift Codable generator for the Apollo desktop
 * bridge protocol v1 and receipt document v1.
 *
 * The generator reads enum vocabularies straight from the schema and verifies
 * every struct's property set and required set against the schema before
 * emitting. If the schema and the model drift apart the generator throws, so
 * the committed Swift models are mechanically kept in sync with the protocol.
 * It emits plain `Codable` value types only — no device, I/O, or dispatch logic.
 */

export const GENERATED_SWIFT_FILENAME = 'ApolloBridgeModels.swift';

type Json = unknown;

function getAt(root: Json, path: ReadonlyArray<string | number>): Json {
  let node: Json = root;
  for (const key of path) {
    if (node === null || typeof node !== 'object') {
      throw new Error(`Schema path broke before "${String(key)}" in ${JSON.stringify(path)}.`);
    }
    node = (node as Record<string, Json>)[String(key)];
    if (node === undefined) throw new Error(`Schema path missing "${String(key)}" in ${JSON.stringify(path)}.`);
  }
  return node;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function assertSameSet(actual: readonly string[], expected: readonly string[], label: string): void {
  const a = sortedUnique(actual);
  const e = sortedUnique(expected);
  if (a.length !== e.length || a.some((value, index) => value !== e[index])) {
    throw new Error(`Schema drift in ${label}: expected [${e.join(', ')}] but schema has [${a.join(', ')}].`);
  }
}

function readEnumValues(root: Json, path: ReadonlyArray<string | number>): string[] {
  const node = getAt(root, path) as { enum?: unknown };
  if (!Array.isArray(node.enum) || !node.enum.every((value) => typeof value === 'string')) {
    throw new Error(`Expected a string enum at ${JSON.stringify(path)}.`);
  }
  return node.enum as string[];
}

function readConst(root: Json, path: ReadonlyArray<string | number>): Json {
  const node = getAt(root, path) as { const?: Json };
  if (!('const' in node)) throw new Error(`Expected a const at ${JSON.stringify(path)}.`);
  return node.const;
}

/** Resolves a named definition, following any local `#/definitions/...` `$ref` chain. */
function resolveLocalDefinition(root: Json, defName: string): Json {
  let node: Json = getAt(root, ['definitions', defName]);
  for (let depth = 0; depth < 10; depth += 1) {
    const ref = (node as { $ref?: unknown } | null)?.$ref;
    if (typeof ref !== 'string' || !ref.startsWith('#/definitions/')) return node;
    node = getAt(root, ['definitions', ref.slice('#/definitions/'.length)]);
  }
  throw new Error(`"$ref" chain for definition "${defName}" is too deep.`);
}

function verifyObjectShape(
  root: Json,
  path: ReadonlyArray<string | number>,
  fields: readonly Field[],
): void {
  const node = getAt(root, path) as { properties?: Record<string, unknown>; required?: unknown };
  const properties = node.properties ? Object.keys(node.properties) : [];
  assertSameSet(properties, fields.map((field) => field.json), `properties at ${JSON.stringify(path)}`);
  const required = Array.isArray(node.required) ? (node.required as string[]) : [];
  assertSameSet(required, fields.filter((field) => field.required).map((field) => field.json), `required at ${JSON.stringify(path)}`);
}

// --- Swift formatting -------------------------------------------------------

function upperFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function lowerFirst(value: string): string {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function swiftCaseName(raw: string): string {
  const tokens = raw
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => (/^[A-Z0-9]+$/.test(token) ? token.toLowerCase() : token));
  let name = tokens.map((token, index) => (index === 0 ? lowerFirst(token) : upperFirst(token))).join('');
  if (/^[0-9]/.test(name)) name = `_${name}`;
  return name;
}

function emitEnum(name: string, values: readonly string[]): string {
  const cases = values
    .map((value) => {
      const caseName = swiftCaseName(value);
      return caseName === value ? `    case ${caseName}` : `    case ${caseName} = ${JSON.stringify(value)}`;
    })
    .join('\n');
  return `public enum ${name}: String, Codable, Sendable {\n${cases}\n}`;
}

interface Field {
  json: string;
  type: string;
  required: boolean;
}

function field(json: string, type: string, required: boolean): Field {
  return { json, type, required };
}

function emitStruct(name: string, fields: readonly Field[]): string {
  if (fields.length === 0) {
    return `public struct ${name}: Codable, Sendable {\n    public init() {}\n}`;
  }
  const properties = fields.map((f) => `    public let ${f.json}: ${f.required ? f.type : `${f.type}?`}`).join('\n');
  const initParams = fields.map((f) => (f.required ? `${f.json}: ${f.type}` : `${f.json}: ${f.type}? = nil`)).join(', ');
  const assignments = fields.map((f) => `        self.${f.json} = ${f.json}`).join('\n');
  return `public struct ${name}: Codable, Sendable {\n${properties}\n\n    public init(${initParams}) {\n${assignments}\n    }\n}`;
}

function struct(root: Json, name: string, path: ReadonlyArray<string | number>, fields: readonly Field[]): string {
  verifyObjectShape(root, path, fields);
  return emitStruct(name, fields);
}

// --- Generation -------------------------------------------------------------

export function generateSwiftModels(): Record<string, string> {
  const bridge: Json = bridgeSchema;
  const receipt: Json = receiptSchema;

  const protocolName = readConst(bridge, ['definitions', 'results', 'bridge.getVersion', 'properties', 'protocol']);
  const bridgeVersion = readConst(bridge, ['definitions', 'results', 'bridge.getVersion', 'properties', 'bridgeVersion']);
  if (typeof protocolName !== 'string' || typeof bridgeVersion !== 'number') {
    throw new Error('Unexpected protocol identity consts in the bridge schema.');
  }

  const commandValues = (getAt(bridge, ['definitions', 'requests', 'oneOf']) as Array<{ $ref?: string }>).map((entry) => {
    if (typeof entry.$ref !== 'string' || !entry.$ref.startsWith('#/definitions/')) throw new Error('Unexpected request $ref in bridge schema.');
    const defName = entry.$ref.slice('#/definitions/'.length);
    const resolved = resolveLocalDefinition(bridge, defName);
    const value = readConst(resolved, ['properties', 'command']);
    if (typeof value !== 'string') throw new Error(`Command const for ${defName} is not a string.`);
    return value;
  });

  const enums: string[] = [
    emitEnum('BridgeCommand', commandValues),
    emitEnum('BridgeErrorCode', readEnumValues(bridge, ['definitions', 'responseEnvelope', 'oneOf', 1, 'properties', 'error', 'properties', 'code'])),
    emitEnum('BridgePlatform', readEnumValues(bridge, ['definitions', 'capabilities', 'properties', 'platform'])),
    emitEnum('PrinterState', readEnumValues(bridge, ['definitions', 'printerStatus', 'properties', 'state'])),
    emitEnum('PrintJobStatus', readEnumValues(bridge, ['definitions', 'printJobResult', 'properties', 'status'])),
    emitEnum('DrawerState', readEnumValues(bridge, ['definitions', 'drawerStatus', 'properties', 'state'])),
    emitEnum('DrawerActionStatus', readEnumValues(bridge, ['definitions', 'drawerResult', 'properties', 'status'])),
    emitEnum('DrawerReasonCode', readEnumValues(bridge, ['definitions', 'drawerResult', 'properties', 'reasonCode'])),
    emitEnum('ReceiptWidth', readEnumValues(bridge, ['definitions', 'printOptions', 'properties', 'width'])),
    emitEnum('ReceiptKind', readEnumValues(receipt, ['properties', 'kind'])),
    emitEnum('AdjustmentType', readEnumValues(receipt, ['properties', 'adjustments', 'items', 'properties', 'type'])),
    emitEnum('PaymentMethod', readEnumValues(receipt, ['properties', 'payments', 'items', 'properties', 'method'])),
    emitEnum('Currency', readEnumValues(receipt, ['definitions', 'money', 'properties', 'currency'])),
  ];

  const receiptStructs: string[] = [
    struct(receipt, 'ReceiptMoney', ['definitions', 'money'], [
      field('currency', 'Currency', true),
      field('amount', 'String', true),
    ]),
    struct(receipt, 'ReceiptTextBlock', ['definitions', 'textBlock'], [
      field('lines', '[String]', true),
    ]),
    struct(receipt, 'ReceiptFacility', ['properties', 'facility'], [
      field('name', 'String', true),
      field('legalName', 'String', false),
      field('taxId', 'String', false),
      field('address', 'String', false),
      field('phone', 'String', false),
      field('logoReference', 'String', false),
    ]),
    struct(receipt, 'ReceiptCustomer', ['properties', 'customer'], [
      field('displayName', 'String', false),
      field('reference', 'String', false),
    ]),
    struct(receipt, 'ReceiptLine', ['properties', 'lines', 'items'], [
      field('code', 'String', false),
      field('description', 'String', true),
      field('quantity', 'String', true),
      field('unitAmount', 'ReceiptMoney', true),
      field('total', 'ReceiptMoney', true),
    ]),
    struct(receipt, 'ReceiptAdjustment', ['properties', 'adjustments', 'items'], [
      field('type', 'AdjustmentType', true),
      field('label', 'String', true),
      field('amount', 'ReceiptMoney', true),
      field('percentage', 'String', false),
    ]),
    struct(receipt, 'ReceiptPayment', ['properties', 'payments', 'items'], [
      field('method', 'PaymentMethod', true),
      field('label', 'String', false),
      field('amount', 'ReceiptMoney', true),
      field('exchangeRate', 'String', false),
    ]),
    struct(receipt, 'ReceiptDocument', [], [
      field('version', 'Int', true),
      field('kind', 'ReceiptKind', true),
      field('documentId', 'String', true),
      field('reference', 'String', false),
      field('issuedAt', 'String', true),
      field('header', 'ReceiptTextBlock', false),
      field('facility', 'ReceiptFacility', true),
      field('customer', 'ReceiptCustomer', false),
      field('lines', '[ReceiptLine]', true),
      field('subtotal', 'ReceiptMoney', true),
      field('adjustments', '[ReceiptAdjustment]', true),
      field('total', 'ReceiptMoney', true),
      field('payments', '[ReceiptPayment]', true),
      field('change', 'ReceiptMoney', false),
      field('footer', 'ReceiptTextBlock', false),
      field('qrReference', 'String', false),
    ]),
  ];

  const bridgeStructs: string[] = [
    struct(bridge, 'PrinterSelector', ['definitions', 'printerSelector'], [
      field('printerId', 'String', false),
    ]),
    struct(bridge, 'PrintOptions', ['definitions', 'printOptions'], [
      field('printerId', 'String', false),
      field('copies', 'Int', false),
      field('width', 'ReceiptWidth', false),
    ]),
    struct(bridge, 'BridgeCapabilityFlags', ['definitions', 'capabilities', 'properties', 'capabilities'], [
      field('printing', 'Bool', true),
      field('cashDrawer', 'Bool', true),
      field('printerStatus', 'Bool', true),
      field('deviceSettings', 'Bool', true),
    ]),
    struct(bridge, 'BridgeCapabilities', ['definitions', 'capabilities'], [
      field('bridgeVersion', 'Int', true),
      field('platform', 'BridgePlatform', true),
      field('capabilities', 'BridgeCapabilityFlags', true),
    ]),
    struct(bridge, 'PrinterInfo', ['definitions', 'printerInfo'], [
      field('id', 'String', true),
      field('name', 'String', true),
      field('isDefault', 'Bool', true),
      field('supportedWidths', '[ReceiptWidth]', true),
    ]),
    struct(bridge, 'PrinterStatus', ['definitions', 'printerStatus'], [
      field('printerId', 'String', true),
      field('state', 'PrinterState', true),
      field('message', 'String', false),
    ]),
    struct(bridge, 'PrintJobResult', ['definitions', 'printJobResult'], [
      field('printJobId', 'String', true),
      field('status', 'PrintJobStatus', true),
      field('acceptedAt', 'String', true),
      field('completedAt', 'String', false),
      field('errorCode', 'String', false),
    ]),
    struct(bridge, 'DrawerStatus', ['definitions', 'drawerStatus'], [
      field('state', 'DrawerState', true),
      field('message', 'String', false),
    ]),
    struct(bridge, 'DrawerResult', ['definitions', 'drawerResult'], [
      field('actionId', 'String', true),
      field('status', 'DrawerActionStatus', true),
      field('reasonCode', 'DrawerReasonCode', true),
      field('performedAt', 'String', true),
    ]),
    struct(bridge, 'DeviceProfile', ['definitions', 'deviceProfile'], [
      field('deviceId', 'String', true),
      field('displayName', 'String', true),
      field('platform', 'BridgePlatform', true),
      field('settingsWritable', 'Bool', true),
    ]),
    struct(bridge, 'BridgeError', ['definitions', 'responseEnvelope', 'oneOf', 1, 'properties', 'error'], [
      field('code', 'BridgeErrorCode', true),
      field('message', 'String', true),
      field('details', 'BridgeErrorDetails', false),
    ]),
  ];

  const payloads: string[] = [
    struct(bridge, 'EmptyPayload', ['definitions', 'emptyPayload'], []),
    struct(bridge, 'BridgePingPayload', ['definitions', 'requestBridgePing', 'properties', 'payload'], [
      field('nonce', 'String', false),
    ]),
    struct(bridge, 'PrintJobPayload', ['definitions', 'requestPrinterPrintJob', 'properties', 'payload'], [
      field('printJobId', 'String', true),
      field('document', 'ReceiptDocument', true),
      field('options', 'PrintOptions', true),
    ]),
    struct(bridge, 'DrawerOpenPayload', ['definitions', 'requestDrawerOpen', 'properties', 'payload'], [
      field('actionId', 'String', true),
      field('authorizationGrant', 'String', true),
      field('reasonCode', 'DrawerReasonCode', true),
    ]),
  ];

  const scaffolding = `public enum BridgeProtocolInfo {
    public static let version = ${bridgeVersion}
    public static let name = ${JSON.stringify(protocolName)}
}

public typealias BridgeErrorDetails = [String: JSONValue]

/// Command envelope. The Swift shell decodes \`command\` first, then decodes the
/// matching \`Payload\` type; payload decoding is command-specific and lives in
/// the hand-written dispatcher, not in these generated models.
public struct BridgeRequestEnvelope<Payload: Codable & Sendable>: Codable, Sendable {
    public let version: Int
    public let requestId: String
    public let command: BridgeCommand
    public let payload: Payload

    public init(version: Int = BridgeProtocolInfo.version, requestId: String, command: BridgeCommand, payload: Payload) {
        self.version = version
        self.requestId = requestId
        self.command = command
        self.payload = payload
    }
}

public struct BridgeSuccessResponse<ResultBody: Codable & Sendable>: Codable, Sendable {
    public let version: Int
    public let requestId: String
    public let ok: Bool
    public let result: ResultBody

    public init(version: Int = BridgeProtocolInfo.version, requestId: String, ok: Bool = true, result: ResultBody) {
        self.version = version
        self.requestId = requestId
        self.ok = ok
        self.result = result
    }
}

public struct BridgeFailureResponse: Codable, Sendable {
    public let version: Int
    public let requestId: String
    public let ok: Bool
    public let error: BridgeError

    public init(version: Int = BridgeProtocolInfo.version, requestId: String, ok: Bool = false, error: BridgeError) {
        self.version = version
        self.requestId = requestId
        self.ok = ok
        self.error = error
    }
}`;

  const header = `// Apollo desktop bridge — generated Swift Codable models.
//
// GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: protocol/bridge-v1.schema.json, protocol/receipt-v1.schema.json
// Regenerate with: npm run generate:swift
// Verified in CI by @apollo/swift-models (drift check against the committed file).
//
// Free-form JSON (BridgeError.details) uses the hand-written JSONValue helper in
// macos/Support/JSONValue.swift. These models carry no device or dispatch logic.

import Foundation`;

  const sections = [
    header,
    '// MARK: - Protocol identity and envelopes',
    scaffolding,
    '// MARK: - Enumerations',
    ...enums,
    '// MARK: - Receipt document',
    ...receiptStructs,
    '// MARK: - Bridge results',
    ...bridgeStructs,
    '// MARK: - Command payloads',
    ...payloads,
  ];

  return { [GENERATED_SWIFT_FILENAME]: `${sections.join('\n\n')}\n` };
}
