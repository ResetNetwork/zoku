#!/bin/bash
set -e

echo "🚀 Deploying The Great Game to Cloudflare..."
echo ""

# 1. Create KV namespace (skip if exists)
echo "📦 Step 1/7: Creating KV namespace..."
KV_OUTPUT=$(npx wrangler kv namespace create AUTH_KV 2>&1 || true)
if echo "$KV_OUTPUT" | grep -q "id ="; then
  KV_ID=$(echo "$KV_OUTPUT" | grep "id =" | cut -d'"' -f2)
  echo "✅ KV created: $KV_ID"
  echo "⚠️  Update wrangler.toml: [[kv_namespaces]] id = \"$KV_ID\""
  echo ""
  read -p "Press Enter after updating wrangler.toml..."
else
  echo "ℹ️  KV namespace may already exist, continuing..."
fi
echo ""

# 2. Set secrets
echo "🔐 Step 2/7: Setting secrets..."
echo "Generating ENCRYPTION_KEY (32 bytes):"
ENC_KEY=$(openssl rand -base64 32)
echo "$ENC_KEY"
echo ""
echo "$ENC_KEY" | npx wrangler secret put ENCRYPTION_KEY
echo "✅ ENCRYPTION_KEY set"
echo ""

echo "Generating JWT_SECRET (32 bytes):"
JWT_KEY=$(openssl rand -base64 32)
echo "$JWT_KEY"
echo ""
echo "$JWT_KEY" | npx wrangler secret put JWT_SECRET
echo "✅ JWT_SECRET set"
echo ""

read -p "Enter admin email (e.g., admin@reset.tech): " ADMIN_EMAIL
echo "$ADMIN_EMAIL" | npx wrangler secret put ADMIN_EMAIL
echo "✅ ADMIN_EMAIL set: $ADMIN_EMAIL"
echo ""

# Verify secrets
echo "Verifying secrets..."
npx wrangler secret list
echo ""

# 3. Initialize database
echo "🗄️  Step 3/7: Initializing database..."
echo "Creating tables..."
npx wrangler d1 execute the-great-game --remote --file=./schema.sql
echo "✅ Tables created"
echo ""

echo "Loading seed data..."
npx wrangler d1 execute the-great-game --remote --file=./seed.sql
echo "✅ Seed data loaded"
echo ""

# Verify tables
echo "Verifying tables..."
npx wrangler d1 execute the-great-game --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'" | head -20
echo ""

# 4. Build frontend
echo "🎨 Step 4/7: Building frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
npm run build
cd ..
echo "✅ Frontend built"
echo ""

# 5. Deploy
echo "🚢 Step 5/7: Deploying worker..."
npx wrangler deploy
echo "✅ Worker deployed"
echo ""

# 6. Get deployment info
echo "📋 Step 6/7: Getting deployment info..."
DEPLOY_INFO=$(npx wrangler deployments list 2>&1 | head -10)
echo "$DEPLOY_INFO"
echo ""

# 7. Test deployment
echo "🧪 Step 7/7: Testing deployment..."
echo "Testing health endpoint..."
WORKER_URL=$(echo "$DEPLOY_INFO" | grep -o 'https://the-great-game.*workers.dev' | head -1)
if [ -n "$WORKER_URL" ]; then
  echo "Worker URL: $WORKER_URL"
  curl -s "$WORKER_URL/health" | jq . || curl -s "$WORKER_URL/health"
  echo ""
else
  echo "⚠️  Could not extract worker URL, test manually"
fi
echo ""

# Done!
echo "✅ Deployment complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Configure custom domain (optional):"
echo "   npx wrangler domains add zoku.205.dev"
echo ""
echo "2. Setup Cloudflare Access (required for web UI):"
echo "   npx wrangler open"
echo "   → Navigate to: Zero Trust → Access → Applications"
echo "   → Add application for: zoku.205.dev"
echo "   → Allow emails: @reset.tech"
echo ""
echo "3. Test your deployment:"
if [ -n "$WORKER_URL" ]; then
  echo "   curl $WORKER_URL/health"
  echo "   curl $WORKER_URL/.well-known/oauth-authorization-server"
fi
echo ""
echo "4. Login and verify admin access:"
echo "   Visit your domain and login"
echo "   Email: $ADMIN_EMAIL will be auto-promoted to 'prime' tier"
echo ""
echo "5. Monitor logs:"
echo "   npx wrangler tail --format pretty"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
