# Platform Fee Withdrawal Guide

## Overview

The Fundly platform charges a **1% fee** on all buy and sell transactions in the bonding curve. These fees accumulate in each bonding curve's SOL vault and can be withdrawn by the platform authority to a designated treasury address.

## How Fees Accumulate

### Buy Transactions
When a user buys tokens:
1. Full SOL amount (including 1% fee) is transferred to the vault
2. Only the amount after fee deduction is added to `real_sol_reserves`
3. The 1% fee remains in the vault as accumulated platform fees

Example:
- User pays: 10 SOL
- Fee (1%): 0.1 SOL
- Added to reserves: 9.9 SOL
- **Fee accumulated in vault: 0.1 SOL**

### Sell Transactions
When a user sells tokens:
1. SOL is calculated based on the bonding curve formula
2. 1% fee is deducted from the payout
3. The full amount (before fee) is subtracted from `real_sol_reserves`
4. Only the after-fee amount is paid to the seller
5. The fee portion stays in the vault

Example:
- SOL to pay (before fee): 10 SOL
- Fee (1%): 0.1 SOL
- User receives: 9.9 SOL
- Deducted from reserves: 10 SOL
- **Fee accumulated in vault: 0.1 SOL**

## Fee Calculation Formula

```
Accumulated Fees = Vault Balance - Real SOL Reserves - Rent Exempt Minimum
```

Where:
- **Vault Balance**: Total SOL in the bonding curve's SOL vault PDA
- **Real SOL Reserves**: The amount tracked in the bonding curve state (excludes fees)
- **Rent Exempt Minimum**: ~0.00089088 SOL (required to keep the PDA rent-exempt)

## Withdrawing Fees

### Prerequisites

1. **Authority Access**: Only the wallet set as `authority` in the `GlobalConfig` can withdraw fees
2. **Accumulated Fees**: The bonding curve must have trading activity with accumulated fees
3. **Treasury Address**: A valid Solana address where fees will be sent

### Using the Admin UI

1. Navigate to `/admin/withdraw-fees` in the web app
2. Connect the wallet that is set as the platform authority
3. Enter the **Token Mint Address** of the bonding curve
4. Click **"Calculate Accumulated Fees"** to see how much is available
5. Enter the **Treasury Address** where fees should be sent
6. Click **"Withdraw Fees to Treasury"** to execute the withdrawal

### Using the Test Script

```bash
# Set the mint address as an environment variable or pass as argument
MINT_ADDRESS=<your_mint_address> ts-node scripts/test-fee-withdrawal.ts

# Or pass as argument
ts-node scripts/test-fee-withdrawal.ts <your_mint_address>
```

The script will:
- Display bonding curve state
- Calculate accumulated fees
- Verify you're the authority
- Withdraw fees to the treasury
- Show before/after balances

### Using the SDK Directly

```typescript
import {
  rpc_withdrawPlatformFees,
  calculateAccumulatedFees,
  fetchGlobalConfig,
} from "@/lib/anchorClient";

// 1. Calculate fees first (optional, for display)
const feeInfo = await calculateAccumulatedFees(
  connection,
  wallet,
  mintPublicKey
);

console.log("Accumulated fees:", feeInfo.accumulatedFeesSOL, "SOL");

// 2. Withdraw fees
const txSig = await rpc_withdrawPlatformFees(
  connection,
  wallet,
  mintPublicKey,
  treasuryPublicKey
);

console.log("Transaction signature:", txSig);
```

## Smart Contract Details

### Instruction: `withdraw_platform_fees`

**Accounts:**
- `bonding_curve` - The bonding curve PDA (mut)
- `mint` - Token mint address
- `bonding_curve_sol_vault` - SOL vault PDA (mut)
- `global_config` - Global config PDA
- `authority` - Platform authority (signer, mut)
- `treasury` - Treasury address to receive fees (mut)
- `system_program` - System program

**Validation:**
1. Verifies the signer is the platform authority
2. Ensures vault balance >= real_sol_reserves + rent_exempt_minimum
3. Requires accumulated fees > 0

**Events Emitted:**
```rust
pub struct FeeWithdrawalEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
```

**Error Codes:**
- `Unauthorized` - Caller is not the platform authority
- `InsufficientFees` - Not enough balance to cover reserves and rent
- `NoFeesToWithdraw` - No accumulated fees available

## Security Considerations

### Access Control
- ✅ Only the platform authority can withdraw fees
- ✅ Authority is set in `GlobalConfig` during initialization
- ✅ Authority validation happens on-chain in the program

