#!/usr/bin/env node
// Generate a dev JWT for testing (mimics Cloudflare Access JWT structure)
// Usage: node scripts/generate-dev-jwt.js dev@reset.tech

const email = process.argv[2] || 'dev@reset.tech';

// Create a simple JWT (not signed, just base64 encoded)
// In dev mode, signature validation is skipped
const header = {
  alg: 'HS256',
  typ: 'JWT'
};

const payload = {
  email: email,
  sub: `dev-${email}`,
  iss: 'dev-local',
  aud: ['dev-local'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
};

// Base64url encode
const base64url = (str) => {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const headerEncoded = base64url(JSON.stringify(header));
const payloadEncoded = base64url(JSON.stringify(payload));
const signature = base64url('fake-signature-dev-mode');

const jwt = `${headerEncoded}.${payloadEncoded}.${signature}`;

console.log('\n✅ Dev JWT Generated\n');
console.log('Email:', email);
console.log('\nAdd this header to your HTTP requests:\n');
console.log('cf-access-jwt-assertion:', jwt);
console.log('\nOr use with curl:\n');
console.log(`curl http://localhost:8789/api/zoku/me \\`);
console.log(`  -H "cf-access-jwt-assertion: ${jwt}"`);
console.log('\n');
