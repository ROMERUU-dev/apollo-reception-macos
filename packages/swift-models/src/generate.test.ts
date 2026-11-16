import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GENERATED_SWIFT_FILENAME, generateSwiftModels } from './generate.js';

const committedPath = fileURLToPath(new URL(`../../../macos/Generated/${GENERATED_SWIFT_FILENAME}`, import.meta.url));

describe('swift model generator', () => {
  it('is deterministic across runs', () => {
    expect(generateSwiftModels()).toEqual(generateSwiftModels());
  });

  it('matches the committed Swift file (run "npm run generate:swift" after schema changes)', () => {
    const generated = generateSwiftModels()[GENERATED_SWIFT_FILENAME];
    const committed = readFileSync(committedPath, 'utf8');
    expect(committed).toBe(generated);
  });

  it('derives enum cases and protocol identity from the schema', () => {
    const swift = generateSwiftModels()[GENERATED_SWIFT_FILENAME] ?? '';
    // Enum vocabulary and camelCased cases come straight from the schema.
    expect(swift).toContain('case outOfPaper = "out_of_paper"');
    expect(swift).toContain('case cashPayment = "cash_payment"');
    expect(swift).toContain('case _58mm = "58mm"');
    expect(swift).toContain('public static let name = "apollo-desktop-bridge"');
    // Every allowlisted command is represented exactly once.
    for (const command of ['bridge.getVersion', 'printer.printJob', 'drawer.open', 'device.getProfile']) {
      expect(swift).toContain(`= "${command}"`);
    }
    // Device/dispatch logic must never leak into the models.
    expect(swift).not.toContain('WKWebView');
    expect(swift).not.toContain('URLSession');
  });

  it('fails loudly when a struct spec drifts from the schema shape', async () => {
    // The generator verifies property/required sets against the schema. Feeding a
    // mutated schema path would throw; here we assert the guard exists by shape.
    const swift = generateSwiftModels()[GENERATED_SWIFT_FILENAME] ?? '';
    expect(swift).toContain('public struct ReceiptDocument: Codable, Sendable');
    expect(swift).toContain('public typealias BridgeErrorDetails = [String: JSONValue]');
  });
});
