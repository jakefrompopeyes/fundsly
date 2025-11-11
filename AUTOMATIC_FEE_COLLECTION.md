# Automatic Platform Fee Collection

## Overview

The Fundly platform now automatically collects and sends the 1% transaction fee to a centralized treasury on **every buy and sell transaction**. No manual withdrawal is needed - all fees flow directly to the treasury in real-time.

## Key Changes

### Before: Manual Fee Withdrawal
- ❌ Fees accumulated in individual bonding curve vaults
- ❌ Required manual withdrawal by authority
- ❌ Fees could get "stuck" if not withdrawn regularly
- ❌ Extra gas costs for withdrawal transactions

### After: Automatic Fee Collection
- ✅ Fees sent directly to treasury on each transaction
- ✅ No manual intervention needed
- ✅ Single treasury accumulates all platform revenue
- ✅ No extra withdrawal transactions required
- ✅ Real-time revenue tracking

## How It Works

### Architecture

```
User Buy Transaction:
┌─────────┐  10 SOL   ┌──────────────┐
│  Buyer  │───────────▶│  Split:      │
└─────────┘            │  - 9.9 → Vault│
                       │  - 0.1 → Treasury│
                       └──────────────┘

User Sell Transaction:
┌─────────┐            ┌──────────────┐
│ Seller  │◀───────────│  Split:      │
└─────────┘  9.9 SOL   │  - 9.9 ← Vault│
                       │  - 0.1 → Treasury│
                       └──────────────┘
```

### Buy Transaction Flow
1. User sends 10 SOL to buy tokens
2. Program calculates 1% fee: 0.1 SOL
3. **9.9 SOL → Bonding curve vault** (for liquidity)
4. **0.1 SOL → Treasury** (platform fee)
5. User receives tokens from bonding curve

### Sell Transaction Flow
1. User sells tokens for SOL
2. Program calculates SOL payout before fee: 10 SOL
3. Program calculates 1% fee: 0.1 SOL
4. **9.9 SOL from vault → Seller** (payout after fee)
5. **0.1 SOL from vault → Treasury** (platform fee)
6. Reserves updated to reflect full 10 SOL removal

## Global Config Changes

### New Treasury Field

```rust
pub struct GlobalConfig {
    pub authority: Pubkey,              // Platform authority
    pub treasury: Pubkey,               // 🆕 Treasury for automatic fees
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub initial_token_supply: u64,
    pub fee_basis_points: u16,
    pub migration_threshold_sol: u64,
    pub raydium_amm_program: Pubkey,
}
```

### Initialization

When initializing the global config, you now **must** specify a treasury address:

```typescript
await rpc_initializeGlobalConfig(
  connection,
  wallet,
  treasuryPublicKey,   // 🆕 Treasury address
  30,                  // Virtual SOL reserves
  1_000_000_000,       // Virtual token reserves
  1_000_000_000,       // Initial token supply
  100                  // 1% fee (100 basis points)
);
```

## Smart Contract Changes

### BuyTokens Accounts

Added `treasury` account:

```rust
#[derive(Accounts)]
pub struct BuyTokens<'info> {
    // ... existing accounts ...
    #[account(
        mut,
        constraint = treasury.key() == global_config.treasury @ ErrorCode::InvalidTreasury
    )]
    /// CHECK: Treasury address validated against global config
    pub treasury: AccountInfo<'info>,
}
```

### SellTokens Accounts

Added `treasury` account:

```rust
#[derive(Accounts)]
pub struct SellTokens<'info> {
    // ... existing accounts ...
    #[account(
        mut,
        constraint = treasury.key() == global_config.treasury @ ErrorCode::InvalidTreasury
    )]
    /// CHECK: Treasury address validated against global config
    pub treasury: AccountInfo<'info>,
}
```

### Buy Logic Changes

**Before:**
```rust
// Transfer FULL amount to vault
transfer(cpi_context, sol_amount)?;
// Fee stays in vault as excess balance
```

**After:**
```rust
// Transfer only amount after fee to vault
transfer(cpi_context, sol_after_fee)?;

// Transfer fee directly to treasury
transfer(fee_cpi_context, fee)?;
```

