#!/bin/bash

# Multi-RPC Setup Script
# This script helps you configure multiple RPC endpoints

echo "🚀 Multi-RPC Setup for Fundly"
echo "============================="
echo ""

# Check if .env.local exists
if [ -f "frontend/.env.local" ]; then
    echo "⚠️  frontend/.env.local already exists"
    read -p "Do you want to backup and recreate it? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mv frontend/.env.local frontend/.env.local.backup.$(date +%s)
        echo "✅ Backed up existing .env.local"
    else
        echo "❌ Cancelled. Please edit frontend/.env.local manually"
        exit 0
    fi
fi

# Create .env.local
cat > frontend/.env.local << 'EOF'
# Solana Network Configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# ============================================
# MULTIPLE RPC ENDPOINTS
# ============================================
# Sign up for FREE accounts and add your API keys below:
# - Helius: https://dev.helius.xyz/dashboard/app
# - Alchemy: https://dashboard.alchemy.com/

# Helius RPC (Required)
NEXT_PUBLIC_HELIUS_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY

# Alchemy RPC (Required)
NEXT_PUBLIC_ALCHEMY_RPC_ENDPOINT=https://solana-devnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# QuickNode RPC (Optional)
# NEXT_PUBLIC_QUICKNODE_RPC_ENDPOINT=

# ============================================
# SUPABASE (if using)
# ============================================
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
EOF

echo "✅ Created frontend/.env.local"
echo ""
echo "📝 Next Steps:"
echo "=============="
echo ""
echo "1. Sign up for FREE RPC accounts:"
echo "   - Helius:  https://dev.helius.xyz/dashboard/app"
echo "   - Alchemy: https://dashboard.alchemy.com/"
echo ""
echo "2. Get your API keys from each provider"
echo ""
echo "3. Edit frontend/.env.local and replace:"
echo "   - YOUR_HELIUS_API_KEY"
echo "   - YOUR_ALCHEMY_API_KEY"
echo ""
echo "4. Restart your dev server:"
echo "   cd frontend && npm run dev"
echo ""
echo "📖 For detailed instructions, see: MULTI_RPC_SETUP_GUIDE.md"
echo ""
echo "✨ Done! Your app will now use multiple RPCs and avoid rate limits."


