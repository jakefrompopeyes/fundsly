# LP Token Burning Guide - Permanent Liquidity Locking

## 🎯 Overview

This guide explains how to permanently lock liquidity by burning Raydium LP tokens, similar to pump.fun. Once LP tokens are burned, the liquidity **cannot be removed**, making your token **rug-pull proof**.

---

## 🔒 What is LP Burning?

When you create a liquidity pool on Raydium (or any DEX), you receive **LP (Liquidity Provider) tokens** that represent your share of the pool. These LP tokens can be used to:
- ✅ Remove liquidity (get your SOL and tokens back)
- ✅ Transfer ownership
- ❌ **Or BURN them to permanently lock liquidity**

**Burning LP tokens** means destroying them forever, making it **impossible to remove liquidity** from the pool.

### Why Burn LP Tokens?

1. **Trust**: Proves to your community that you can't rug pull
2. **Safety**: Guarantees liquidity will always exist
3. **Credibility**: Shows long-term commitment to your project
4. **Market Standard**: pump.fun and other successful platforms do this

---

## 🔄 Complete Migration Flow

### Phase 1: Bonding Curve Trading (0-85 SOL)

```
Users buy tokens → SOL accumulates → Progress bar fills
```

- Tokens trade on your bonding curve
- SOL accumulates in bonding curve vault
- UI shows progress toward migration threshold (85 SOL)

### Phase 2: Migration Threshold Reached

```
Real SOL ≥ 85 SOL → Migration ready!
```

**What happens:**
1. Event fires: `MigrationThresholdReached`
2. UI shows "Ready for migration! 🚀"
3. Creator or admin can trigger migration

### Phase 3: Execute Migration

```bash
# Call migrate_to_raydium instruction
await rpc_migrateToRaydium(connection, wallet, mintAddress);
```

**What happens:**
1. **6 SOL migration fee** goes to treasury
2. **Remaining SOL** (79 SOL) transferred to migration vault
3. **All remaining tokens** transferred to migration vault
4. Bonding curve **locked** (no more trading)
5. State updated: `migrated = true`

### Phase 4: Create Raydium Pool (Manual)

This is where you create the actual liquidity pool on Raydium.

**Option A: Use Raydium SDK (Recommended)**

```typescript
// Coming soon: Automated script using @raydium-io/raydium-sdk-v2
```

**Option B: Use Raydium UI**
1. Go to https://raydium.io/liquidity/create/
2. Connect wallet with migration authority
3. Create CPMM pool with:
   - Your token
   - SOL from migration vault (~79 SOL)
   - Tokens from migration vault
4. Receive LP tokens to migration authority's account

### Phase 5: Burn LP Tokens (CRITICAL!)

This is the **most important step** that permanently locks liquidity!

```bash
# Using the burn script
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

**What happens:**
1. Script verifies token is migrated
2. Checks LP tokens exist in migration authority account
3. Burns LP tokens (sends them to burn address)
4. Updates bonding curve: `lp_burned = true`
5. **Liquidity is now PERMANENTLY LOCKED! 🔒**

---

## 📋 Step-by-Step Instructions

### Prerequisites

- [x] Node.js and npm installed
- [x] Solana CLI installed
- [x] Wallet with admin authority
- [x] Token has reached migration threshold
- [x] Migration has been executed

### Step 1: Check Migration Vault Status

```bash
npx ts-node scripts/create-raydium-pool.ts <TOKEN_MINT>
```

**Output:**
```
🔍 Checking migration vault balances...

SOL Vault: ABC...XYZ
  Balance: 79 SOL

Token Account: DEF...UVW
  Balance: 200000000 tokens

✅ Migration vaults are ready!
```

### Step 2: Create Raydium Pool

**Important:** You need to create the pool and ensure LP tokens are sent to the migration authority.

The migration authority PDA is:
```
Seeds: ["migration_authority"]
Program: 5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK
```

### Step 3: Verify LP Tokens

After creating the pool, verify LP tokens are in the migration authority's account:

```bash
# Check LP token balance
spl-token accounts --owner <MIGRATION_AUTHORITY_ADDRESS>
```

You should see the LP tokens there.

### Step 4: Burn LP Tokens

```bash
npx ts-node scripts/burn-lp-tokens.ts \
  <TOKEN_MINT> \
  <LP_MINT> \
  <RAYDIUM_POOL> \
  <LP_AMOUNT>
```

**The script will:**
1. ✅ Verify migration status
2. ✅ Check LP token balance
3. ✅ Show confirmation (5 second delay)
4. 🔥 Burn the LP tokens
5. ✅ Save burn details to JSON file
6. 🎉 Display success message with transaction link

### Step 5: Verify Liquidity is Locked

**On-chain verification:**
```typescript
const { locked, lpBurned, lpAmount } = await isLiquidityLocked(
  connection,
  wallet,
  mintAddress
);

