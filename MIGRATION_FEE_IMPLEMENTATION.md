# Migration Fee Implementation - 6 SOL Platform Fee

## Summary

Successfully implemented a 6 SOL platform fee on all token migrations. When a token graduates from the bonding curve to a Raydium DEX pool, the platform automatically collects 6 SOL as a migration fee, while the remaining SOL (along with all tokens) goes into the liquidity pool.

---

## What Was Changed

### 1. Smart Contract Updates (`programs/fundly/src/lib.rs`)

#### Migration Function
- Modified `migrate_to_raydium` instruction to:
  - Deduct 6 SOL (6,000,000,000 lamports) as a migration fee
  - Transfer fee to treasury wallet
  - Send remaining SOL to migration vault for pool creation
  - Verify sufficient SOL exists (must have > 6 SOL total)

#### New Error Code
- Added `InsufficientSOLForMigration` error
  - Ensures migration only proceeds if there's enough SOL to cover the 6 SOL fee + liquidity

#### Updated Event
- Modified `MigrationComplete` event to include:
  - `migration_fee: u64` - Amount of fee collected (always 6 SOL)
  - Tracks total fees collected for analytics

#### Account Context
- Added `treasury` account to `MigrateToRaydium` context
  - Validated against global config
  - Receives the 6 SOL migration fee

### 2. Frontend Updates (`frontend/src/lib/anchorClient.ts`)

#### Migration Function
- Updated `rpc_migrateToRaydium` to:
  - Fetch global config to get treasury address
  - Pass treasury account in transaction
  - Log migration fee warning to console
  - Display treasury address for transparency

---

## How It Works

### Migration Flow

```
Token Reaches Migration Threshold (e.g., 85 SOL)
           ↓
User/Admin Triggers Migration
           ↓
Smart Contract Executes:
   1. Verifies: total_sol > 6 SOL
   2. Calculates: pool_sol = total_sol - 6 SOL
   3. Transfers: 6 SOL → Treasury
   4. Transfers: remaining SOL → Migration Vault
   5. Transfers: all tokens → Migration Vault
   6. Emits: MigrationComplete event
           ↓
Backend Service Creates Raydium Pool
   - Uses SOL from migration vault
   - Uses tokens from migration vault
   - Platform keeps LP tokens = ongoing revenue
```

### Example

**Before Migration:**
- Bonding curve has: 85 SOL + 200M tokens

**After Migration:**
- Treasury receives: **6 SOL** (platform fee)
- Migration vault has: **79 SOL** + 200M tokens
- Raydium pool created with: 79 SOL + 200M tokens

---

## Revenue Model

### Platform Earnings Per Token

1. **During Bonding Curve Phase:**
   - 1% fee on all trades
   - Fees go directly to treasury

2. **Migration Fee Breakdown (6 SOL total):**
   - Raydium pool creation: ~0.5 SOL (paid to Raydium)
   - Transaction fees: ~0.01 SOL (network costs)
   - **Platform keeps: ~5.49 SOL** net per migration

3. **After Migration (DEX Phase):**
   - 0.075% of all trading volume (as LP provider)
   - Ongoing revenue forever
   - Withdraw LP fees anytime

### Total Platform Revenue Example

For a successful token that migrates at 85 SOL:
- Bonding curve fees: ~1.5 SOL (assuming moderate volume)
- **Migration fee collected: 6 SOL**
  - Raydium costs: -0.5 SOL
  - **Net platform revenue: 5.5 SOL**
- LP trading fees: 0.075% of all future volume (ongoing)

**Total upfront net revenue: ~7 SOL per successful token**

### Cost Breakdown

| Item | Amount | Who Receives |
|------|--------|--------------|
| Migration fee collected | 6.00 SOL | Platform treasury |
| Raydium pool creation | -0.40 SOL | Raydium |
| Network transaction fees | -0.01 SOL | Solana validators |
| **Net platform revenue** | **~5.59 SOL** | **Platform keeps** |

---

## Technical Details

### Migration Fee Constant

```rust
let migration_fee = 6_000_000_000u64; // 6 SOL in lamports
```

### Fee Distribution

```rust
// Step 1: Transfer fee to treasury
**ctx.accounts.bonding_curve_sol_vault.try_borrow_mut_lamports()? -= migration_fee;
**ctx.accounts.treasury.try_borrow_mut_lamports()? += migration_fee;

// Step 2: Transfer remaining SOL to migration vault
let sol_to_migrate = total_sol - migration_fee;
**ctx.accounts.bonding_curve_sol_vault.try_borrow_mut_lamports()? -= sol_to_migrate;
**ctx.accounts.migration_sol_vault.try_borrow_mut_lamports()? += sol_to_migrate;
```

