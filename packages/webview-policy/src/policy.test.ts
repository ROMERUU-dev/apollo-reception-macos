import { describe, expect, it } from 'vitest';
import { examplePlaceholderPolicy } from './example.js';
import { defineWebViewPolicy, evaluateNavigation, isAllowedMessageOrigin } from './policy.js';

const policy = examplePlaceholderPolicy;

describe('defineWebViewPolicy', () => {
  it('rejects non-HTTPS and pathful app origins', () => {
    expect(() => defineWebViewPolicy({ appOrigin: 'http://apollo.example' })).toThrow(/https/);
    expect(() => defineWebViewPolicy({ appOrigin: 'https://apollo.example/recepcion' })).toThrow(/without a path/);
    expect(() => defineWebViewPolicy({ appOrigin: 'https://*.apollo.example' })).toThrow();
  });

  it('rejects malformed route prefixes', () => {
    expect(() => defineWebViewPolicy({ appOrigin: 'https://apollo.example', allowedRoutePrefixes: ['recepcion'] })).toThrow(/start with/);
    expect(() => defineWebViewPolicy({ appOrigin: 'https://apollo.example', allowedRoutePrefixes: ['/a*'] })).toThrow(/wildcard/);
  });

  it('normalizes and exposes the navigable origin set', () => {
    expect(policy.navigableOrigins).toEqual(['https://apollo.example', 'https://id.apollo.example']);
    expect(policy.allowedRoutePrefixes).toContain('/recepcion');
  });

  it('drops an OIDC origin duplicated with the app origin', () => {
    const deduped = defineWebViewPolicy({ appOrigin: 'https://apollo.example', oidcOrigins: ['https://apollo.example'] });
    expect(deduped.oidcOrigins).toEqual([]);
  });
});

describe('evaluateNavigation', () => {
  it('allows controlled routes on the app origin', () => {
    expect(evaluateNavigation(policy, 'https://apollo.example/recepcion').action).toBe('allow');
    expect(evaluateNavigation(policy, 'https://apollo.example/recepcion/cash').action).toBe('allow');
  });

  it('blocks app-origin routes that are not allowlisted', () => {
    expect(evaluateNavigation(policy, 'https://apollo.example/admin').action).toBe('block');
  });

  it('allows enumerated OIDC origins', () => {
    expect(evaluateNavigation(policy, 'https://id.apollo.example/authorize?x=1').action).toBe('allow');
  });

  it('treats other origins as external links and blocks non-HTTPS', () => {
    expect(evaluateNavigation(policy, 'https://example.com/anything').action).toBe('external');
    expect(evaluateNavigation(policy, 'http://apollo.example/recepcion').action).toBe('block');
    expect(evaluateNavigation(policy, 'not a url').action).toBe('block');
    expect(evaluateNavigation(policy, 'mailto:soporte@apollo.example').action).toBe('external');
  });

  it('honors a block-only external link mode', () => {
    const strict = defineWebViewPolicy({ appOrigin: 'https://apollo.example', externalLinkMode: 'block' });
    expect(evaluateNavigation(strict, 'https://example.com').action).toBe('block');
  });

  it('allows subdomains only when configured', () => {
    expect(evaluateNavigation(policy, 'https://cdn.apollo.example/').action).toBe('external');
    const widened = defineWebViewPolicy({ appOrigin: 'https://apollo.example', allowSubdomains: true });
    expect(evaluateNavigation(widened, 'https://cdn.apollo.example/recepcion').action).toBe('allow');
  });
});

describe('isAllowedMessageOrigin', () => {
  it('accepts only the app origin main frame', () => {
    expect(isAllowedMessageOrigin(policy, 'https://apollo.example', { isMainFrame: true })).toBe(true);
    expect(isAllowedMessageOrigin(policy, 'https://apollo.example', { isMainFrame: false })).toBe(false);
    expect(isAllowedMessageOrigin(policy, 'https://id.apollo.example', { isMainFrame: true })).toBe(false);
    expect(isAllowedMessageOrigin(policy, 'https://example.com', { isMainFrame: true })).toBe(false);
  });
});
