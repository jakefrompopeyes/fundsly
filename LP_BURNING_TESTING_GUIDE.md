# LP Burning - Complete Testing Guide

## 🎯 Overview

This guide walks you through testing the complete LP burning flow on devnet. Follow these steps carefully to ensure everything works before deploying to mainnet.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js and npm installed
- [ ] Solana CLI installed (`solana --version`)
- [ ] Anchor CLI installed (`anchor --version`)
- [ ] Devnet SOL in your wallet (get from faucet)
- [ ] Git repository up to date
- [ ] All dependencies installed (`npm install`)

---

## 🚀 Phase 1: Build and Deploy

### Step 1: Build the Program

```bash
cd /Users/dannyzirko/fundly.site
anchor build
```

**Expected output:** Program builds successfully with warnings (not errors)

### Step 2: Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

**Expected output:**
```
Program Id: 5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK
Deploy success
```

### Step 3: Update Frontend IDL

```bash
cp target/idl/fundly.json frontend/src/idl/fundly.json
cp target/types/fundly.ts frontend/src/idl/fundly.ts
```

### Step 4: Initialize Global Config (if not already done)

```bash
npx ts-node scripts/init-global-config-with-migration.ts
```

**Expected output:**
- Global config initialized
- Migration threshold set to 85 SOL (or your chosen value)
- Fee basis points set to 100 (1%)

---

## 🎨 Phase 2: Create Test Token

### Step 1: Start Frontend

```bash
cd frontend
npm run dev
```

### Step 2: Create Token

1. Navigate to http://localhost:3000
2. Connect wallet (ensure on devnet)
3. Go to "Create Startup"
4. Fill in token details:
   - Name: "Test Token LP Burn"
   - Symbol: "TEST"
   - Category: "Technology"
   - Description: "Testing LP burning"
5. Click "Create Token"

**Expected result:**
- Token created successfully
- You receive ~800M tokens (200M in vesting)
- Transaction confirmed

### Step 3: Initialize Bonding Curve

1. Go to "My Startups"
2. Find your token
3. Click "Initialize Bonding Curve"
4. Confirm transaction

**Expected result:**
- Bonding curve initialized
- All tokens transferred to curve
- Can now trade

---

## 💰 Phase 3: Buy to Migration Threshold

### Step 1: Buy Tokens

For devnet testing with 10 SOL threshold (adjust if using 85 SOL):

```bash
# Buy multiple times to reach threshold
1. Buy 2 SOL worth
2. Buy 3 SOL worth
3. Buy 3 SOL worth
4. Buy 2.5 SOL worth (should trigger migration threshold)
```

**Use the UI:**
1. Go to token page
2. Enter SOL amount in buy box
3. Click "Buy Tokens"
4. Confirm wallet transaction

**Watch for:**
- Progress bar filling up
- "X SOL until migration (Y%)" updates
- When threshold reached: "Ready for migration! 🚀"

### Step 2: Verify Migration Ready

**Check UI:**
- Green progress bar (100%)
- "Ready for migration!" message
- Migration button enabled

**Check on-chain:**
```bash
# Using Anchor client or Solana Explorer
# Verify real_sol_reserves >= migration_threshold_sol
```

---

## 🚁 Phase 4: Execute Migration

### Step 1: Trigger Migration

**Option A: Via UI**
1. Click "Migrate to Raydium" button
2. Review 6 SOL migration fee warning
3. Confirm transaction
4. Wait for confirmation

**Option B: Via Script**
```bash
npx ts-node scripts/test-migration.ts <TOKEN_MINT>
```

**Expected result:**
- Transaction succeeds
- 6 SOL sent to treasury
- Remaining SOL + tokens sent to migration vaults
- Bonding curve marked as migrated
- Trading disabled on curve

### Step 2: Verify Migration Vaults

```bash
npx ts-node scripts/create-raydium-pool.ts <TOKEN_MINT>
```

**Expected output:**
```
🔍 Checking migration vault balances...

SOL Vault: [ADDRESS]
  Balance: 4 SOL (if threshold was 10 SOL)

Token Account: [ADDRESS]
  Balance: [REMAINING_TOKENS] tokens

✅ Migration vaults are ready!
```

**Save these addresses!** You'll need them for pool creation.

---

## 🏊 Phase 5: Create Raydium Pool (Manual)

### Important Note

Creating a Raydium pool on devnet is complex. For testing purposes, we'll simulate this step by manually creating token accounts and minting LP tokens.

### Option A: Use Raydium Devnet UI (Recommended)

