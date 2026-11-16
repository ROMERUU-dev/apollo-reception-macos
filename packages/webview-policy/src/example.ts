import { defineWebViewPolicy, type WebViewPolicy } from './policy.js';

/**
 * PLACEHOLDER policy for documentation and tests only.
 *
 * It uses reserved `.example` origins, never a real deployment. The production
 * Apollo origin, OIDC origins, and route set are supplied at runtime on the Mac
 * and must never be committed to this public repository (see SECURITY.md).
 */
export const examplePlaceholderPolicy: WebViewPolicy = defineWebViewPolicy({
  appOrigin: 'https://apollo.example',
  oidcOrigins: ['https://id.apollo.example'],
  allowedRoutePrefixes: ['/recepcion', '/login', '/oauth2', '/api/session'],
  externalLinkMode: 'open-externally',
  allowSubdomains: false,
});
