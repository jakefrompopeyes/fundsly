# Troubleshooting Guide - Token Display Issues

## Issues Fixed ✅

This guide addresses the following issues:
- ❌ Market Cap showing "Not available"
- ❌ Raydium Status showing "No bonding curve"
- ❌ No charting data available
- ❌ "Trying to access beyond buffer length" error

## What Was Changed

### 1. Enhanced Error Logging (`anchorClient.ts`)

**Metadata Parsing:**
- Added mint address to all error messages for easier debugging
- Added detailed buffer size and offset information
- Better identification of which token has corrupted metadata

**Bonding Curve Fetching:**
- Added explicit error handling for missing bonding curves
- Distinguishes between "account doesn't exist" vs other errors
- Logs which tokens don't have bonding curves initialized

### 2. Improved Error Handling (`BondingCurveTrader.tsx`)

**User-Friendly Messages:**
- Shows clear message when bonding curve isn't initialized
- Explains that the creator needs to call "Initialize Bonding Curve"
- Clears stale data on errors to prevent UI confusion

### 3. Better Error Recovery (`trade/[mint]/page.tsx`)

**Graceful Degradation:**
- Continues loading even if metadata fetch fails
- Shows fallback symbol/name if metadata is unavailable
- Distinguishes between expected errors (no bonding curve) vs unexpected errors

### 4. Informative Chart Placeholders (`PriceChart.tsx`)

**Better UX:**
- Shows emoji and helpful message when no data is available
- Explains possible reasons (no trades, bonding curve not initialized, etc.)
- Removes confusion about why chart is empty

## Understanding the Errors

### "Market Cap: Not available"

**Cause:** The token's bonding curve hasn't been initialized yet.

**Explanation:**
1. Token creation has two steps:
   - `InitializeProject` + `CreateMint` → Creates the token
   - `InitializeBondingCurve` → Makes it tradeable
   
2. If only step 1 was completed, the token exists but has no bonding curve
3. Without a bonding curve, there's no price data, so market cap can't be calculated

**Solution:**
```bash
# For token creators - initialize the bonding curve:
# 1. Go to your project's admin page
# 2. Click "Initialize Bonding Curve"
# 3. Confirm the transaction
```

### "Raydium Status: No bonding curve"

**Cause:** Same as above - bonding curve not initialized.

**Solution:** Initialize the bonding curve (see above).

### "No charting data available"

**Cause:** One of three reasons:
1. No trades have been made yet (most common)
2. Bonding curve not initialized (no trades possible)
3. Transaction fetching failed (temporary network issue)

**Solution:**
- If bonding curve exists: Make a trade to generate chart data
- If bonding curve missing: Initialize it first
- If network issue: Refresh the page

### "Trying to access beyond buffer length"

**Cause:** One or more tokens have corrupted/malformed metadata accounts.

**Explanation:**
- Metaplex metadata has a specific structure with length fields
- If these length fields are incorrect, the parser tries to read beyond the buffer
- This usually happens if metadata creation was interrupted or used wrong parameters

**Solution:** Use the diagnostic tool to identify which token(s) have bad metadata:

```bash
cd frontend
npx ts-node --project tsconfig.json scripts/diagnose-token-issues.ts
```

The script will show:
- Which tokens have valid metadata ✅
- Which tokens have invalid metadata ⚠️
- Specific error for each problematic token
- Recommendations for fixing issues

## Running Diagnostics

### Quick Check

Open your browser console (F12) and look for:

```
Invalid metadata for <mint_address>: <specific_error>
Bonding curve not initialized for mint: <mint_address>
```

These messages now include the mint address, making it easy to identify problem tokens.

### Comprehensive Diagnostics

Run the diagnostic script:

```bash
cd frontend
npx ts-node --project tsconfig.json scripts/diagnose-token-issues.ts
```

**What it checks:**
- ✅ All project accounts
- ✅ Metadata existence and validity
- ✅ Bonding curve existence
- ✅ Provides actionable recommendations