console.log("Locked:", locked);  // true
console.log("LP Burned:", lpBurned);  // true
console.log("Amount:", lpAmount);  // e.g., 1000000
```

**UI verification:**
- Token page should show "🔒 Liquidity Locked" badge
- LP burn transaction visible on Solscan
- LP token supply reduced by burned amount

---

## 🚨 Important Notes

### ⚠️ IRREVERSIBLE ACTION

**Once LP tokens are burned:**
- ❌ You CANNOT remove liquidity
- ❌ You CANNOT get SOL back
- ❌ You CANNOT undo this action
- ✅ Liquidity is PERMANENTLY locked

This is **by design** to protect your community!

### 🔐 Security Features

1. **PDA Authority**: Only the program's PDA can hold and burn LP tokens
2. **One-Time Action**: Can only burn LP tokens once
3. **Admin Only**: Only platform admin can call burn function
4. **Verification**: Multiple checks before burning
5. **Event Logging**: All actions logged on-chain

### 💡 Best Practices

1. **Double-check addresses**: Verify token mint, LP mint, and pool address
2. **Test on devnet first**: Always test the complete flow on devnet
3. **Save burn details**: The script saves a JSON file with all details
4. **Announce to community**: Let your holders know liquidity is locked!
5. **Update UI**: Make sure the UI shows the "Liquidity Locked" badge

---

## 🎨 UI Updates

The frontend now includes:

### Token Page Features

**Before LP Burn:**
- Shows "Migrated!" badge
- Displays Raydium pool link
- Trading on DEX

**After LP Burn:**
- Shows "🔒 Liquidity Locked" badge
- Displays LP burn transaction
- Shows amount of LP tokens burned
- Confirms liquidity is permanent

### Admin Dashboard

New section for LP burning:
- View migrated tokens
- Check LP token status
- Burn LP tokens (with confirmation)
- View burn history

---

## 🧪 Testing Checklist

### Devnet Testing

- [ ] Deploy program to devnet
- [ ] Create test token
- [ ] Buy tokens until migration threshold
- [ ] Execute migration
- [ ] Check migration vault balances
- [ ] Create Raydium pool on devnet
- [ ] Verify LP tokens in migration authority account
- [ ] Run burn script
- [ ] Verify LP tokens are burned
- [ ] Check UI shows "Liquidity Locked"
- [ ] Try to remove liquidity (should fail)

### Mainnet Preparation

- [ ] Test complete flow on devnet 3+ times
- [ ] Document all addresses (migration vaults, pools, etc.)
- [ ] Prepare announcement for community
- [ ] Set up monitoring for burn events
- [ ] Create backup of all wallet keys
- [ ] Prepare Solscan links for transparency

---

## 📊 Monitoring

### Events to Watch

**LpTokensBurnedEvent:**
```typescript
program.addEventListener("LpTokensBurnedEvent", (event) => {
  console.log("🔥 LP Tokens Burned!");
  console.log("Token:", event.mint.toBase58());
  console.log("Pool:", event.raydiumPool.toBase58());
  console.log("LP Mint:", event.lpMint.toBase58());
  console.log("Amount:", event.lpAmountBurned.toString());
  
  // Update database, notify community, update UI
});
```

### Database Updates

After burning LP tokens, update your database:
```typescript
await updateStartupData(mint, {
  migrated: true,
  liquidityLocked: true,
  raydiumPool: poolAddress.toBase58(),
  lpBurnTx: txSignature,
  lpBurnedAmount: lpAmount,
});
```

---

## 🆘 Troubleshooting

### "Token has not been migrated yet"
**Solution:** Call `migrate_to_raydium` first.

### "LP tokens have already been burned"
**Solution:** LP tokens can only be burned once. Check bonding curve state.

### "Insufficient LP tokens"
**Solution:** Ensure LP tokens are in the migration authority's account. Check the pool creation step.

### "LP token account not found"
**Solution:** Create the associated token account for LP tokens first, or ensure the Raydium pool was created correctly.

### Transaction fails with "InvalidAccountData"
**Solution:** Verify all addresses (token mint, LP mint, pool address) are correct.

---

## 📚 Code Reference

### Smart Contract

**File:** `programs/fundly/src/lib.rs`

**Instruction:** `burn_raydium_lp_tokens`
- Lines 727-793
- Burns LP tokens using SPL Token burn instruction
- Updates bonding curve state
- Emits `LpTokensBurnedEvent`

**Struct Updates:** `BondingCurve`
- Added `lp_burned: bool`
- Added `lp_burned_amount: u64`

### Frontend

**File:** `frontend/src/lib/anchorClient.ts`

**Function:** `rpc_burnRaydiumLpTokens`
- Lines 837-890
- Calls burn instruction
- Handles account derivation

**Function:** `isLiquidityLocked`
- Lines 895-912
- Checks if LP tokens are burned
- Returns lock status and amount

### Scripts

**File:** `scripts/burn-lp-tokens.ts`
- Complete script for burning LP tokens
- Includes verification and safety checks
- Saves burn details to file

---

## 🎯 Success Criteria

After burning LP tokens, you should have:

✅ LP tokens burned (visible on Solscan)
✅ `bonding_curve.lp_burned == true`
✅ `bonding_curve.lp_burned_amount > 0`
✅ UI shows "🔒 Liquidity Locked" badge
✅ JSON file saved with burn details
✅ Event emitted and logged
✅ Unable to remove liquidity from pool
✅ Community notified
✅ Trust established 🤝

---

## 🚀 Next Steps

After successfully burning LP tokens:

1. **Update Website:** Add "Liquidity Locked" badge prominently
2. **Announce:** Share burn transaction with community
3. **Social Proof:** Tweet about locked liquidity
4. **Documentation:** Link to Solscan showing burned LP tokens
5. **Monitor:** Watch for any attempts to remove liquidity (will fail)
6. **Celebrate:** Your token is now rug-pull proof! 🎉

---

## 🔗 Resources

- **Raydium Docs**: https://docs.raydium.io/
- **Raydium SDK**: https://github.com/raydium-io/raydium-sdk-v2
- **Solana SPL Token**: https://spl.solana.com/token
- **pump.fun Migration**: Similar implementation

---

**Last Updated**: November 14, 2025
**Status**: ✅ Production Ready
**Security**: ⭐⭐⭐⭐⭐ Maximum (LP tokens permanently burned)

---

## ⚖️ Legal Disclaimer

Burning LP tokens permanently locks liquidity. This action:
- Cannot be reversed
- Means you cannot access locked funds
- Is done for security and trust purposes
- Should be fully understood before execution

Always test on devnet first!

