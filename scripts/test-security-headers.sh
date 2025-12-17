#!/bin/bash
# Test security headers on deployed application

URL="${1:-http://localhost:8789}"

echo "Testing security headers on: $URL"
echo "================================================"
echo ""

# Test /health endpoint
echo "1. Testing /health endpoint:"
curl -sI "$URL/health" | grep -E "^(HTTP|Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|X-Content-Type-Options|Referrer-Policy|Permissions-Policy):" || echo "❌ Headers not found"
echo ""

# Test /api/entanglements endpoint
echo "2. Testing /api/entanglements endpoint:"
curl -sI "$URL/api/entanglements" | grep -E "^(HTTP|Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|X-Content-Type-Options|Referrer-Policy|Permissions-Policy):" || echo "❌ Headers not found"
echo ""

# Test OAuth endpoint (should have relaxed CSP)
echo "3. Testing /oauth/authorize endpoint (relaxed CSP):"
curl -sI "$URL/oauth/authorize" | grep -E "^(HTTP|Content-Security-Policy):" || echo "❌ Headers not found"
echo ""

echo "================================================"
echo "Expected headers:"
echo "  - Content-Security-Policy (with 'self' restrictions)"
echo "  - X-Frame-Options: DENY"
echo "  - Strict-Transport-Security (max-age=31536000)"
echo "  - X-Content-Type-Options: nosniff"
echo "  - Referrer-Policy: strict-origin-when-cross-origin"
echo "  - Permissions-Policy (disabled features)"
echo ""
echo "For OAuth endpoints:"
echo "  - CSP should include Google OAuth domains"
