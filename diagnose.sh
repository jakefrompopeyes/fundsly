#!/bin/bash

# Token Issues Diagnostic Tool
# Checks all tokens for metadata and bonding curve issues

echo "🔍 Running Token Diagnostics..."
echo ""

cd frontend

# Check if ts-node is available
if ! command -v ts-node &> /dev/null; then
    echo "❌ ts-node not found. Installing..."
    npm install -g ts-node
fi

# Run diagnostics
npx ts-node --project tsconfig.json scripts/diagnose-token-issues.ts

echo ""
echo "📖 For more information, see:"
echo "   - FIXES_SUMMARY.md"
echo "   - TROUBLESHOOTING_GUIDE.md"

