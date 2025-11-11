#!/bin/bash

# Check Devnet Balance and Deployment Readiness

echo "🔍 Checking Devnet Balance..."
echo ""

BALANCE=$(solana balance --url devnet | awk '{print $1}')
REQUIRED=2.89

echo "Current Balance: $BALANCE SOL"
echo "Required for Deployment: $REQUIRED SOL"
echo ""

# Compare using bc if available, otherwise use awk
if command -v bc &> /dev/null; then
    ENOUGH=$(echo "$BALANCE >= $REQUIRED" | bc)
else
    ENOUGH=$(awk -v bal="$BALANCE" -v req="$REQUIRED" 'BEGIN {print (bal >= req) ? 1 : 0}')
fi

if [ "$ENOUGH" -eq 1 ]; then
    echo "✅ You have enough SOL for deployment!"
    echo ""
    echo "Ready to deploy with:"
    echo "  anchor deploy --provider.cluster devnet"
else
    NEEDED=$(awk -v bal="$BALANCE" -v req="$REQUIRED" 'BEGIN {printf "%.2f", req - bal}')
    echo "❌ Insufficient funds. Need $NEEDED more SOL"
    echo ""
    echo "Get devnet SOL from:"
    echo "  • https://faucet.solana.com/"
    echo "  • https://faucet.quicknode.com/solana/devnet"
    echo ""
    echo "Your wallet address:"
    solana address
fi