**Example output:**
```
📊 DIAGNOSTIC SUMMARY
═══════════════════════════════════════════

✅ Tokens OK: 5
⚠️  Tokens with issues: 2

Tokens with issues:

🔴 ABC123...XYZ789
   - Metadata invalid: name length 999 exceeds buffer
   
🔴 DEF456...UVW012
   - Bonding curve missing

💡 RECOMMENDATIONS
═══════════════════════════════════════════

⚠️  1 token(s) have invalid metadata:
   → The metadata accounts exist but contain malformed data
   → This is causing the "Trying to access beyond buffer length" error
   → These tokens need to be recreated or metadata needs to be fixed
      - ABC123...XYZ789

📈 1 token(s) missing bonding curves:
   → These tokens have projects but InitializeBondingCurve was never called
   → Call InitializeBondingCurve for these tokens to enable trading
```

## Common Scenarios

### Scenario 1: Just Created a Token

**Expected behavior:**
- ✅ Token appears in market
- ⚠️  Shows "No bonding curve"
- ⚠️  Shows "Market Cap: Not available"
- ⚠️  Shows "No charting data"

**Next steps:**
1. Initialize the bonding curve
2. All warnings will disappear

### Scenario 2: Token Has Trades

**Expected behavior:**
- ✅ Token appears in market
- ✅ Shows market cap
- ✅ Shows "Not Migrated" status
- ✅ Shows price chart with data

**If not working:**
- Check browser console for errors
- Run diagnostic script
- Verify RPC connection is working

### Scenario 3: Legacy Tokens

**If you have old tokens with issues:**
1. Run diagnostic script to identify problems
2. For tokens with invalid metadata:
   - Option A: Recreate the token properly
   - Option B: Filter them out from the UI
3. For tokens missing bonding curves:
   - Initialize bonding curves
   - Or mark them as "not tradeable" in UI

## Prevention

To avoid these issues in the future:

### When Creating Tokens

```typescript
// Step 1: Create project and mint
await rpc_initializeProject(...)
const mint = await rpc_createMint(...)

// Step 2: IMMEDIATELY initialize bonding curve
await rpc_initializeBondingCurve(...)

// Now your token is fully ready!
```

### Error Handling Pattern

```typescript
try {
  const bondingCurve = await fetchBondingCurve(connection, wallet, mint);
  // Use bonding curve data
} catch (error) {
  if (error?.message?.includes('Account does not exist')) {
    // Handle gracefully - show "Initialize bonding curve" button
  } else {
    // Real error - log and show error message
    console.error('Unexpected error:', error);
  }
}
```

## Still Having Issues?

### Check Your Environment

```bash
# Verify RPC connection
curl $NEXT_PUBLIC_SOLANA_RPC_URL -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Should return: {"jsonrpc":"2.0","result":"ok","id":1}
```

### Verify Program Deployment

```bash
# Check if program is deployed
solana program show <PROGRAM_ID>
```

### Check Account Data

```bash
# Check a specific mint's metadata
solana account <METADATA_PDA>

# Check bonding curve account  
solana account <BONDING_CURVE_PDA>
```

## Quick Fixes

### Fix 1: Clear Problematic Tokens from Market Page

If you want to temporarily hide tokens with issues:

```typescript
// In market/page.tsx
const validProjects = projects.filter(project => {
  // Filter out tokens without bonding curves if desired
  return project.bondingCurve !== undefined;
});
```

### Fix 2: Add Retry Logic

For transient network issues:

```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Fix 3: Add Token Validation

Before displaying tokens:

```typescript
function isTokenValid(project: Project): boolean {
  return (
    project.account.mint &&
    !project.account.mint.equals(PublicKey.default) &&
    project.bondingCurve !== undefined
  );
}
```

## Summary

The fixes provide:
1. ✅ Better error messages with context
2. ✅ Graceful handling of missing bonding curves
3. ✅ Clear user feedback about issues
4. ✅ Diagnostic tool to identify problems
5. ✅ Prevention guidance for new tokens

All tokens should now display correctly, and any issues will be clearly explained to users rather than showing cryptic errors.