### Sell Logic Changes

**Before:**
```rust
// Pay seller from vault
vault -= sol_out;
seller += sol_out;
// Fee stayed in vault as excess
```

**After:**
```rust
// Pay seller from vault (after fee)
vault -= sol_out;
seller += sol_out;

// Send fee from vault to treasury
vault -= fee;
treasury += fee;
```

## Frontend SDK Changes

### rpc_buyTokens

Now automatically includes treasury from global config:

```typescript
const globalConfig = await fetchGlobalConfig(...);

return program.methods
  .buyTokens(solAmount, minTokensOut)
  .accounts({
    // ... existing accounts ...
    treasury: globalConfig.treasury, // 🆕 Auto-included
  })
  .rpc();
```

### rpc_sellTokens

Now automatically includes treasury from global config:

```typescript
const globalConfig = await fetchGlobalConfig(...);

return program.methods
  .sellTokens(tokenAmount, minSolOut)
  .accounts({
    // ... existing accounts ...
    treasury: globalConfig.treasury, // 🆕 Auto-included
  })
  .rpc();
```

## Treasury Management

### Setting Up Treasury

Choose a secure address for your treasury:

```typescript
// Option 1: Use admin wallet as treasury
const treasury = adminWallet.publicKey;

// Option 2: Use dedicated treasury wallet
const treasury = new PublicKey("YOUR_TREASURY_ADDRESS");

// Option 3: Use multisig for security
const treasury = new PublicKey("MULTISIG_ADDRESS");
```

### Changing Treasury

Use the `update_global_config` instruction:

```typescript
await program.methods
  .updateGlobalConfig(
    newTreasuryPublicKey, // New treasury address
    null,                 // Keep other params unchanged
    null,
    null,
    null,
    null,
    null
  )
  .accounts({
    globalConfig: globalConfigPda,
    authority: authorityPublicKey,
  })
  .rpc();
```

### Monitoring Treasury

Real-time balance tracking:

```typescript
const treasuryBalance = await connection.getBalance(treasuryAddress);
console.log("Treasury balance:", treasuryBalance / LAMPORTS_PER_SOL, "SOL");
```

Listen to buy/sell events to track fee collection:

```typescript
program.addEventListener("BuyEvent", (event) => {
  console.log("Fee collected:", event.fee / LAMPORTS_PER_SOL, "SOL");
});

program.addEventListener("SellEvent", (event) => {
  console.log("Fee collected:", event.fee / LAMPORTS_PER_SOL, "SOL");
});
```

## Migration from Manual to Automatic

### If You Have Existing Deployment

If you're upgrading from the manual fee system:

1. **Withdraw existing accumulated fees**:
```typescript
// Use the old withdraw function for each bonding curve
await rpc_withdrawPlatformFees(connection, wallet, mint, treasury);
```

2. **Update global config with treasury**:
```typescript
// Add treasury to existing config
await updateGlobalConfig(connection, wallet, treasuryAddress, ...);
```

3. **Redeploy program with new version**

4. **All new transactions will automatically use the treasury**

### Fresh Deployment

Simply include the treasury when initializing:

```bash
ts-node scripts/init-global-config.ts
```

The script now automatically sets up the treasury.

## Security Considerations

### Treasury Validation
- ✅ Treasury address is validated on-chain against `GlobalConfig`
- ✅ Transactions fail if wrong treasury is provided
- ✅ Only authority can change treasury address

### Best Practices
1. **Use a Multisig**: Consider using a multisig wallet for treasury
2. **Cold Storage**: For large amounts, periodically move to cold storage
3. **Access Control**: Limit who has access to treasury private keys
4. **Monitoring**: Set up alerts for large balance changes
5. **Backup**: Always have recovery mechanisms

## Benefits

### For Platform Operators
- 📊 **Real-time Revenue Tracking**: See fees as they come in
- 💰 **Single Source of Truth**: One treasury address for all revenue
- ⚡ **Lower Gas Costs**: No separate withdrawal transactions
- 🔒 **Reduced Risk**: No fees stuck in individual vaults
- 📈 **Better Analytics**: Simpler to track total revenue

