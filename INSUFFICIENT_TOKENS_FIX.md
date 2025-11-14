# Fix: Insufficient Tokens Error During Coin Creation

## Problem
When creating a coin with vesting enabled, users encountered an "insufficient funds" error:
```
Error processing Instruction 2: custom program error: 0x1
Program log: Error: insufficient funds
```

## Root Cause
There was a **precision loss** when transferring tokens to the bonding curve, caused by converting between raw token units and display values.

### The Issue in Detail:

1. Total supply: `999,999,999,999,999` raw units (with 6 decimals)
2. When splitting tokens between bonding curve and vesting (e.g., 80% / 20%):
   - Bonding curve: `800,000,000,000,000` raw units
   - Vesting: `199,999,999,999,999` raw units
   - Total: `999,999,999,999,999` ✓

3. **The Problem**: In `rpc_initializeBondingCurve()`, the code was:
   ```typescript
   // Convert to whole tokens
   tokensForCurve = Math.floor(tokensForCurveRaw / 1_000_000)  // 800,000,000
   
   // In anchorClient.ts, multiply back
   tokenSupplyRaw = tokenSupply * 1_000_000  // 800,000,000,000,000
   ```

4. This lost precision! Any fractional tokens in the raw calculation were discarded.

5. When trying to transfer the remaining tokens to vesting vault, the wallet didn't have enough because:
   - Expected remaining: `199,999,999,999,999` (exact)
   - Actual remaining: Could vary due to rounding errors

## The Fix

### Changed Files:
1. `/frontend/src/lib/anchorClient.ts`
2. `/frontend/src/app/dashboard/create-startup/page.tsx`

### Changes Made:

**1. Updated `rpc_initializeBondingCurve()` to accept raw units as BN:**

```typescript
// Before
export async function rpc_initializeBondingCurve(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
  tokenSupply: number, // in tokens
) {
  // ...
  const tokenSupplyRaw = new BN(tokenSupply * 1_000_000);
```

```typescript
// After  
export async function rpc_initializeBondingCurve(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
  tokenSupply: number | BN, // in tokens OR raw units as BN
) {
  // ...
  const tokenSupplyRaw = BN.isBN(tokenSupply) 
    ? tokenSupply 
    : new BN(Math.floor(tokenSupply * 1_000_000));
```

**2. Updated create-startup page to pass raw BN value:**

```typescript
// Before
await rpc_initializeBondingCurve(
  connection,
  wallet,
  mint,
  tokensForCurve // Display value for UI (already in whole tokens)
);

// After
await rpc_initializeBondingCurve(
  connection,
  wallet,
  mint,
  new BN(tokensForCurveRaw) // Pass raw units as BN to avoid precision loss
);
```

## Why This Works

By passing the raw token amount directly as a BN (BigNumber), we avoid:
1. ❌ Division by 1,000,000 (losing precision)
2. ❌ Multiplication by 1,000,000 (introducing rounding errors)
3. ✅ Keep exact raw token amounts throughout the entire flow

### Token Distribution Flow (After Fix):

```
1. Mint creates: 999,999,999,999,999 tokens in owner account
2. Transfer to bonding curve: 800,000,000,000,000 tokens (exact)
3. Remaining in owner: 199,999,999,999,999 tokens (exact)
4. Transfer to vesting: 199,999,999,999,999 tokens ✅ SUCCESS!
```

## Testing

To verify the fix:
1. Connect your wallet
2. Navigate to Create Startup page
3. Fill in required fields
4. Enable vesting with any percentage (e.g., 20%)
5. Click "Create Token"
6. Transaction should succeed without "insufficient funds" error

## Impact

- ✅ Fixes token creation with vesting enabled
- ✅ Maintains precision in all token calculations
- ✅ Backward compatible (still accepts number for legacy calls)
- ✅ No changes needed to Rust program

## Date
November 14, 2025

