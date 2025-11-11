# Token Vesting System Guide

## Overview

The **Token Vesting System** locks creator tokens and releases them gradually over time, preventing "rug pulls" and building investor trust. Creators cannot immediately sell all their tokens—instead, they unlock based on a predefined schedule.

---

## Why Vesting Matters

### For Investors
- ✅ **Protection from Rug Pulls**: Creators can't dump all tokens immediately
- ✅ **Aligned Incentives**: Creators benefit from long-term success
- ✅ **Transparency**: Anyone can view the vesting schedule on-chain
- ✅ **Trust Signal**: Projects with vesting show commitment

### For Creators
- ✅ **Credibility**: Demonstrates commitment to the project
- ✅ **Attracts Serious Investors**: Shows you're not a quick exit
- ✅ **Fair Distribution**: Ensures gradual token release
- ✅ **Flexible Schedules**: Choose cliff and vesting periods

---

## How It Works

### 1. Vesting Parameters

When creating a vesting schedule, you configure:

#### **Total Amount**
- Total tokens to be locked and vested
- Example: 100,000,000 tokens (10% of total supply)

#### **Start Time**
- Unix timestamp when vesting begins
- Usually set to token launch date

#### **Cliff Duration**
- Period before ANY tokens unlock
- Common: 30-90 days
- During cliff: 0 tokens can be claimed

#### **Vesting Duration**
- Total time until all tokens are unlocked
- Common: 6-24 months
- Example: 12 months = 365 days

#### **Release Interval**
- How often tokens become claimable
- Common: Monthly (30 days) or Weekly (7 days)
- More frequent = smoother unlock curve

### 2. Vesting Formula

The system uses **linear vesting**:

```
unlocked_tokens = (total_tokens × elapsed_time) / vesting_duration
```

**Example**: 12-month vesting with 1-month cliff
- Month 0: 0% unlocked (cliff)
- Month 1: 8.33% unlocked
- Month 6: 50% unlocked
- Month 12: 100% unlocked

### 3. Claiming Process

1. **Check Claimable**: View how many tokens are unlocked
2. **Claim Tokens**: Transfer unlocked tokens to your wallet
3. **Sell or Use**: Once claimed, tokens are yours to use

You can claim:
- As often as you want (no restrictions)
- Only unlocked tokens (cannot claim early)
- Multiple times (claim 10% now, 10% later, etc.)

---

## Common Vesting Schedules

### Standard (12 Month Vesting)
```
Cliff: 1 month
Duration: 12 months
Interval: Monthly
```
- **Use Case**: Most projects
- **Unlock Pattern**: 8.33% per month after cliff
- **Timeline**: All tokens by month 13

### Extended (24 Month Vesting)
```
Cliff: 3 months
Duration: 24 months
Interval: Monthly
```
- **Use Case**: Large allocations, core team
- **Unlock Pattern**: ~4.17% per month after cliff
- **Timeline**: All tokens by month 27

### Quick Vest (6 Month)
```
Cliff: 0 months (no cliff)
Duration: 6 months
Interval: Weekly
```
- **Use Case**: Advisors, early supporters
- **Unlock Pattern**: ~3.85% per week
- **Timeline**: All tokens by month 6

### Conservative (36 Month)
```
Cliff: 6 months
Duration: 36 months
Interval: Monthly
```
- **Use Case**: Founders, long-term team
- **Unlock Pattern**: ~2.78% per month after cliff
- **Timeline**: All tokens by month 42

---

## Implementation Guide

### Smart Contract Functions

#### `initialize_vesting`
Creates a new vesting schedule

```rust
pub fn initialize_vesting(
    ctx: Context<InitializeVesting>,
    total_amount: u64,          // Tokens to vest (with decimals)
    start_time: i64,            // Unix timestamp
    cliff_duration: i64,        // Seconds until cliff ends
    vesting_duration: i64,      // Total vesting period (seconds)
    release_interval: i64,      // Unlock frequency (seconds)
) -> Result<()>
```

**Example** (12-month vesting, 1-month cliff):
```rust
total_amount: 100_000_000_000_000  // 100M tokens (6 decimals)
start_time: 1699488000             // Nov 9, 2023
cliff_duration: 2_592_000          // 30 days
vesting_duration: 31_104_000       // 360 days
release_interval: 2_592_000        // 30 days (monthly)
```

#### `claim_vested_tokens`
Claims unlocked tokens