### Safety Checks
- ✅ Real SOL reserves are never touched (bonding curve remains functional)
- ✅ Rent-exempt minimum is preserved (PDA stays rent-exempt)
- ✅ Only excess balance (actual fees) can be withdrawn
- ✅ All amounts are checked for overflows/underflows

### Best Practices
1. **Regular Withdrawals**: Withdraw fees periodically to reduce risk exposure
2. **Treasury Security**: Use a multisig or hardware wallet for the treasury
3. **Monitoring**: Track withdrawal events for transparency and auditing
4. **Testing**: Test on devnet/localnet before mainnet deployment

## Monitoring and Analytics

### Calculating Total Platform Revenue

To calculate total revenue across all bonding curves:

```typescript
const allCurves = [...]; // Array of mint addresses
let totalFees = 0;

for (const mint of allCurves) {
  const feeInfo = await calculateAccumulatedFees(connection, wallet, mint);
  totalFees += feeInfo.accumulatedFeesSOL;
}

console.log("Total accumulated fees:", totalFees, "SOL");
```

### Listening to Withdrawal Events

```typescript
program.addEventListener("FeeWithdrawalEvent", (event, slot) => {
  console.log("Fee withdrawn from mint:", event.mint.toString());
  console.log("Amount:", event.amount / LAMPORTS_PER_SOL, "SOL");
  console.log("Treasury:", event.treasury.toString());
  console.log("Timestamp:", new Date(event.timestamp * 1000));
});
```

## Example Scenario

### Initial State
- Bonding curve created for token XYZ
- Virtual reserves: 30 SOL, 1B tokens
- Real reserves: 0 SOL, 800M tokens

### After Trading
- User A buys with 10 SOL → 9.9 SOL added to reserves, 0.1 SOL fee
- User B buys with 5 SOL → 4.95 SOL added to reserves, 0.05 SOL fee
- User C sells for 3 SOL → 3 SOL removed from reserves, 0.03 SOL fee stays

### Vault State
- Real SOL reserves: 9.9 + 4.95 - 3 = 11.85 SOL
- Vault balance: 10 + 5 - 2.97 = 12.03 SOL (paid out 2.97 after fee)
- Rent exempt: 0.00089088 SOL
- **Accumulated fees: 12.03 - 11.85 - 0.00089088 = 0.179 SOL**

### Withdrawal
Authority calls `withdraw_platform_fees`:
- 0.179 SOL transferred to treasury
- Vault balance: 11.851 SOL (reserves + rent)
- Bonding curve continues to function normally

## FAQ

### Q: Can fees be withdrawn while trading is active?
**A:** Yes! Withdrawing fees doesn't affect the bonding curve's functionality. The real SOL reserves remain intact, so users can continue buying and selling.

### Q: What happens if I try to withdraw with no fees?
**A:** The transaction will fail with error `NoFeesToWithdraw`. The program requires at least 1 lamport of accumulated fees.

### Q: Can I change the platform authority?
**A:** Yes, use the `update_global_config` instruction to change the authority. Only the current authority can do this.

### Q: How often should fees be withdrawn?
**A:** It depends on your platform's activity. More active platforms should withdraw more frequently. Consider automating withdrawals when fees reach a certain threshold.

### Q: Are there any fees for withdrawing fees?
**A:** Only the standard Solana transaction fee (~0.000005 SOL), which is paid by the authority/treasury.

### Q: Can fees be withdrawn from migrated bonding curves?
**A:** Yes! Even after migration to Raydium, any accumulated fees can still be withdrawn from the vault.

## Troubleshooting

### Error: "Unauthorized"
- Ensure you're connected with the wallet set as `authority` in `GlobalConfig`
- Verify authority address with: `anchor account --program-id <PROGRAM_ID> GlobalConfig <CONFIG_PDA>`

### Error: "No fees to withdraw"
- Check that the bonding curve has had trading activity
- Use `calculateAccumulatedFees()` to verify fee amount
- Ensure fees haven't already been withdrawn

### Error: "Insufficient fees"
- This indicates a critical issue where vault balance < reserves + rent
- Should not happen in normal operation - contact developers immediately

### Transaction times out
- Increase commitment level to "confirmed" or "finalized"
- Check RPC node health
- Verify all addresses are correct

## Future Enhancements

Potential improvements for v2:
- [ ] Batch withdrawal from multiple bonding curves
- [ ] Automated withdrawal triggers based on threshold
- [ ] Fee distribution to multiple stakeholders
- [ ] On-chain analytics for fee tracking
- [ ] Fee withdrawal scheduling/vesting
- [ ] Multi-signature requirement for large withdrawals

---

**For support or questions, please refer to the main Fundly documentation or contact the development team.**

