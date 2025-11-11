# Fundly Bonding Curve System - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Mathematical Formula](#mathematical-formula)
4. [Architecture](#architecture)
5. [Smart Contract Implementation](#smart-contract-implementation)
6. [Frontend Integration](#frontend-integration)
7. [Usage Examples](#usage-examples)
8. [Deployment Instructions](#deployment-instructions)
9. [Testing Guide](#testing-guide)
10. [FAQ](#faq)

---

## Overview

Fundly implements a **pump.fun-style bonding curve** trading system that enables immediate liquidity for newly created tokens without requiring initial capital or liquidity providers. This mechanism ensures:

- ✅ **Instant Liquidity**: Tokens are tradeable immediately upon creation
- ✅ **Fair Price Discovery**: Prices adjust automatically based on supply and demand
- ✅ **No Initial Capital Required**: Creators don't need to provide liquidity
- ✅ **Automated Market Making**: The bonding curve acts as an always-available counterparty
- ✅ **Transparent Pricing**: All prices are calculated on-chain using a deterministic formula

---

## How It Works

### Constant Product Market Maker (CPMM)

The bonding curve uses the **constant product formula**, similar to Uniswap V2:

```
k = (virtual_sol + real_sol) × (virtual_token + real_token)
```

Where:
- **k**: The constant product that must be maintained
- **virtual_sol**: Virtual SOL reserves (for price stability)
- **virtual_token**: Virtual token reserves (for price stability)
- **real_sol**: Actual SOL in the bonding curve
- **real_token**: Actual tokens in the bonding curve

### Virtual vs Real Reserves

#### Virtual Reserves
- Set at initialization from the global config
- Never change throughout the curve's lifetime
- Provide price stability and prevent extreme price swings at low liquidity
- Example: 30 SOL virtual reserves, 1,000,000,000 virtual tokens

#### Real Reserves
- Start at specific values:
  - `real_sol_reserves = 0` (no SOL initially)
  - `real_token_reserves = initial_supply` (all tokens available)
- Update with each trade
- Represent the actual assets in the bonding curve

### Trading Operations

#### Buy Operation
When a user buys tokens:

1. User sends SOL to the bonding curve
2. Platform fee is deducted (e.g., 1%)
3. SOL after fee is added to `real_sol_reserves`
4. Tokens are calculated using the constant product formula
5. Tokens are transferred to the buyer
6. `real_token_reserves` decreases
7. Both virtual and real reserves affect the price

**Formula:**
```typescript
k = (virtual_sol + real_sol) * (virtual_token + real_token)
new_sol = virtual_sol + real_sol + sol_after_fee
new_token = k / new_sol
tokens_out = (virtual_token + real_token) - new_token
```

#### Sell Operation
When a user sells tokens:

1. User sends tokens to the bonding curve
2. Tokens are added to `real_token_reserves`
3. SOL out is calculated using the constant product formula
4. Platform fee is deducted from SOL out
5. Remaining SOL is transferred to the seller
6. `real_sol_reserves` decreases

**Formula:**
```typescript
k = (virtual_sol + real_sol) * (virtual_token + real_token)
new_token = virtual_token + real_token + tokens_in
new_sol = k / new_token
sol_out_before_fee = (virtual_sol + real_sol) - new_sol
sol_out = sol_out_before_fee - fee
```

### Curve Completion

The bonding curve reaches completion when:
- `real_token_reserves == 0` (all tokens have been purchased)
- The `complete` flag is set to `true`
- No more trading is allowed on the curve
- At this point, the token can be migrated to a DEX like Raydium or Orca

---

## Mathematical Formula

### Spot Price Calculation

The current price of 1 token in SOL:

```
spot_price = (virtual_sol + real_sol) / (virtual_token + real_token)
```

### Price Impact

Price impact measures how much a trade moves the market price:

```
price_impact = ((effective_price - spot_price) / spot_price) * 100
```

Where `effective_price` is the average price paid/received for the trade.

### Example Calculation

Given:
- Virtual SOL: 30
- Virtual Tokens: 1,000,000,000
- Real SOL: 5
- Real Tokens: 800,000,000

**Current spot price:**
```
spot_price = (30 + 5) / (1,000,000,000 + 800,000,000)
           = 35 / 1,800,000,000
           = 0.0000000194 SOL per token
```

**Buying 10,000,000 tokens with 1 SOL (after 1% fee):**
```
k = 35 * 1,800,000,000 = 63,000,000,000
sol_after_fee = 1 - 0.01 = 0.99
new_sol = 35 + 0.99 = 35.99
new_token = 63,000,000,000 / 35.99 = 1,750,486,246
tokens_out = 1,800,000,000 - 1,750,486,246 = 49,513,754 tokens
```

---

## Architecture

### Smart Contract Layer (Rust/Anchor)

```
programs/fundly/src/lib.rs
├── GlobalConfig          # Platform-wide configuration
│   ├── virtual_sol_reserves
│   ├── virtual_token_reserves
│   ├── initial_token_supply
│   └── fee_basis_points
│
├── BondingCurve         # Per-token bonding curve state
│   ├── mint
│   ├── creator
│   ├── virtual_sol_reserves
│   ├── virtual_token_reserves
│   ├── real_sol_reserves
│   ├── real_token_reserves
│   ├── complete
│   └── bump
│
└── Instructions
    ├── initialize_global_config()
    ├── initialize_bonding_curve()
    ├── buy_tokens()
    └── sell_tokens()
```

### Frontend Layer (TypeScript/React)

```
frontend/src/
├── lib/
│   ├── anchorClient.ts      # RPC functions for smart contract interaction
│   └── pumpCurve.ts         # Client-side bonding curve math
│
└── components/
    └── trading/
        └── BondingCurveTrader.tsx  # Trading UI component
```

---

## Smart Contract Implementation

### Account Structures

#### GlobalConfig
```rust
pub struct GlobalConfig {
    pub authority: Pubkey,              // Admin who can update config
    pub virtual_sol_reserves: u64,      // Virtual SOL (in lamports)
    pub virtual_token_reserves: u64,    // Virtual tokens (raw units)
    pub initial_token_supply: u64,      // Default supply for new curves
    pub fee_basis_points: u16,          // Fee (100 = 1%)
}
```

#### BondingCurve
```rust
pub struct BondingCurve {
    pub mint: Pubkey,                   // Token mint address
    pub creator: Pubkey,                // Curve creator
    pub virtual_sol_reserves: u64,      // Virtual SOL for pricing
    pub virtual_token_reserves: u64,    // Virtual tokens for pricing
    pub real_sol_reserves: u64,         // Actual SOL in curve
    pub real_token_reserves: u64,       // Actual tokens in curve
    pub complete: bool,                 // All tokens sold?
    pub bump: u8,                       // PDA bump seed
}
```

### Key Instructions

#### 1. Initialize Global Config (Admin Only)
```rust
pub fn initialize_global_config(
    ctx: Context<InitializeGlobalConfig>,
    virtual_sol_reserves: u64,        // e.g., 30 * LAMPORTS_PER_SOL
    virtual_token_reserves: u64,      // e.g., 1_000_000_000 * 1_000_000
    initial_token_supply: u64,        // e.g., 1_000_000_000 * 1_000_000
    fee_basis_points: u16,            // e.g., 100 (1%)
) -> Result<()>
```

**Usage:** Run once to set platform-wide parameters.

#### 2. Initialize Bonding Curve
```rust
pub fn initialize_bonding_curve(
    ctx: Context<InitializeBondingCurve>,
    token_supply: u64,                // Initial token supply (raw units)
) -> Result<()>
```

**Requirements:**
- Token mint must already exist
- Creator must transfer tokens to the bonding curve
- Creates the bonding curve PDA and token vault

#### 3. Buy Tokens
```rust
pub fn buy_tokens(
    ctx: Context<BuyTokens>,
    sol_amount: u64,                  // SOL to spend (in lamports)
    min_tokens_out: u64,              // Minimum tokens expected (slippage protection)
) -> Result<()>
```

**Process:**
1. Validates bonding curve is not complete
2. Calculates fee and tokens out
3. Transfers SOL from buyer to vault
4. Transfers tokens from curve to buyer
5. Updates reserves
6. Emits BuyEvent

#### 4. Sell Tokens
```rust
pub fn sell_tokens(
    ctx: Context<SellTokens>,
    token_amount: u64,                // Tokens to sell (raw units)
    min_sol_out: u64,                 // Minimum SOL expected (slippage protection)
) -> Result<()>
```

**Process:**
1. Validates bonding curve is not complete
2. Calculates SOL out and fee
3. Transfers tokens from seller to curve
4. Transfers SOL from vault to seller
5. Updates reserves
6. Emits SellEvent

### Error Codes

```rust
pub enum ErrorCode {
    Unauthorized,              // Not authorized to perform action
    InvalidAmount,             // Amount must be > 0
    SlippageExceeded,         // Price moved too much
    BondingCurveComplete,     // All tokens sold
    InsufficientTokens,       // Not enough tokens in curve
    InsufficientSOL,          // Not enough SOL in curve
}
```

---

## Frontend Integration

### RPC Functions (anchorClient.ts)

#### Initialize Global Config
```typescript
await rpc_initializeGlobalConfig(
  connection,
  wallet,
  200,             // 200 SOL virtual reserves (optimized)
  600_000_000,     // 600M virtual tokens (optimized)
  1_000_000_000,   // 1B initial supply
  100              // 1% fee
);
```

#### Initialize Bonding Curve
```typescript
const mint = new PublicKey("...");
await rpc_initializeBondingCurve(
  connection,
  wallet,
  mint,
  1_000_000_000    // 1B token supply
);
```

#### Buy Tokens
```typescript
await rpc_buyTokens(
  connection,
  wallet,
  mint,
  1.0,             // 1 SOL
  0.01             // 1% slippage tolerance
);
```

#### Sell Tokens
```typescript
await rpc_sellTokens(
  connection,
  wallet,
  mint,
  10_000_000,      // 10M tokens
  0.01             // 1% slippage tolerance
);
```

### UI Component Usage

```tsx
import BondingCurveTrader from "@/components/trading/BondingCurveTrader";

<BondingCurveTrader
  mintAddress="YourTokenMintAddress"
  tokenSymbol="TOKEN"
  tokenName="My Token"
/>
```

### Utility Functions (pumpCurve.ts)

```typescript
// Get current spot price
const price = getSpotPriceSOLPerToken(poolState, curveParams);

// Quote a buy
const { tokensOut, effectivePrice } = quoteBuyTokens(
  poolState,
  curveParams,
  1.0 // SOL amount
);

// Quote a sell
const { solOut, effectivePrice } = quoteSellTokens(
  poolState,
  curveParams,
  10_000_000 // token amount
);

// Calculate price impact
const impact = calculateBuyPriceImpact(poolState, curveParams, 1.0);

// Check completion
const isComplete = isCurveComplete(poolState);

// Get progress
const progress = getProgressPercentage(poolState, 1_000_000_000);
```

---

## Usage Examples

### Complete Workflow

#### Step 1: Admin Initializes Global Config (One-time)

```typescript
// Only needs to be done once by platform admin
import { rpc_initializeGlobalConfig } from "@/lib/anchorClient";

await rpc_initializeGlobalConfig(
  connection,
  adminWallet,
  30,              // 30 SOL virtual reserves
  1_000_000_000,   // 1 billion virtual tokens
  1_000_000_000,   // 1 billion default initial supply
  100              // 1% fee (100 basis points)
);
```

#### Step 2: Creator Creates Token & Bonding Curve

```typescript
// 1. Create the token mint (existing flow)
await rpc_initializeProject(connection, wallet, "My Token", "MTK", ...);
const mint = await rpc_createMint(connection, wallet, "MTK");

// 2. Transfer tokens to bonding curve
// (This should be done in the initialize_bonding_curve instruction)

// 3. Initialize bonding curve
await rpc_initializeBondingCurve(
  connection,
  wallet,
  mint,
  1_000_000_000    // 1 billion tokens
);
```

#### Step 3: Users Trade

```typescript
// User buys tokens
await rpc_buyTokens(
  connection,
  wallet,
  mint,
  0.5,             // Spend 0.5 SOL
  0.01             // 1% slippage
);

// Later, user sells tokens
await rpc_sellTokens(
  connection,
  wallet,
  mint,
  5_000_000,       // Sell 5M tokens
  0.01             // 1% slippage
);
```

---

## Deployment Instructions

### Prerequisites

1. **Rust & Anchor**
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Install Solana CLI
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   
   # Install Anchor
   cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli
   ```

2. **Node.js & npm**
   ```bash
   # Install Node.js (v18+)
   # Visit https://nodejs.org/ or use nvm
   ```

### Build & Deploy Smart Contract

```bash
# Navigate to project root
cd /Users/dannyzirko/fundly.site

# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Or deploy to mainnet-beta
anchor deploy --provider.cluster mainnet-beta
```

### Update Frontend IDL

```bash
# Copy the generated IDL to frontend
cp target/idl/fundly.json frontend/src/idl/fundly.json
```

### Initialize Global Config

```bash
# Run initialization script (create this script)
cd frontend
npx ts-node scripts/init-global-config.ts
```

Example script:
```typescript
// scripts/init-global-config.ts
import { Connection, Keypair } from "@solana/web3.js";
import { rpc_initializeGlobalConfig } from "../src/lib/anchorClient";

const connection = new Connection("https://api.devnet.solana.com");
const adminKeypair = Keypair.fromSecretKey(/* load from file */);

const wallet = {
  publicKey: adminKeypair.publicKey,
  signTransaction: async (tx) => {
    tx.sign(adminKeypair);
    return tx;
  },
  signAllTransactions: async (txs) => {
    txs.forEach(tx => tx.sign(adminKeypair));
    return txs;
  },
};

await rpc_initializeGlobalConfig(
  connection,
  wallet,
  200,             // 200 SOL virtual (optimized)
  600_000_000,     // 600M virtual tokens (optimized)
  1_000_000_000,   // 1B initial supply
  100              // 1% fee
);

console.log("Global config initialized!");
```

### Deploy Frontend

```bash
cd frontend
npm install
npm run build
# Deploy to Vercel, Netlify, or your hosting provider
```

---

## Testing Guide

### Local Testing Setup

```bash
# Start local validator
solana-test-validator

# In another terminal, deploy to localnet
anchor build
anchor deploy

# Initialize global config (localnet)
# Run init script against localhost
```

### Unit Tests (Rust)

```bash
# Run Anchor tests
anchor test
```

Example test:
```rust
#[tokio::test]
async fn test_buy_tokens() {
    // Setup
    let program = /* init program */;
    let bonding_curve = /* create curve */;
    
    // Buy tokens
    let result = program
        .buy_tokens(1_000_000_000, 0)
        .await;
    
    assert!(result.is_ok());
}
```

### Integration Tests (TypeScript)

Create `frontend/tests/bonding-curve.test.ts`:

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { rpc_buyTokens, rpc_sellTokens } from "../src/lib/anchorClient";

describe("Bonding Curve", () => {
  it("should buy tokens correctly", async () => {
    // Setup
    const connection = new Connection("http://localhost:8899");
    const wallet = /* mock wallet */;
    const mint = /* test mint */;
    
    // Execute
    const result = await rpc_buyTokens(connection, wallet, mint, 1.0, 0.01);
    
    // Assert
    expect(result).toBeDefined();
  });
});
```

---

## FAQ

### Q: How do I set the initial price?

**A:** The initial price is determined by the ratio of virtual reserves:

```
initial_price = virtual_sol / virtual_token
```

Examples:
- **Old**: 30 SOL virtual / 1B tokens virtual = 0.00000003 SOL per token (too cheap!)
- **Optimized**: 200 SOL virtual / 600M tokens virtual = 0.000000333 SOL per token (11x higher)

**Pro Tip**: Higher virtual SOL and lower virtual tokens = higher initial price and slower buying curve

### Q: What happens when the curve completes?

**A:** When `real_token_reserves` reaches 0:
1. The `complete` flag is set to `true`
2. No more trades are allowed on the curve
3. The token should be migrated to a DEX for continued trading
4. The accumulated SOL can be used as initial liquidity

### Q: How do I adjust the fee?

**A:** The fee is set in the GlobalConfig during initialization:

```typescript
fee_basis_points: 100  // 1%
fee_basis_points: 50   // 0.5%
fee_basis_points: 200  // 2%
```

### Q: Can I change the virtual reserves after initialization?

**A:** No, virtual reserves are immutable once set. They provide consistency for price calculations throughout the curve's lifetime.

### Q: How do I prevent front-running?

**A:** Use slippage protection:

```typescript
// Set minimum tokens you're willing to accept
await rpc_buyTokens(connection, wallet, mint, 1.0, 0.01);
                                                    // ^^^^ 1% slippage
```

If the actual price moves more than 1%, the transaction will fail.

### Q: What's the maximum price impact I should allow?

**A:** General guidelines:
- < 1%: Low impact (ideal)
- 1-3%: Moderate impact (acceptable)
- 3-5%: High impact (caution)
- \> 5%: Very high impact (consider smaller trade)

### Q: How do I handle decimal places?

**A:** 
- **SOL**: 1 SOL = 1,000,000,000 lamports (9 decimals)
- **Tokens**: Using 6 decimals, 1 token = 1,000,000 raw units
- Always convert to raw units for on-chain operations
- Convert back to decimals for UI display

### Q: Can I modify the bonding curve formula?

**A:** Yes, but be careful:
1. Edit the calculation logic in `buy_tokens` and `sell_tokens` instructions
2. Update the frontend math in `pumpCurve.ts` to match
3. Thoroughly test all edge cases
4. Consider security audits before production use

---

## Summary

You now have a complete pump.fun-style bonding curve system with:

✅ **Smart Contracts**: Rust/Anchor programs with buy/sell logic  
✅ **Frontend Integration**: TypeScript RPC functions and React components  
✅ **Math Library**: Client-side calculations for quotes and price impact  
✅ **Trading UI**: Beautiful, responsive trading interface  
✅ **Documentation**: Complete guide for usage and deployment  

The system is production-ready and can be deployed to Solana mainnet after thorough testing and security audits.

Happy trading! 🚀

