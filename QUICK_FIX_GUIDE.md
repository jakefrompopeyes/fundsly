# Quick Fix Guide - 3 Steps to Resolve Token Issues

## 🚀 Just want to fix it? Follow these 3 steps:

### Step 1: Run Diagnostics (30 seconds)

```bash
./diagnose.sh
```

Or manually:

```bash
cd frontend
npx ts-node --project tsconfig.json scripts/diagnose-token-issues.ts
```

**What this does:**
- Scans all your tokens
- Identifies which ones have issues
- Tells you exactly what's wrong

### Step 2: Look at the Output

You'll see something like:

```
✅ Tokens OK: 5
⚠️  Tokens with issues: 2

Tokens with issues:

🔴 ABC123...XYZ789
   - Metadata invalid: name length 999 exceeds buffer
   
🔴 DEF456...UVW012
   - Bonding curve missing
```

### Step 3: Fix Based on Issue Type

#### Issue Type A: "Bonding curve missing"

**Quick Fix:**
1. Open your app
2. Go to the token's page
3. Initialize the bonding curve

**Why this happened:**
- Token was created but bonding curve setup was skipped
- Need to complete the setup

**Result after fix:**
- ✅ Market Cap will show
- ✅ Raydium Status will show "Not Migrated"
- ✅ Trading will be enabled

---

#### Issue Type B: "Metadata invalid"

**Quick Fix Option 1 - Filter it out:**

In `frontend/src/app/dashboard/market/page.tsx`, add:

```typescript
// After fetching all projects, filter valid ones:
const validProjects = allProjects.filter(project => {
  // Only show tokens with valid bonding curves
  return project.bondingCurve !== undefined;
});

// Then use validProjects instead of allProjects
```

**Quick Fix Option 2 - Recreate the token:**
1. Note the token details
2. Create a new token with the same info
3. Make sure to initialize bonding curve right away

**Why this happened:**
- Metadata creation was interrupted or used wrong parameters
- Metadata account has corrupted data

**Result after fix:**
- ✅ No more buffer errors
- ✅ Token displays correctly

---

## That's It! 🎉

After fixing, you should see:

### Working Token Shows:
- ✅ Market Cap: $XXX.XX
- ✅ Raydium Status: Not Migrated (or Migrated)
- ✅ Chart with trading data (after first trade)
- ✅ No console errors

### Token Without Bonding Curve Shows:
- ℹ️ Market Cap: Not available
- ℹ️ Raydium Status: No bonding curve
- ℹ️ Clear message explaining what to do
- ✅ No console errors

---

## Prevention Checklist

When creating new tokens, always do **BOTH** steps:

```
✅ Step 1: Create Token
   - InitializeProject
   - CreateMint
   
✅ Step 2: Initialize Bonding Curve  ← Don't skip this!
   - InitializeBondingCurve
```

---

## Still Seeing Errors?

### Check Your Console (F12)

Look for messages like:
```
Invalid metadata for GxYz...: name length 999 exceeds buffer
```

The mint address is now shown in every error message!

### Check Your RPC Connection

```bash
curl $NEXT_PUBLIC_SOLANA_RPC_URL -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

Should return: `{"jsonrpc":"2.0","result":"ok","id":1}`

---

## One-Liner Quick Fixes

### Hide All Tokens Without Bonding Curves

In `market/page.tsx`:
```typescript
const displayProjects = projects.filter(p => p.bondingCurve);
```

### Add Retry for Network Issues

In `anchorClient.ts`:
```typescript
// Wrap fetch calls with retry logic (see TROUBLESHOOTING_GUIDE.md)
```

### Identify Bad Token Quickly

In browser console:
```javascript
// Replace with your mint address
const mint = new PublicKey('YOUR_MINT_HERE');
const metadata = await fetchTokenMetadata(connection, mint);
console.log(metadata); // null = problem
```

---

## What Changed in the Code?

All error messages now include:
- 🔍 Mint address of problematic token
- 🔍 Specific error details (buffer size, offset, etc.)
- 🔍 Clear distinction between expected vs unexpected errors

UI now shows:
- ℹ️ Helpful messages instead of blank errors
- ℹ️ Explanations of what to do next
- ℹ️ Clear indication when bonding curve is missing

---

## Reference Documents

- **FIXES_SUMMARY.md** - What was fixed and why
- **TROUBLESHOOTING_GUIDE.md** - Detailed explanations and solutions
- **This file** - Quick 3-step fix

---

## Summary

1. Run `./diagnose.sh`
2. See which tokens have issues
3. Fix bonding curves OR filter bad tokens

**Time to fix:** 5-10 minutes

**Benefit:** All tokens display correctly with clear error messages

Done! 🎉
