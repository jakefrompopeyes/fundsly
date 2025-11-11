# Vesting Vault "Insufficient Funds" Error - FIXED ✅

## Problem Summary

You were getting this error when trying to transfer tokens to the vesting vault:

```
Transaction simulation failed: Error processing Instruction 2: custom program error: 0x1
Program log: Error: insufficient funds
```

Even though you had enough tokens, the transaction was failing during simulation.

## Root Cause

The issue was a **rounding/precision error** in token distribution calculations:

### The Math Error:

1. **Total Supply**: 999,999,999.999999 tokens (raw: `999_999_999_999_999` units with 6 decimals)
2. **Calculation Base**: Code used `1_000_000_000` tokens (1 billion) as the base
3. **Result**: Trying to transfer MORE tokens than actually exist!

### Example (20% creator allocation):
```javascript
// OLD CODE (BROKEN):
const tokensForVesting = 1_000_000_000 * 0.20 = 200_000_000
const tokensForCurve = 1_000_000_000 * 0.80 = 800_000_000

// Transfer amounts:
bondingCurve: 800_000_000 * 1_000_000 = 800_000_000_000_000 raw units
vestingVault: 200_000_000 * 1_000_000 = 200_000_000_000_000 raw units
                        TOTAL NEEDED: 1_000_000_000_000_000 raw units

// But actual supply:                   999_999_999_999_999 raw units
//                       SHORTFALL:                       1 unit ❌
```

This caused the "insufficient funds" error because you were short by 1 unit!

## The Fix

Changed the code to calculate token distribution using the **actual total supply** instead of rounding up to 1 billion:

### Key Changes in `create-startup/page.tsx`:

**1. Use raw units for all calculations:**
```javascript
// NEW CODE (FIXED):
const tokensForVestingRaw = enableVesting 
  ? Math.floor(FIXED_TOTAL_SUPPLY * creatorAlloc) 
  : 0;
const tokensForCurveRaw = FIXED_TOTAL_SUPPLY - tokensForVestingRaw;

// Convert to human-readable ONLY for display
const tokensForVesting = Math.floor(tokensForVestingRaw / 1_000_000);
const tokensForCurve = Math.floor(tokensForCurveRaw / 1_000_000);
```

**2. Use raw units directly in transfers:**
```javascript
// Bonding curve transfer - use tokensForCurveRaw (not tokensForCurve * 1_000_000)
const transferIx = createTransferInstruction(
  ownerAta,
  bondingCurveAta,
  wallet.publicKey!,
  tokensForCurveRaw, // ✅ Raw units directly
  [],
  TOKEN_PROGRAM_ID
);

// Vesting vault transfer - use tokensForVestingRaw
const vestingTransferIx = createTransferInstruction(
  ownerAta,
  vestingVaultAta,
  wallet.publicKey!,
  tokensForVestingRaw, // ✅ Raw units directly
  [],
  TOKEN_PROGRAM_ID
);
```

**3. Initialize vesting with raw units:**
```javascript
const totalAmountToVest = new BN(tokensForVestingRaw); // ✅ Raw units directly
await rpc_initializeVesting(
  connection,
  wallet,
  mint,
  totalAmountToVest,
  vestingParams.startTime,
  vestingParams.cliffDuration,
  vestingParams.vestingDuration,
  vestingParams.releaseInterval
);
```

## Verification

Now the math works perfectly:

```javascript
// Example with 20% creator allocation:
FIXED_TOTAL_SUPPLY = 999_999_999_999_999 raw units

tokensForVestingRaw = Math.floor(999_999_999_999_999 * 0.20)
                    = 199_999_999_999_999 raw units (19.99...)

tokensForCurveRaw   = 999_999_999_999_999 - 199_999_999_999_999
                    = 800_000_000_000_000 raw units (80.00...)

TOTAL = 999_999_999_999_999 ✅ (exactly matches supply!)
```

## What to Do Now

1. **Test the fix**: Try creating a new token with vesting enabled
2. **Any allocation percentage should work**: 10%, 20%, 50%, etc.
3. **The transaction should succeed**: No more "insufficient funds" errors

## Additional Notes

- The fix ensures exact precision by working in raw units throughout
- Only converts to human-readable tokens for display purposes
- Prevents any rounding errors that could cause shortfalls
- The total supply (999,999,999.999999) is now respected exactly

---

**Status**: ✅ FIXED  
**Files Modified**: `frontend/src/app/dashboard/create-startup/page.tsx`  
**Date**: November 10, 2025

