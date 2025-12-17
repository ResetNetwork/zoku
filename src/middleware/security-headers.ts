/**
 * Security Headers Middleware
 * 
 * Sets HTTP security headers to protect against common web vulnerabilities:
 * - Content-Security-Policy: Prevent XSS via resource injection
 * - X-Frame-Options: Prevent clickjacking
 * - Strict-Transport-Security: Force HTTPS
 * - X-Content-Type-Options: Prevent MIME sniffing
 * - Referrer-Policy: Control referrer information
 * - Permissions-Policy: Disable unnecessary browser features
 */

import { Context, Next } from 'hono';

export function securityHeadersMiddleware() {
  return async (c: Context, next: Next) => {
    await next();

    // Content-Security-Policy (CSP)
    // Strict policy: only allow resources from same origin
    // 'unsafe-inline' for styles is needed for Tailwind CSS
    // 'unsafe-eval' is NOT allowed (no eval() usage in app)
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // Tailwind requires inline styles
      "img-src 'self' data:", // data: for base64 images if any
      "font-src 'self'",
      "connect-src 'self'", // API calls to same origin
      "frame-ancestors 'none'", // Prevent embedding (same as X-Frame-Options)
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'", // No Flash, Java, etc.
      "upgrade-insecure-requests" // Auto-upgrade HTTP to HTTPS
    ].join('; ');

    c.header('Content-Security-Policy', csp);

    // X-Frame-Options: Prevent clickjacking
    // DENY = cannot be embedded in any frame/iframe
    c.header('X-Frame-Options', 'DENY');

    // Strict-Transport-Security (HSTS)
    // Force HTTPS for 1 year, include subdomains, allow preloading
    // max-age=31536000 = 1 year in seconds
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // X-Content-Type-Options: Prevent MIME sniffing
    // Forces browser to respect Content-Type header
    c.header('X-Content-Type-Options', 'nosniff');

    // Referrer-Policy: Control referrer information
    // strict-origin-when-cross-origin = full URL for same-origin, origin only for cross-origin
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy: Disable unnecessary browser features
    // Explicitly disable features we don't use to reduce attack surface
    const permissions = [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()'
    ].join(', ');
    c.header('Permissions-Policy', permissions);

    // X-Powered-By: Remove server fingerprinting
    // Note: Hono doesn't add this by default, but good practice to ensure it's not set
    c.header('X-Powered-By', '');
  };
}

/**
 * Security headers for OAuth popup windows
 * More permissive CSP to allow OAuth provider communication
 */
export function oauthSecurityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // Relaxed CSP for OAuth flows (needs to communicate with Google, GitHub, etc.)
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:", // Allow OAuth provider logos
      "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com", // Google OAuth
      "frame-ancestors 'none'",
      "form-action 'self' https://accounts.google.com", // Allow OAuth redirects
      "base-uri 'self'"
    ].join('; ');

    c.header('Content-Security-Policy', csp);

    // Other headers same as main app
    c.header('X-Frame-Options', 'DENY');
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-Powered-By', '');
  };
}
