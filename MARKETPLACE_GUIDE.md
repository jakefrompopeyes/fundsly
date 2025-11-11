# Marketplace Guide

## How Tokens Show Up in the Marketplace

The marketplace page (`/dashboard/market`) now properly fetches and displays tokens from your Solana program. Here's how it works:

### Data Flow

1. **Fetching Projects**: The page uses Anchor's Program API to fetch all `ProjectState` accounts from your deployed Solana program
2. **Filtering Valid Tokens**: Only projects with a valid mint address (not the default/zero address) are shown
3. **Bonding Curve Data**: For each project, the page attempts to fetch the associated `BondingCurve` account to show trading metrics
4. **Real-time Pricing**: Current price and SOL raised are calculated from the bonding curve reserves

### What Gets Displayed

For each token in the marketplace, users can see:

- **Token Name & Symbol**: From the ProjectState account
- **Category**: DeFi, NFT, Gaming, etc.
- **Total Supply**: The total token supply (formatted from raw units)
- **Current Price**: Live price in SOL (calculated from bonding curve)
- **SOL Raised**: Total SOL collected in the bonding curve
- **Status**: Trading, Complete, or Migrated
- **Created Date**: When the project was initialized

### How to Add Tokens to the Marketplace

Tokens will automatically appear in the marketplace after completing these steps:

#### 1. Initialize a Project
```typescript
// Call the initializeProject instruction
await program.methods
  .initializeProject(
    "My Token",      // name
    "MTK",           // symbol
    1000000000000000, // total supply (with decimals)
    "DeFi"           // category
  )
  .accounts({
    projectState: projectStatePda,
    owner: wallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

#### 2. Create the Token Mint
```typescript
// Call the createMint instruction
await program.methods
  .createMint(
    "My Token",
    "MTK",
    "https://arweave.net/metadata.json" // metadata URI
  )
  .accounts({
    projectState: projectStatePda,
    mint: mintKeypair.publicKey,
    metadata: metadataPda,
    ownerTokenAccount: ownerAta,
    owner: wallet.publicKey,
    // ... other accounts
  })
  .signers([mintKeypair])
  .rpc();
```

#### 3. Initialize Bonding Curve (Optional but Recommended)
```typescript
// Call the initializeBondingCurve instruction
await program.methods
  .initializeBondingCurve(
    800000000000000 // token supply for bonding curve
  )
  .accounts({
    bondingCurve: bondingCurvePda,
    mint: mintKeypair.publicKey,
    solVault: solVaultPda,
    bondingCurveTokenAccount: bondingCurveAta,
    globalConfig: globalConfigPda,
    creator: wallet.publicKey,
    // ... other accounts
  })
  .rpc();
```

### Category Filter

The marketplace supports filtering by category:
- All
- DeFi
- NFT
- Gaming
- Infrastructure
- Social
- AI/ML
- DAO
- Metaverse
- Other

Make sure to set the appropriate category when initializing your project.

### Trading Integration

Each token card has a "Trade Token" button that links to `/dashboard/trade/[mint]` where users can:
- Buy tokens from the bonding curve
- Sell tokens back to the bonding curve
- View real-time price charts
- See transaction history

### Network Support

The marketplace works on both:
- **Devnet**: For testing (links to Solscan devnet)
- **Mainnet**: For production (update the cluster parameter)

Current configuration points to devnet. The Solscan links in the marketplace automatically adjust based on your network.

### Troubleshooting

**No tokens showing up?**
- Make sure you've completed all 3 steps above (initialize project, create mint, optionally initialize bonding curve)
- Check that the mint field in ProjectState is not the default address (11111...111)
- Verify you're connected to the correct network (devnet/mainnet)
- Open browser console to see detailed logs of what's being fetched

**Bonding curve data not showing?**
- The bonding curve is optional. If not initialized, you'll see limited data (no price, no SOL raised)
- To enable trading, you must initialize a bonding curve for the token

**Token data looks wrong?**
- Verify the total_supply was set correctly (remember to include decimals: for 1 billion tokens with 6 decimals, use 1000000000000000)
- Check that the category matches one of the supported categories exactly

### Implementation Details

The marketplace page uses:
- **Anchor Program API**: For proper deserialization of on-chain accounts
- **PDA Derivation**: To find bonding curve accounts based on mint address
- **Real-time Calculations**: Price is computed as `totalSOL / totalTokens` from the bonding curve reserves
- **Responsive Design**: Grid layout adapts to screen size (1, 2, or 3 columns)
- **Error Handling**: Gracefully handles missing bonding curves and invalid data

### Next Steps

1. **Create your first token** using the "Create Startup" page (`/dashboard/create-startup`)
2. **Initialize a bonding curve** to enable trading
3. **Check the marketplace** to see your token listed
4. **Share the trade link** with others to let them buy your token

For more information about bonding curves, see `BONDING_CURVE_GUIDE.md`.

