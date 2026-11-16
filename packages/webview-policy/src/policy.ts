/**
 * Portable WKWebView navigation and origin policy.
 *
 * The macOS shell must allow only the configured Apollo HTTPS origin and the
 * minimum enumerated OIDC origins, permit only controlled routes, block
 * arbitrary navigation, and route approved external links outside the WebView.
 * This module encodes that policy as data plus pure decision functions so the
 * rules can be reviewed and tested on Linux and mirrored exactly in Swift.
 *
 * It contains no real origins. The production Apollo origin is configured at
 * runtime on the Mac and must never be committed to this public repository.
 */

export type ExternalLinkMode = 'open-externally' | 'block';

export interface WebViewPolicyInput {
  /** The single Apollo HTTPS origin, e.g. `https://apollo.example`. Origin only; no path. */
  appOrigin: string;
  /** Minimum explicitly enumerated OIDC/identity origins that may load inside the WebView. */
  oidcOrigins?: string[];
  /** Controlled route prefixes on the app origin. Defaults to `['/']` (origin is the primary gate). */
  allowedRoutePrefixes?: string[];
  /** How to treat links to other origins. Defaults to `'open-externally'`. */
  externalLinkMode?: ExternalLinkMode;
  /** Whether subdomains of the app origin are navigable. Defaults to `false`. */
  allowSubdomains?: boolean;
}

export interface WebViewPolicy {
  readonly appOrigin: string;
  readonly oidcOrigins: readonly string[];
  /** Union of the app origin and OIDC origins; the only origins that may load in the WebView. */
  readonly navigableOrigins: readonly string[];
  readonly allowedRoutePrefixes: readonly string[];
  readonly externalLinkMode: ExternalLinkMode;
  readonly allowSubdomains: boolean;
}

export type NavigationAction = 'allow' | 'external' | 'block';

export interface NavigationDecision {
  readonly action: NavigationAction;
  readonly reason: string;
}

function assertHttpsOrigin(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} is not a valid URL: ${value}`);
  }
  if (url.protocol !== 'https:') throw new TypeError(`${label} must use https: ${value}`);
  if (url.username || url.password) throw new TypeError(`${label} must not contain credentials: ${value}`);
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') throw new TypeError(`${label} must be an origin without a path, query, or fragment: ${value}`);
  if (url.hostname.includes('*')) throw new TypeError(`${label} must not contain wildcards: ${value}`);
  return url.origin;
}

function normalizeRoutePrefix(prefix: string): string {
  if (!prefix.startsWith('/')) throw new TypeError(`Route prefix must start with "/": ${prefix}`);
  if (prefix.includes('*')) throw new TypeError(`Route prefix must not contain wildcards: ${prefix}`);
  if (prefix === '/') return '/';
  return prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** Validates and normalizes policy input, failing closed on anything unsafe. */
export function defineWebViewPolicy(input: WebViewPolicyInput): WebViewPolicy {
  const appOrigin = assertHttpsOrigin(input.appOrigin, 'appOrigin');
  const oidcOrigins = unique((input.oidcOrigins ?? []).map((origin) => assertHttpsOrigin(origin, 'oidcOrigin'))).filter((origin) => origin !== appOrigin);
  const routes = unique((input.allowedRoutePrefixes ?? ['/']).map(normalizeRoutePrefix));
  return {
    appOrigin,
    oidcOrigins,
    navigableOrigins: unique([appOrigin, ...oidcOrigins]),
    allowedRoutePrefixes: routes.length > 0 ? routes : ['/'],
    externalLinkMode: input.externalLinkMode ?? 'open-externally',
    allowSubdomains: input.allowSubdomains ?? false,
  };
}

function originMatches(candidate: string, base: string, allowSubdomains: boolean): boolean {
  if (candidate === base) return true;
  if (!allowSubdomains) return false;
  let c: URL;
  let b: URL;
  try {
    c = new URL(candidate);
    b = new URL(base);
  } catch {
    return false;
  }
  return c.protocol === b.protocol && c.port === b.port && c.hostname.endsWith(`.${b.hostname}`);
}

function isRouteAllowed(policy: WebViewPolicy, pathname: string): boolean {
  return policy.allowedRoutePrefixes.some((prefix) => prefix === '/' || pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Decides how the shell should handle a navigation request to `rawUrl`. */
export function evaluateNavigation(policy: WebViewPolicy, rawUrl: string): NavigationDecision {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { action: 'block', reason: 'URL could not be parsed.' };
  }

  const externalAction: NavigationAction = policy.externalLinkMode === 'open-externally' ? 'external' : 'block';

  if (url.protocol === 'mailto:' || url.protocol === 'tel:') {
    return { action: externalAction, reason: `Non-web scheme (${url.protocol}) handled as an external link.` };
  }
  if (url.protocol !== 'https:') {
    return { action: 'block', reason: `Non-HTTPS navigation blocked (${url.protocol}).` };
  }
  if (originMatches(url.origin, policy.appOrigin, policy.allowSubdomains)) {
    return isRouteAllowed(policy, url.pathname)
      ? { action: 'allow', reason: 'Controlled Apollo route on the app origin.' }
      : { action: 'block', reason: 'App origin but route is not allowlisted.' };
  }
  if (policy.oidcOrigins.some((origin) => originMatches(url.origin, origin, false))) {
    return { action: 'allow', reason: 'Enumerated OIDC origin.' };
  }
  return { action: externalAction, reason: 'Origin is not navigable; handled as an external link.' };
}

export interface MessageOriginContext {
  /** Whether the posting frame is the main frame. Bridge messages are rejected from subframes. */
  isMainFrame: boolean;
}

/**
 * Whether a frame at `origin` may post bridge messages. Only the app origin's
 * main frame is trusted; OIDC and external origins, and all subframes, are
 * rejected before the message is decoded.
 */
export function isAllowedMessageOrigin(policy: WebViewPolicy, origin: string, context: MessageOriginContext): boolean {
  if (!context.isMainFrame) return false;
  return originMatches(origin, policy.appOrigin, policy.allowSubdomains);
}