```rust
pub fn claim_vested_tokens(
    ctx: Context<ClaimVestedTokens>,
) -> Result<()>
```

- Automatically calculates claimable amount
- Transfers tokens to creator's wallet
- Updates claimed amount on-chain

---

## Frontend Integration

### Using the RPC Functions

```typescript
import {
  rpc_initializeVesting,
  rpc_claimVestedTokens,
  fetchVestingSchedule,
  VestingPresets,
} from "@/lib/anchorClient";
import { BN } from "@coral-xyz/anchor";

// 1. Initialize vesting with preset
const mintAddress = new PublicKey("...");
const totalTokens = new BN(100_000_000_000_000); // 100M tokens
const startTime = Math.floor(Date.now() / 1000);
const schedule = VestingPresets.standard12Month(startTime);

const result = await rpc_initializeVesting(
  connection,
  wallet,
  mintAddress,
  totalTokens,
  schedule.startTime,
  schedule.cliffDuration,
  schedule.vestingDuration,
  schedule.releaseInterval,
);

// 2. Fetch vesting data
const vestingData = await fetchVestingSchedule(
  connection,
  wallet,
  mintAddress,
);

// 3. Claim unlocked tokens
const claimResult = await rpc_claimVestedTokens(
  connection,
  wallet,
  mintAddress,
);
```

### Using the Vesting Dashboard Component

```tsx
import VestingDashboard from "@/components/trading/VestingDashboard";

<VestingDashboard
  mintAddress="YourTokenMintAddress"
  tokenSymbol="YOUR"
  tokenDecimals={6}
/>
```

Features:
- Real-time unlocked token calculation
- Progress bars for vesting and claiming
- One-click claiming
- Automatic refresh every 10 seconds

---

## Best Practices

### For Creators

1. **Choose Appropriate Duration**
   - Startups: 12-24 months
   - Established: 6-12 months
   - Founders: 24-48 months

2. **Set Reasonable Cliff**
   - Standard: 1-3 months
   - Shows commitment without being too restrictive

3. **Transparent Communication**
   - Announce vesting schedule before launch
   - Include in tokenomics documentation
   - Show vesting address on website

4. **Don't Over-Lock**
   - Lock 10-20% of supply (creator allocation)
   - Keep some tokens unlocked for operations
   - Balance trust with flexibility

### For Platforms (Fundly)

1. **Recommend Vesting**
   - Make it optional but encouraged
   - Provide templates/presets
   - Show verified badge for vested projects

2. **Display Vesting Info**
   - Show on project page
   - Indicate % of supply locked
   - Link to vesting schedule

3. **Audit Vesting Contracts**
   - Regular security audits
   - Test with various schedules
   - Monitor for exploits

---

## Example Workflow

### Scenario: New Token Launch

**Setup:**
- Total Supply: 1,000,000,000 tokens
- Creator Allocation: 100,000,000 (10%)
- Investor Sale: 500,000,000 (50%)
- Bonding Curve: 400,000,000 (40%)

**Vesting Strategy:**

1. **Create Token** (Day 0)
   ```bash
   anchor deploy
   # Deploy your token
   ```

2. **Initialize Vesting** (Day 0)
   ```typescript
   // Lock 100M creator tokens
   await rpc_initializeVesting(
     connection,
     wallet,
     mintAddress,
     new BN(100_000_000_000_000), // 100M with 6 decimals
     startTime,
     new BN(30 * 24 * 60 * 60),   // 30-day cliff
     new BN(365 * 24 * 60 * 60),  // 12-month vesting
     new BN(30 * 24 * 60 * 60),   // Monthly unlocks
   );
   ```

3. **Transfer to Vesting Vault** (Day 0)
   ```typescript
   // Transfer 100M tokens to vesting vault
   // This happens automatically during initialization
   ```

4. **Wait for Cliff** (Days 1-30)
   - Creator has 0 tokens claimable
   - Investors can see vesting schedule
   - Build trust and confidence

5. **First Claim** (Day 31)
   ```typescript
   // Claim first unlocked tokens (~8.33%)
   await rpc_claimVestedTokens(connection, wallet, mintAddress);
   // Receive ~8.33M tokens
   ```

6. **Monthly Claims** (Months 2-12)
   - Claim ~8.33M tokens each month
   - Use for liquidity, rewards, or hold
   - Full transparency on-chain

7. **Fully Vested** (Month 13)
   - All 100M tokens claimed
   - Creator has full control
   - Vesting schedule complete

---

## Time Conversion Helpers

