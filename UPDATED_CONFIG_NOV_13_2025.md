# Configuration Update - November 13, 2025

## Changes Applied ✅

### Global Configuration Updates

The following parameters have been updated in the global config:

| Parameter | Previous Value | New Value |
|-----------|---------------|-----------|
| Virtual SOL Reserves | 30 SOL | **40 SOL** |
| Virtual Token Reserves | 350,000,000 | **150,000,000** |
| Initial Token Supply | 1,000,000,000 | **1,000,000,000** (unchanged) |
| Migration Threshold | 84 SOL | 84 SOL (unchanged) |
| Fee Basis Points | 100 (1%) | 100 (1%) (unchanged) |

### Transaction Details

- **Transaction Signature**: `S672NkuE7gDyNwc7KKwAVbuavfZxjqHEJk5Q6YzDDGVjkQGQmWUorXGi8jLS6V5MeHQrBPAJ3ttzh5apD3E9gWp`
- **Explorer Link**: [View on Solana Explorer](https://explorer.solana.com/tx/S672NkuE7gDyNwc7KKwAVbuavfZxjqHEJk5Q6YzDDGVjkQGQmWUorXGi8jLS6V5MeHQrBPAJ3ttzh5apD3E9gWp?cluster=devnet)
- **Network**: Devnet
- **Global Config PDA**: `DvbBvpZFKPBGnnB6KtyhnxKwt62BjGoqRPFn81u96ZTF`

## Token Distribution Model

### Per-Startup Token Allocation

Each startup token will have the following distribution:

- **Total Supply**: 1,000,000,000 tokens (1 billion)
- **Creator Vesting Allocation**: 200,000,000 tokens (20%) - **DEFAULT**
- **Bonding Curve Supply**: 800,000,000 tokens (80%)

### How Vesting Works

1. When creating a startup, the **Creator Allocation** slider is now set to **20% by default**
2. This means:
   - 200M tokens go into a vesting vault (locked, released over time)
   - 800M tokens go to the bonding curve (immediately tradeable)
3. Creators can adjust this percentage when creating their startup

### Vesting Schedule (Default: Standard 12 Month)

- **Cliff Period**: 30 days (no tokens unlock)
- **Vesting Duration**: 12 months total
- **Release Interval**: Monthly (every 30 days)
- After cliff, tokens unlock gradually each month

## Impact on Bonding Curve Pricing

### Price Formula

The bonding curve uses the constant product formula:

```
price = (virtual_sol + real_sol) / (virtual_tokens + real_tokens)
```

### With New Parameters (40 SOL / 150M tokens):

- **Initial Price** (0 SOL raised):
  ```
  price = 40 / 150,000,000 = 0.000000267 SOL per token
  ```

- **After 10 SOL raised** (example):
  ```
  With k = 40 × 150,000,000 = 6,000,000,000
  Tokens sold ≈ some amount
  New price = (40 + 10) / (150,000,000 - tokens_sold)
  ```

### Comparison with Previous Config (30 SOL / 350M tokens):

| Metric | Previous | New | Change |
|--------|----------|-----|--------|
| Initial Price | 30/350M = 0.0000000857 SOL | 40/150M = 0.000000267 SOL | **+211% higher** |
| Price Growth Rate | Slower (more tokens) | Faster (fewer tokens) | **Steeper curve** |
| Liquidity Feel | More tokens = smoother | Fewer tokens = aggressive | **More volatile** |

**Key Insights:**
- Starting price is **3.1x higher** than before
- Price will increase **faster** as tokens are bought
- Bonding curve will feel more "aggressive" and reach migration threshold quicker
- Good for creating more dynamic price discovery

## Migration System

- **Migration Threshold**: 84 SOL (unchanged)
- When a bonding curve reaches 84 SOL in real reserves:
  - Automatic migration to Raydium DEX
  - Liquidity pool created with accumulated SOL
  - Token becomes freely tradeable on DEX

## Files Modified

1. **`scripts/update-global-config.js`**
   - Updated configuration constants
   - Enhanced output to show token distribution
   
2. **`frontend/src/app/dashboard/create-startup/page.tsx`**
   - Changed default `creatorAllocationPercent` from 0% to 20%
   - This ensures new startups default to your desired 200M vesting allocation

## Testing Recommendations

### 1. Create a Test Startup
```bash
# Go to: http://localhost:3000/dashboard/create-startup
# Verify:
# - Creator Allocation defaults to 20%
# - Shows "200,000,000 tokens" in vesting vault
# - Shows "800,000,000 tokens" for bonding curve
```

### 2. Test Bonding Curve Pricing
- Buy tokens and observe the price curve
- Should increase faster than before
- Higher initial price (0.000000267 SOL per token)

### 3. Test Migration
- Buy tokens until reaching 84 SOL
- Verify automatic migration triggers
- Check Raydium pool creation

## Quick Reference Commands

### View Current Config
```bash
node scripts/check-global-config.js
```

### Update Config Again (if needed)
```bash
# Edit values in scripts/update-global-config.js
node scripts/update-global-config.js
```

### Test Bonding Curve
```bash
node scripts/debug-bonding-curve.js
```

### Test Migration Flow
```bash
node scripts/test-full-migration-flow.js
```

## Notes

- Virtual reserves affect bonding curve pricing, not actual token distribution
- The 200M vesting tokens are **per startup**, not a global parameter
- Each startup creator can still adjust their allocation (0-100%)
- Default is now 20% to match your requirements
- Bonding curve pricing is more aggressive with these new parameters

## Next Steps

1. ✅ Configuration updated successfully
2. 🧪 Test creating a new startup with default 20% vesting
3. 📈 Test bonding curve trading with new pricing
4. 🚀 Monitor migration when reaching 84 SOL threshold
5. 🔄 Adjust parameters if needed based on testing

---

**Configuration Active**: ✅ Live on Devnet
**Status**: Ready for testing
**Updated**: November 13, 2025