1. Go to https://raydium.io/ (switch to devnet)
2. Connect wallet
3. Navigate to "Liquidity" → "Create Pool"
4. Select CPMM pool type
5. Enter:
   - Token A: Your token mint
   - Token B: SOL
   - Initial liquidity from migration vaults
6. Create pool
7. **CRITICAL:** Send LP tokens to migration authority

**Migration Authority Address:**
```
Seeds: ["migration_authority"]
Program: 5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK
```

### Option B: Simulate for Testing

For quick testing without actual Raydium pool:

```bash
# Create a fake LP token mint (for testing only!)
spl-token create-token --decimals 6

# Get migration authority address
solana address --keypair migration-authority.json  # (use PDA derivation)

# Create ATA for LP tokens
spl-token create-account <LP_MINT> --owner <MIGRATION_AUTHORITY>

# Mint some LP tokens to migration authority (simulate pool creation)
spl-token mint <LP_MINT> 1000000 <MIGRATION_AUTHORITY_LP_ACCOUNT>
```

**Note:** This is for testing the burn instruction only. In production, actual Raydium pool creation is required.

---

## 🔥 Phase 6: Burn LP Tokens

### Step 1: Verify LP Tokens Exist

```bash
# Check migration authority's LP token balance
spl-token accounts --owner <MIGRATION_AUTHORITY_ADDRESS>
```

**Expected:** Should see LP tokens

### Step 2: Run Burn Script

```bash
npx ts-node scripts/burn-lp-tokens.ts \
  <TOKEN_MINT> \
  <LP_MINT> \
  <RAYDIUM_POOL_ADDRESS> \
  <LP_AMOUNT>
```

**Example:**
```bash
npx ts-node scripts/burn-lp-tokens.ts \
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1 \
  58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2 \
  1000000
```

**Expected output:**
```
🔥 LP Token Burning Tool
========================

Token Mint: [ADDRESS]
LP Token Mint: [ADDRESS]
Raydium Pool: [ADDRESS]
LP Amount to Burn: 1000000

⚠️  WARNING: This action is IRREVERSIBLE!
⚠️  Liquidity will be PERMANENTLY LOCKED!

🔍 Verifying migration status...
✅ Token is migrated and ready for LP burning

📊 LP Token Account Status:
  Address: [ADDRESS]
  Current balance: 1000000 LP tokens
  Expected to burn: 1000000 LP tokens

⚠️  FINAL CONFIRMATION
======================
Continuing in 5 seconds... (Press Ctrl+C to cancel)

🔥 Burning LP tokens...

✅ SUCCESS! LP tokens burned!
Transaction signature: [TX_SIGNATURE]

🔒 Liquidity is now PERMANENTLY LOCKED!
```

### Step 3: Verify on Solscan

Visit: `https://solscan.io/tx/[TX_SIGNATURE]?cluster=devnet`

**Check for:**
- Burn instruction executed
- LP tokens removed from supply
- Event: `LpTokensBurnedEvent`

---

## ✅ Phase 7: Verification

### Check 1: On-Chain State

```typescript
// Check bonding curve state
const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda);

console.log("Migrated:", bondingCurve.migrated); // Should be true
console.log("LP Burned:", bondingCurve.lpBurned); // Should be true
console.log("LP Amount:", bondingCurve.lpBurnedAmount.toString()); // Should match burned amount
```

### Check 2: UI Updates

Visit token page on frontend:

**Expected to see:**
- "🔵 Trading on Raydium DEX" badge
- "🔒 Liquidity Permanently Locked" badge
- "• Rug-pull proof" text
- Migration status: "✅ Migrated to DEX"
- Liquidity status: "🔒 Permanently Locked"

### Check 3: LP Token Supply

```bash
spl-token supply <LP_MINT>
```

**Expected:** Supply decreased by burned amount

### Check 4: Try to Remove Liquidity

Attempt to remove liquidity from the pool (should fail):
- No LP tokens left in migration authority
- Cannot extract funds from pool

---

## 🎯 Success Criteria

All of these should be true:

✅ Program deployed to devnet
✅ Token created and bonding curve initialized
✅ Bought tokens until migration threshold reached
✅ Migration executed successfully
✅ Migration vaults contain SOL and tokens
✅ Raydium pool created (or simulated)
✅ LP tokens minted to migration authority
✅ LP tokens burned successfully
✅ Bonding curve state: `lp_burned = true`
✅ UI shows "Liquidity Permanently Locked"
✅ Event `LpTokensBurnedEvent` emitted
✅ LP token supply decreased
✅ Cannot remove liquidity
✅ Burn details saved to JSON file

---

## 🐛 Troubleshooting

### Issue: "Token has not been migrated yet"

**Solution:** 
- Run migration first: `await rpc_migrateToRaydium(...)`
- Check bonding curve state: `migrated` should be `true`