```typescript
// Seconds in common periods
const SECOND = 1;
const MINUTE = 60;
const HOUR = 60 * 60;
const DAY = 24 * 60 * 60;
const WEEK = 7 * 24 * 60 * 60;
const MONTH = 30 * 24 * 60 * 60;  // Approximate
const YEAR = 365 * 24 * 60 * 60;

// Examples
cliff_duration: 30 * DAY          // 30 days
vesting_duration: 12 * MONTH      // 12 months
release_interval: 1 * WEEK        // Weekly
```

---

## Monitoring & Verification

### Check Vesting Status

```typescript
// Fetch current vesting state
const schedule = await fetchVestingSchedule(
  connection,
  wallet,
  mintAddress,
);

console.log("Total:", schedule.totalAmount.toString());
console.log("Claimed:", schedule.claimedAmount.toString());
console.log("Start:", new Date(schedule.startTime.toNumber() * 1000));
console.log("Cliff:", new Date(schedule.cliffTime.toNumber() * 1000));
console.log("End:", new Date(schedule.endTime.toNumber() * 1000));
```

### Calculate Claimable

```typescript
import { calculateClaimableTokens } from "@/lib/anchorClient";

const currentTime = Math.floor(Date.now() / 1000);
const claimable = calculateClaimableTokens(schedule, currentTime);

console.log("Unlocked:", claimable.unlocked);
console.log("Claimed:", claimable.claimed);
console.log("Claimable Now:", claimable.claimable);
```

---

## Security Considerations

### Smart Contract Security

1. **Immutable Schedule**
   - Once created, vesting parameters cannot be changed
   - Creator cannot accelerate vesting
   - Only beneficiary can claim

2. **PDA-Based Vault**
   - Tokens held in program-controlled account
   - No private keys can access directly
   - Only smart contract can transfer out

3. **Cliff Enforcement**
   - Transaction will fail before cliff
   - No way to bypass cliff period
   - On-chain timestamp checks

4. **Overflow Protection**
   - All math uses checked arithmetic
   - No possibility of overflow attacks
   - Safe u64/u128 conversions

### Best Practices

- ✅ Audit smart contract before mainnet
- ✅ Test with various schedules on devnet
- ✅ Verify calculations independently
- ✅ Use standard presets when possible
- ✅ Document vesting schedule publicly

---

## Troubleshooting

### "Cliff not reached yet"
**Solution**: Wait until cliff period passes. Check `cliffTime` in schedule.

### "No tokens to claim"
**Solution**: Either all tokens claimed or nothing unlocked yet. Check `claimable` amount.

### "Vesting schedule not found"
**Solution**: Vesting hasn't been initialized. Run `rpc_initializeVesting` first.

### "Unauthorized"
**Solution**: Only the beneficiary can claim. Ensure correct wallet connected.

---

## Cost Estimates

### Devnet (Testing)
- Initialize Vesting: ~0.01 SOL
- Claim Tokens: ~0.000005 SOL per claim
- Storage Rent: ~0.002 SOL

### Mainnet (Production)
- Initialize Vesting: ~0.01 SOL
- Claim Tokens: ~0.000005 SOL per claim
- Storage Rent: ~0.002 SOL (one-time)

**Total Setup Cost**: ~0.012 SOL (~$1-2 USD)

---

## Next Steps

1. **Build Smart Contract**
   ```bash
   anchor build
   ```

2. **Update IDL**
   ```bash
   cp target/idl/fundly.json frontend/src/idl/fundly.json
   ```

3. **Deploy to Devnet**
   ```bash
   anchor deploy --provider.cluster devnet
   ```

4. **Test Vesting**
   - Initialize schedule with short durations (minutes instead of months)
   - Test claim before cliff (should fail)
   - Test claim after cliff (should succeed)
   - Verify calculations

5. **Deploy to Mainnet**
   - After thorough testing
   - After security audit
   - With production parameters

---

## Support & Resources

- **Anchor Docs**: https://www.anchor-lang.com/
- **Solana Docs**: https://docs.solana.com/
- **Time Conversion**: https://www.epochconverter.com/

---

## Summary

The vesting system provides:
- ✅ Trustless token locking
- ✅ Automated unlock scheduling  
- ✅ Transparent on-chain verification
- ✅ Flexible configuration
- ✅ User-friendly claiming

This builds **investor confidence** while giving creators **fair access** to their tokens over time.

**Ready to implement? Start with the `VestingPresets.standard12Month` template!** 🚀