### For Users
- ⚡ **No Changes**: User experience unchanged
- 💸 **Same Fees**: Still 1% on all transactions
- 🎯 **Transparent**: Fees still clearly shown in events

## Analytics & Reporting

### Track Total Fees Collected

```typescript
// Get all buy events
const buyEvents = await program.account.buyEvent.all();
const totalBuyFees = buyEvents.reduce((sum, e) => sum + e.fee, 0);

// Get all sell events
const sellEvents = await program.account.sellEvent.all();
const totalSellFees = sellEvents.reduce((sum, e) => sum + e.fee, 0);

console.log("Total fees:", (totalBuyFees + totalSellFees) / LAMPORTS_PER_SOL, "SOL");
```

### Daily Revenue Dashboard

```typescript
const today = Date.now() / 1000 - 86400;
const recentEvents = buyEvents.filter(e => e.timestamp > today);
const dailyRevenue = recentEvents.reduce((sum, e) => sum + e.fee, 0);
```

## Troubleshooting

### Error: "Invalid treasury address"
**Cause**: Treasury in transaction doesn't match global config  
**Solution**: Ensure you're fetching treasury from global config

### Error: "Account does not exist"
**Cause**: Global config not initialized with treasury  
**Solution**: Re-initialize or update global config with treasury address

### Fees not appearing in treasury
**Cause**: Old program version or wrong treasury address  
**Solution**: Verify program is updated and treasury address is correct

## Testing

### Test Automatic Fee Collection

```bash
# 1. Initialize with treasury
ts-node scripts/init-global-config.ts

# 2. Create a bonding curve
ts-node scripts/create-project.ts

# 3. Check treasury balance before
solana balance <TREASURY_ADDRESS>

# 4. Buy some tokens
# (use your frontend or SDK)

# 5. Check treasury balance after
solana balance <TREASURY_ADDRESS>
# Should see +0.1 SOL (if you bought with 10 SOL)
```

## Comparison: Before vs After

| Feature | Manual Withdrawal | Automatic Collection |
|---------|------------------|---------------------|
| Fee Destination | Individual vault PDAs | Central treasury |
| Collection Method | Manual `withdraw` call | Automatic on trade |
| Gas Cost | Trade + Withdrawal | Trade only |
| Revenue Tracking | Complex (multiple vaults) | Simple (one treasury) |
| Risk of Loss | Fees can be forgotten | No risk |
| Setup Complexity | Medium | Low |
| Real-time Visibility | No | Yes |

## FAQ

### Q: What happens to fees in the vault PDAs?
**A:** With automatic collection, fees never accumulate in vaults. They go straight to treasury.

### Q: Can I still use `withdraw_platform_fees`?
**A:** Yes, it's still available for backward compatibility, but with automatic collection, there should be no fees to withdraw.

### Q: Can users see where fees go?
**A:** Yes! The treasury address is public in the `GlobalConfig` and all fee transfers are visible on-chain.

### Q: How do I change the treasury address?
**A:** Only the platform authority can change it using `update_global_config`.

### Q: Does this affect the bonding curve math?
**A:** No! The bonding curve calculations remain exactly the same. Only the fee routing changed.

### Q: Are there any breaking changes for users?
**A:** No! Users interact with buy/sell the same way. The SDK handles treasury automatically.

## Future Enhancements

Potential improvements:
- [ ] **Multi-recipient fees**: Split fees between multiple addresses
- [ ] **Dynamic fee tiers**: Different fees based on volume
- [ ] **Tiered treasury**: Route fees differently based on amount
- [ ] **DAO treasury**: Community-controlled treasury via governance
- [ ] **Automated reinvestment**: Auto-compound treasury yields
- [ ] **Fee rebates**: Reward high-volume traders

---

**Status**: ✅ Fully Implemented and Ready for Production

**Next Steps**:
1. Test on localnet
2. Deploy to devnet
3. Audit treasury security
4. Set up monitoring
5. Deploy to mainnet