### Event Tracking

```rust
emit!(MigrationComplete {
    mint: bonding_curve.mint,
    raydium_pool: ctx.accounts.migration_sol_vault.key(),
    sol_migrated: sol_to_migrate,     // SOL that went to pool
    tokens_migrated: tokens_to_migrate,
    migration_fee: 6_000_000_000,     // Fee collected
    timestamp: Clock::get()?.unix_timestamp,
});
```

---

## Deployment Steps

### 1. Build and Deploy Program

```bash
# Build the updated program
anchor build

# Deploy to devnet (for testing)
anchor deploy --provider.cluster devnet

# Deploy to mainnet (when ready)
anchor deploy --provider.cluster mainnet
```

### 2. Update Frontend

The frontend updates are already in place:
- IDL updated with new treasury account requirement
- Migration function automatically fetches treasury from global config
- User sees migration fee warning in console

### 3. Test Migration

```bash
# Test the migration flow
cd /Users/dannyzirko/fundly.site
npx ts-node scripts/test-migration.ts <MINT_ADDRESS>
```

---

## Safety Features

### 1. Insufficient SOL Check
- Migration fails if `total_sol <= 6 SOL`
- Prevents migrations that would leave no liquidity for the pool

### 2. Treasury Validation
- Treasury address validated against global config
- Prevents fees from going to wrong address

### 3. Event Emission
- All migrations emit `MigrationComplete` event
- Platform can track total fees collected
- Analytics on migration success rate

---

## Monitoring

### Track Migration Fees

```typescript
// Listen for migration events
program.addEventListener("MigrationComplete", (event) => {
  console.log("Migration fee collected:", event.migration_fee / 1e9, "SOL");
  console.log("SOL to pool:", event.sol_migrated / 1e9, "SOL");
  console.log("Total:", (event.migration_fee + event.sol_migrated) / 1e9, "SOL");
});
```

### Query Total Fees

```bash
# Get all migration events
anchor events --program-id <PROGRAM_ID> | grep MigrationComplete
```

---

## User Communication

### Migration Button UI

Consider adding a tooltip or modal explaining:
```
"Migration Fee: 6 SOL

When a token graduates to DEX listing, 
a 6 SOL platform fee is charged. This fee:
- Covers Raydium pool creation costs
- Supports platform development
- Is a one-time charge

Your token will still have plenty of 
liquidity for trading on Raydium!"
```

---

## Next Steps

### Immediate
- ✅ Deploy updated program to devnet
- ✅ Test migration with real tokens
- ✅ Verify treasury receives fees
- ✅ Confirm pool creation works with reduced liquidity

### Future Enhancements
1. **Dynamic Fee**
   - Make migration fee configurable in global config
   - Allow adjusting based on market conditions

2. **Fee Tiers**
   - Higher fees for faster migrations
   - Lower fees for larger pools

3. **Fee Sharing**
   - Share portion of migration fee with token creator
   - Incentivize quality projects

---

## Files Modified

### Smart Contract
- `programs/fundly/src/lib.rs`
  - `migrate_to_raydium()` function
  - `MigrateToRaydium` context (added treasury)
  - `MigrationComplete` event (added migration_fee)
  - `ErrorCode` enum (added InsufficientSOLForMigration)

### Frontend
- `frontend/src/lib/anchorClient.ts`
  - `rpc_migrateToRaydium()` function
- `frontend/src/idl/fundly.json` (auto-generated)
- `frontend/src/idl/fundly.ts` (auto-generated)

### Build Artifacts
- `target/idl/fundly.json` (updated)
- `target/deploy/fundly.so` (updated)

---

## Questions?

### Q: Can the migration fee be changed?
**A:** Currently it's hardcoded to 6 SOL. To change it, you'd need to:
1. Update the constant in the smart contract
2. Redeploy the program
3. Or make it configurable via global config (future enhancement)

### Q: What if a token doesn't have 6 SOL?
**A:** Migration will fail with `InsufficientSOLForMigration` error. The migration threshold in global config should be set high enough (e.g., 85 SOL) to ensure sufficient funds.

### Q: Where does the fee go?
**A:** The fee goes to the treasury wallet specified in the global config. This is the same treasury that receives trading fees.

### Q: Can users see the fee before migrating?
**A:** Yes! The frontend logs a warning message to the console. Consider adding a confirmation modal in the UI showing the exact fee amount.

---

## Support

For issues or questions:
1. Check transaction logs for error messages
2. Verify treasury address in global config
3. Ensure bonding curve has > 6 SOL before migration
4. Review event logs for migration details