### Issue: "LP tokens have already been burned"

**Solution:**
- Check bonding curve: `lpBurned` is already `true`
- This token's liquidity is already locked
- Create a new test token

### Issue: "Insufficient LP tokens"

**Solution:**
- Verify LP tokens exist: `spl-token accounts --owner <MIGRATION_AUTHORITY>`
- Check LP token account balance
- Ensure Raydium pool was created correctly

### Issue: "LP token account not found"

**Solution:**
- Create associated token account for LP tokens
- Or ensure pool creation sent LP tokens to migration authority

### Issue: Transaction fails with "InvalidAccountData"

**Solution:**
- Double-check all addresses (token mint, LP mint, pool)
- Verify PDAs are derived correctly
- Check program ID matches deployed program

### Issue: UI doesn't show "Liquidity Locked"

**Solution:**
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check bonding curve data is fetched
- Verify `lpBurned` field exists in IDL
- Re-copy IDL files to frontend

---

## 📊 Testing Metrics

Track these during testing:

| Metric | Expected | Actual | Pass/Fail |
|--------|----------|--------|-----------|
| Program deploys | ✅ Success | | |
| Token created | ✅ Success | | |
| Bonding curve initialized | ✅ Success | | |
| Buy until threshold | ✅ Reaches 100% | | |
| Migration executes | ✅ Success | | |
| 6 SOL fee collected | ✅ In treasury | | |
| Migration vaults funded | ✅ SOL + tokens | | |
| Pool created | ✅ With LP tokens | | |
| LP burn succeeds | ✅ Transaction confirmed | | |
| UI updated | ✅ Shows locked badge | | |
| Event emitted | ✅ LpTokensBurnedEvent | | |
| Cannot remove liquidity | ✅ No LP tokens | | |

---

## 🔄 Repeat Testing

For thorough testing, repeat the process 3 times:

**Test 1:** Normal flow (as described above)
**Test 2:** Different migration threshold (e.g., 20 SOL)
**Test 3:** Maximum tokens (buy until all sold)

Each test should complete successfully.

---

## 📝 Test Report Template

After testing, document results:

```markdown
# LP Burning Test Report

**Date:** [DATE]
**Tester:** [NAME]
**Network:** Devnet
**Program ID:** 5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK

## Test Results

### Test 1: Normal Flow
- Token Mint: [ADDRESS]
- Migration executed: ✅/❌
- LP burned: ✅/❌
- UI updated: ✅/❌
- Notes: [ANY ISSUES]

### Test 2: Different Threshold
- Token Mint: [ADDRESS]
- Migration executed: ✅/❌
- LP burned: ✅/❌
- UI updated: ✅/❌
- Notes: [ANY ISSUES]

### Test 3: Maximum Tokens
- Token Mint: [ADDRESS]
- Migration executed: ✅/❌
- LP burned: ✅/❌
- UI updated: ✅/❌
- Notes: [ANY ISSUES]

## Issues Found
1. [ISSUE DESCRIPTION]
2. [ISSUE DESCRIPTION]

## Recommendations
- [RECOMMENDATION]
- [RECOMMENDATION]

## Approval
- [ ] All tests passed
- [ ] Ready for mainnet deployment
- [ ] Requires additional testing

**Approved by:** [NAME]
**Date:** [DATE]
```

---

## 🚀 Ready for Mainnet?

Before deploying to mainnet, ensure:

- [ ] All devnet tests passed (3+ complete flows)
- [ ] No critical issues found
- [ ] UI displays correctly
- [ ] LP burning works consistently
- [ ] Events are emitted properly
- [ ] Cannot remove liquidity after burn
- [ ] Code reviewed by team
- [ ] Security audit completed (recommended)
- [ ] Backup of all keys
- [ ] Monitoring set up
- [ ] Community announcement prepared

---

## 📚 Next Steps

After successful devnet testing:

1. **Code Review:** Have another developer review changes
2. **Security Check:** Review smart contract for vulnerabilities
3. **Documentation:** Update all docs with devnet results
4. **Mainnet Plan:** Create deployment plan for mainnet
5. **Monitor:** Set up monitoring for events and errors
6. **Support:** Prepare support docs for users

---

**Last Updated:** November 14, 2025
**Status:** Ready for Testing
**Version:** 1.0.0

---

## 🆘 Need Help?

If you encounter issues during testing:

1. Check troubleshooting section above
2. Review logs in program and browser console
3. Verify all prerequisites are met
4. Check Solana Explorer for transaction details
5. Review LP_BURNING_GUIDE.md for additional context

Good luck with testing! 🎉

