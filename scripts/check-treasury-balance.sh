#!/bin/bash
# Quick script to check treasury balance

TREASURY="DF6KTfmnnJTCEMS8JkHhq64qwfTnrJL4UTgiFJdEwrJj"

echo "💰 Checking Treasury Balance..."
echo ""
echo "Treasury Address: $TREASURY"
echo ""

echo "📊 Devnet Balance:"
solana balance $TREASURY --url devnet

echo ""
echo "📊 Mainnet Balance:"
solana balance $TREASURY --url mainnet-beta

echo ""
echo "🔗 View on Explorer:"
echo "   Devnet:  https://explorer.solana.com/address/$TREASURY?cluster=devnet"
echo "   Mainnet: https://explorer.solana.com/address/$TREASURY"

