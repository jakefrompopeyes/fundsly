# Migration Fee Quick Start Guide

## 🎯 What Changed

When a token migrates to DEX, the platform now takes a **6 SOL fee** before creating the Raydium pool.

---

## 📋 Quick Deployment Checklist

### 1. Build & Deploy Program ✅

```bash
cd /Users/dannyzirko/fundly.site

# Build the updated program
anchor build

# Deploy to devnet for testing
anchor deploy --provider.cluster devnet

# When ready for production
anchor deploy --provider.cluster mainnet
```

### 2. Update Program ID (if changed)

If you deployed a new program (not upgrading existing):

```bash
# Update in Anchor.toml
[programs.devnet]
fundly = "YOUR_NEW_PROGRAM_ID"

# Update in frontend/src/lib/anchorClient.ts
const PROGRAM_ID = new PublicKey("YOUR_NEW_PROGRAM_ID");
```

### 3. Copy Updated IDL ✅ (Already Done)

```bash
# Already done, but for reference:
cp target/idl/fundly.json frontend/src/idl/fundly.json
```

---

## 🧪 Testing

### Test Migration Flow

```bash
# 1. Create a test token and bonding curve
# 2. Buy tokens until it reaches migration threshold (85 SOL)
# 3. Trigger migration

# Check treasury balance before migration
solana balance <TREASURY_ADDRESS>

# Trigger migration via frontend or CLI
npx ts-node scripts/test-migration.ts <MINT_ADDRESS>

# Check treasury balance after - should be +6 SOL
solana balance <TREASURY_ADDRESS>
```

### Verify Migration Event

```bash
# Get recent program events
anchor events --program-id <PROGRAM_ID> | grep -A 10 "MigrationComplete"
```

You should see:
```json
{
  "name": "MigrationComplete",
  "data": {
    "mint": "...",
    "raydiumPool": "...",
    "solMigrated": 79000000000,    // 79 SOL to pool
    "tokensMigrated": 200000000000,
    "migrationFee": 6000000000,    // 6 SOL fee
    "timestamp": 1234567890
  }
}
```

---

## 💰 Revenue Calculation

### Example: Token Migrates at 85 SOL

**Platform Receives:**
- Trading fees during bonding curve: ~1-2 SOL
- **Migration fee: 6 SOL**
  - Raydium pool creation costs: -0.5 SOL
  - Transaction fees: -0.01 SOL
  - **Net platform keeps: ~5.5 SOL**
- LP fees after migration: 0.075% of volume (ongoing)

**Liquidity Pool Gets:**
- SOL: 79 SOL (85 - 6)
- Tokens: All remaining tokens

**Cost Breakdown per Migration:**

| Item | Amount | Notes |
|------|--------|-------|
| Migration fee (to treasury) | +6.00 SOL | Collected from user |
| Raydium pool creation | -0.40 SOL | Paid to Raydium |
| Transaction fees | -0.01 SOL | Network costs |
| **Net platform profit** | **~5.59 SOL** | **Pure revenue** |

**Total Platform Revenue per Token:**
- Upfront net: ~7 SOL (bonding curve + migration net)
- Ongoing: LP trading fees forever

---

## 🔍 Monitoring

### Track Migration Fees

Add to your analytics:

```typescript
// Listen for migrations
connection.onLogs(
  PROGRAM_ID,
  (logs) => {
    if (logs.logs.some(log => log.includes("MigrationComplete"))) {
      // Parse event and track fee
      console.log("Migration fee collected: 6 SOL");
    }
  }
);
```

### Treasury Dashboard

Show total fees collected:
```typescript
const totalMigrationFees = migrationCount * 6; // SOL
```

---

## ⚠️ Important Notes

### Minimum SOL Requirement

Tokens MUST have more than 6 SOL to migrate. Recommended:
- Set `migration_threshold_sol` to at least **85 SOL**
- This ensures: 6 SOL fee + 79 SOL for pool

### Migration Threshold Config

```bash
# Check current threshold
anchor run check-global-config

# Should show:
# migration_threshold_sol: 85000000000 (85 SOL)
```

If too low, update:
```bash
node scripts/update-global-config.js --migration-threshold 85000000000
```

---

## 🚀 User Experience

### Before Migration (UI Recommendation)

Show users:
```
Ready to Migrate! 🚀

Your token will be listed on Raydium DEX.

Migration Fee: 6 SOL
Pool Liquidity: 79 SOL + 200M tokens

[Migrate to DEX] [Cancel]
```

### After Migration

```
✅ Successfully Migrated!

Platform fee: 6 SOL
Pool created: 79 SOL + 200M tokens
Raydium Pool ID: [link]

Your token is now tradeable on all Solana DEXs!
```

---

## 📊 Analytics to Track

1. **Total Migrations:** Count of MigrationComplete events
2. **Total Fees:** migrations × 6 SOL
3. **Average Pool Size:** avg(sol_migrated)
4. **Fee Percentage:** fee / (fee + pool) = 6 / 85 = ~7%

---

## 🐛 Troubleshooting

### Migration Fails: "InsufficientSOLForMigration"

**Problem:** Bonding curve doesn't have > 6 SOL

**Solution:**
- Wait for more trades
- Or lower migration threshold (not recommended)

### Fee Not Appearing in Treasury

**Problem:** Check transaction logs

**Solution:**
1. Verify treasury address: `anchor run check-global-config`
2. Check transaction: `solana confirm -v <TX_SIGNATURE>`
3. Look for lamport transfers to treasury

### Pool Has Less SOL Than Expected

**This is correct!** 
- If curve had 85 SOL
- Pool should have 79 SOL (85 - 6 fee)

---

## 📝 Code Reference

### Migration Fee Constant
Location: `programs/fundly/src/lib.rs:449`
```rust
let migration_fee = 6_000_000_000u64; // 6 SOL
```

### Treasury Account
Location: `programs/fundly/src/lib.rs:1122-1127`
```rust
#[account(
    mut,
    constraint = treasury.key() == global_config.treasury @ ErrorCode::InvalidTreasury
)]
pub treasury: AccountInfo<'info>,
```

---

## ✅ Deployment Verification

After deployment, verify:

- [ ] Program built successfully
- [ ] IDL copied to frontend
- [ ] Test migration completes
- [ ] Treasury receives 6 SOL
- [ ] Pool created with remaining SOL
- [ ] MigrationComplete event emitted
- [ ] Frontend shows migration fee

---

## 🎉 Success Metrics

Your migration fee system is working if:

1. ✅ Every migration collects exactly 6 SOL
2. ✅ Treasury balance increases by 6 SOL per migration
3. ✅ Pools are created with correct reduced liquidity
4. ✅ MigrationComplete events show migration_fee: 6000000000
5. ✅ No errors in transaction logs

---

## Need Help?

Check logs:
```bash
# Program logs
solana logs <PROGRAM_ID>

# Transaction details
solana confirm -v <TX_SIGNATURE>

# Account balances
solana balance <TREASURY_ADDRESS>
```

