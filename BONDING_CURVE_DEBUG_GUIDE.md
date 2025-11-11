# Bonding Curve "Insufficient Tokens" Error - Debug Guide

## Problem
You're getting this error when trying to buy tokens:
```
AnchorError thrown in programs/fundly/src/lib.rs:202. 
Error Code: InsufficientTokens. 
Error Number: 6004. 
Error Message: Insufficient tokens in bonding curve.
```

## What This Means
The bonding curve doesn't have enough tokens in its `real_token_reserves` to fulfill your buy order. This check happens at line 313 in `lib.rs`:

```rust
require!(tokens_out <= real_token, ErrorCode::InsufficientTokens);
```

## Common Causes

### 1. Bonding Curve Not Properly Funded
When you create a startup, the flow should be:
1. ✅ Initialize project
2. ✅ Create mint (mints tokens to your wallet)
3. ✅ Initialize bonding curve (creates the curve account)
4. ⚠️ **Transfer tokens to bonding curve** - THIS STEP MIGHT HAVE FAILED

If step 4 failed or wasn't completed, the bonding curve has 0 tokens even though it was initialized.

### 2. Most Tokens Already Sold
If the bonding curve has been heavily traded, most tokens may have been sold already, leaving insufficient tokens for large purchases.

### 3. Misconfigured Virtual Reserves
If virtual reserves are set too high relative to real reserves, even small purchases will try to extract more tokens than available.

## How to Debug

### Step 1: Run the Debug Script

```bash
cd /Users/dannyzirko/fundly.site
node scripts/debug-bonding-curve.js <YOUR_MINT_ADDRESS>
```

Replace `<YOUR_MINT_ADDRESS>` with the mint address of the token you're trying to buy.

### Step 2: Review the Output

The script will show you:
- ✅ Global config settings (virtual reserves, fees, etc.)
- ✅ Current bonding curve state
- ✅ Simulation of what happens when you buy 10 SOL
- ✅ Whether there are enough tokens to fulfill the trade
- ✅ Actual token account balance vs bonding curve state

### Step 3: Identify the Issue

Look for these red flags:

#### 🚨 Red Flag 1: Zero Real Tokens
```
Real Tokens: 0 tokens
```
**Solution**: The bonding curve was never funded. You need to transfer tokens to it.

#### 🚨 Red Flag 2: Balance Mismatch
```
⚠️  WARNING: Account balance doesn't match bonding curve state!
   State says: 800000000 tokens
   Account has: 0 tokens
```
**Solution**: The bonding curve state is out of sync. This is a critical error.

#### 🚨 Red Flag 3: Not Enough Tokens
```
❌ ERROR: Not enough tokens in bonding curve!
   Shortfall: 446616542 tokens
```
**Solution**: Need to add more tokens or wait for sell orders to replenish the supply.

## Solutions

### Solution 1: Fund the Bonding Curve (If Never Funded)

If the bonding curve was never funded with tokens, you need to transfer them:

```typescript
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";

// Your setup here...
const mint = new PublicKey("YOUR_MINT");
const bondingCurvePda = await deriveBondingCurvePda(mint);

// Get token accounts
const ownerAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
const bondingCurveAta = await getAssociatedTokenAddress(mint, bondingCurvePda, true);

// Transfer tokens (e.g., 800M tokens = 800,000,000 * 1e6)
const amount = 800_000_000 * 1_000_000;
const transferIx = createTransferInstruction(
  ownerAta,
  bondingCurveAta,
  wallet.publicKey,
  amount
);

const tx = new Transaction().add(transferIx);
// Send and confirm transaction...
```

### Solution 2: Adjust Virtual Reserves (If Misconfigured)

If virtual reserves are set incorrectly, update the global config:

```bash
# Check current config
node scripts/check-global-config.js

# Update if needed (requires admin authority)
node scripts/update-global-config.js
```

**Recommended Settings for pump.fun-style curve:**
- Virtual SOL: 30 SOL (30 * 1e9 lamports)
- Virtual Tokens: 1,000,000,000 tokens (1e9 * 1e6 raw units)
- Real Tokens in Curve: 800,000,000 tokens (80% of supply)
- Fee: 100 basis points (1%)

### Solution 3: Try Smaller Buy Amount

If the curve has low liquidity, try buying less:
- Instead of 10 SOL, try 1 SOL
- Or 0.1 SOL for testing

Large purchases have high price impact and require more tokens from the curve.

## What I Fixed

I also fixed a bug in the frontend code where the fee calculation wasn't matching the Rust program:

### Before (WRONG):
```typescript
function calculateBuyTokensOut(bondingCurve: any, solAmountLamports: number): number {
  // ... used full solAmountLamports without deducting fee
  const totalSolAfter = totalSolBefore + solAmountLamports;
  // ...
}
```

### After (CORRECT):
```typescript
function calculateBuyTokensOut(bondingCurve: any, solAmountLamports: number, feeBasisPoints: number): number {
  // Calculate fee first
  const fee = Math.floor((solAmountLamports * feeBasisPoints) / 10000);
  const solAfterFee = solAmountLamports - fee;
  
  // Use solAfterFee in calculation (matches Rust implementation)
  const totalSolAfter = totalSolBefore + solAfterFee;
  // ...
}
```

This ensures the frontend calculations match exactly what happens on-chain.

## Testing the Fix

After addressing the issue:

1. **Run the debug script again** to verify the fix:
   ```bash
   node scripts/debug-bonding-curve.js <MINT_ADDRESS>
   ```

2. **Try a small test purchase** (0.1 SOL):
   - Go to `/dashboard/trade/<MINT_ADDRESS>`
   - Try buying with 0.1 SOL first
   - If successful, try larger amounts

3. **Monitor the bonding curve state** as trades execute

## Prevention for Future Tokens

When creating new tokens, ensure the full flow completes:

1. Initialize project ✅
2. Create mint ✅
3. Initialize bonding curve ✅
4. **Transfer tokens to bonding curve** ✅ ← Don't skip this!
5. (Optional) Set up vesting

The create-startup page should handle this automatically, but if you're creating tokens manually, don't forget step 4.

## Need More Help?

If the debug script shows everything is correct but you're still getting the error:

1. Check Solana Explorer for your mint address
2. Verify the bonding curve token account has tokens
3. Check recent transactions for any failed transfers
4. Review program logs for more details

You can also check the bonding curve account directly:
```bash
solana account <BONDING_CURVE_PDA> -u devnet
```

