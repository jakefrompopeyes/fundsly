# 🔵 Automatic DEX Listing System

## How It Works

When a token reaches the migration threshold and migrates:

1. ✅ **Funds are locked** in migration vaults (85 SOL + remaining tokens)
2. 🤖 **Auto-pool script runs** (either manually or via watcher service)
3. 🔵 **Raydium pool is created** with the locked funds
4. 🌐 **Token is automatically listed** across the Solana DEX ecosystem!

## Where Your Token Gets Listed

Once the Raydium pool is created, your token is **automatically discoverable** on:

### Direct Listings
- ✅ **Raydium** - Primary DEX (https://raydium.io)
- ✅ **Jupiter Aggregator** - Auto-indexes all Raydium pools
- ✅ **Orca** - Via Jupiter routing
- ✅ **1inch** - Cross-chain aggregator

### Token Tracking Sites
- ✅ **DexScreener** - Auto-discovers new pools
- ✅ **Birdeye** - Analytics and trading
- ✅ **CoinGecko** - (after volume threshold)
- ✅ **CoinMarketCap** - (application required)

### Trading Platforms
- ✅ **Phantom Wallet** - In-wallet swaps
- ✅ **Solflare** - In-wallet swaps
- ✅ **TradingView** - Via DEX data feeds

**No manual listing required!** Creating a Raydium pool = Automatic presence everywhere.

---

## Usage Methods

### Method 1: Manual Pool Creation (On Demand)

Create a pool for a specific migrated token:

```bash
npx ts-node scripts/auto-create-pool-for-migration.ts <MINT_ADDRESS>
```

**Example**:
```bash
npx ts-node scripts/auto-create-pool-for-migration.ts EjsCEFBt8pkGATg7YVKA1toEYyXHanGC49bSdxLpYAfN
```

**When to use**: 
- Testing individual migrations
- Manual control over timing
- One-off pool creation

---

### Method 2: Automatic Watcher Service (Recommended)

Run a service that monitors for migrations and auto-creates pools:

```bash
node scripts/auto-pool-watcher.js
```

**What it does**:
- 👂 Listens for `MigrationComplete` events
- 🔍 Checks for migrated tokens periodically
- 🤖 Automatically creates pools when detected
- 💾 Tracks processed migrations to avoid duplicates

**When to use**:
- Production environment
- Want fully automatic system
- Multiple migrations happening

**Run as background service**:
```bash
# Using PM2 (recommended)
pm2 start scripts/auto-pool-watcher.js --name fundly-pool-watcher

# Using screen
screen -S pool-watcher
node scripts/auto-pool-watcher.js
# Press Ctrl+A, then D to detach

# Using systemd (production)
# Create /etc/systemd/system/fundly-pool-watcher.service
```

---

### Method 3: Integrate with Your Backend

Add to your existing backend:

```typescript
// In your backend
import { createRaydiumPool } from './raydium-integration';

// Listen for migrations
program.addEventListener("MigrationComplete", async (event) => {
  console.log(`🎉 Token ${event.mint} migrated!`);
  
  // Auto-create pool
  const poolId = await createRaydiumPool(
    connection,
    adminKeypair,
    event.mint
  );
  
  console.log(`✅ Pool created: ${poolId}`);
  
  // Optional: Send notifications
  await notifyUsers(event.mint, poolId);
  await updateDatabase(event.mint, { poolId, listed: true });
});
```

---

## Pool Creation Process

### What Happens Behind the Scenes

1. **Verify Migration**
   - Check token is migrated ✅
   - Confirm funds are in migration vaults ✅

2. **Calculate Initial Price**
   ```
   initial_price = SOL_in_vault / tokens_in_vault
   ```
   Example: 85 SOL / 800M tokens = 0.00000010625 SOL per token

3. **Create CPMM Pool**
   - Initialize Raydium pool
   - Set LP fees (2.5% default)
   - Set protocol fees (2% default)
   - Deposit SOL and tokens

4. **Mint LP Tokens**
   - LP tokens represent pool ownership
   - Can be locked or distributed
   - Protocol can keep or burn them

5. **Activate Pool**
   - Pool becomes active immediately
   - Trading enabled on Raydium
   - Indexed by aggregators within minutes

---

## Configuration Options

### Pool Parameters

Edit in `auto-create-pool-for-migration.ts`:

```typescript
const config = {
  createPoolFee: 0.4, // SOL - Raydium creation fee
  protocolFeeRate: 2000, // 2% (in basis points)
  tradeFeeRate: 2500, // 2.5% (in basis points)
  fundOwner: adminWallet, // Who can manage the pool
  initialPrice: calculated, // Auto-calculated from vaults
  startTime: now, // Start trading immediately
};
```

### Fee Distribution

Trade fees are split:
- **LP Providers**: 2.5% (standard)
- **Protocol**: 2% (Raydium)
- **You**: Can add additional fees if desired

---

## Testing on Devnet

### Step 1: Migrate a Token
```bash
# In your UI, migrate a token
# Or run: npx ts-node scripts/test-migration.ts <MINT>
```

### Step 2: Create Pool
```bash
npx ts-node scripts/auto-create-pool-for-migration.ts <MINT_ADDRESS>
```

### Step 3: Verify Listing
```bash
# Check on Raydium (devnet)
https://raydium.io/swap/?ammId=<POOL_ID>&tab=swap

# Check on Jupiter (devnet)
https://jup.ag/swap/SOL-<MINT_ADDRESS>?explorer=devnet

# View in Solana Explorer
https://explorer.solana.com/address/<MINT_ADDRESS>?cluster=devnet
```

---

## Production Deployment

### Prerequisites

1. **Sufficient SOL in admin wallet**
   - Pool creation fee: ~0.4 SOL per pool
   - Transaction fees: ~0.01 SOL per pool
   - Recommended: Keep 10+ SOL in wallet

2. **RPC endpoint with high rate limits**
   - Alchemy, QuickNode, or Helius recommended
   - Free tier works for testing
   - Paid tier recommended for production

3. **Monitoring setup**
   - Watch for failed pool creations
   - Alert on low balance
   - Track pool creation metrics

### Deploy Watcher Service

```bash
# Install PM2 globally
npm install -g pm2

# Start watcher
cd /path/to/fundly.site
pm2 start scripts/auto-pool-watcher.js --name fundly-pool-watcher

# Configure to start on boot
pm2 startup
pm2 save

# Monitor logs
pm2 logs fundly-pool-watcher
```

### Environment Variables

Create `.env.production`:
```bash
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://your-rpc-endpoint.com
RAYDIUM_API_KEY=your_api_key_if_needed
ADMIN_WALLET_PATH=/secure/path/to/wallet.json
```

---

## Troubleshooting

### "Migration vault is empty"
**Cause**: Token not migrated yet  
**Fix**: Complete migration first, then create pool

### "Insufficient funds for pool creation"
**Cause**: Admin wallet needs ~0.5 SOL per pool  
**Fix**: Add SOL to admin wallet

### "Pool already exists"
**Cause**: Pool was already created for this token  
**Fix**: Check Raydium, pool ID may be in bonding curve data

### "Transaction failed"
**Cause**: Various (network, RPC limits, etc.)  
**Fix**: Check logs, retry with higher priority fee

---

## Costs

### Per Pool Creation

| Item | Cost | Notes |
|------|------|-------|
| Raydium Creation Fee | 0.4 SOL | Paid to Raydium |
| Transaction Fees | ~0.01 SOL | Network fees |
| **Total** | **~0.41 SOL** | Per pool |

### Monthly Estimate

Assuming 100 migrations per month:
- Pool creation: 100 × 0.41 = **41 SOL**
- Watcher service: ~1 SOL (RPC + compute)
- **Total**: **~42 SOL/month**

At $100/SOL = **$4,200/month**

---

## Benefits

### For Token Creators
✅ Automatic DEX listing  
✅ No manual work required  
✅ Instant liquidity on Raydium  
✅ Professional appearance  

### For Traders
✅ Can trade immediately after migration  
✅ Best prices via Jupiter aggregation  
✅ Familiar DEX interfaces  
✅ Trust in established platforms  

### For Platform
✅ Seamless user experience  
✅ Competitive with pump.fun  
✅ Low maintenance overhead  
✅ Scalable architecture  

---

## Advanced: Custom Pool Configurations

### Different Fee Structures

```typescript
// Low fee pool (for high volume tokens)
tradeFeeRate: 500, // 0.5%

// High fee pool (for memecoins)
tradeFeeRate: 10000, // 10%
```

### Delayed Start Time

```typescript
// Pool exists but trading disabled until start time
startTime: new anchor.BN(futureTimestamp),
```

### Custom LP Token Handling

```typescript
// Burn LP tokens (permanent liquidity lock)
await burnLPTokens(lpMint, lpAmount);

// Distribute to early buyers
await distributeLPTokens(lpMint, holders);

// Time-lock LP tokens
await lockLPTokens(lpMint, lpAmount, unlockDate);
```

---

## Comparison to Competitors

| Feature | Fundly | Pump.fun | Raydium |
|---------|---------|----------|---------|
| Auto Pool Creation | ✅ Yes | ✅ Yes | ❌ Manual |
| Migration System | ✅ Yes | ✅ Yes | N/A |
| DEX Integration | ✅ Raydium | ✅ Raydium | ✅ Native |
| Listing Speed | 🤖 Instant | 🤖 Instant | 👤 Manual |
| User Control | ✅ Full | ⚠️ Limited | ✅ Full |

---

## Next Steps

1. ✅ **Test on Devnet**
   ```bash
   # Create a test token and migrate it
   # Then run: npx ts-node scripts/auto-create-pool-for-migration.ts <MINT>
   ```

2. ✅ **Deploy Watcher Service**
   ```bash
   pm2 start scripts/auto-pool-watcher.js
   ```

3. ✅ **Monitor First Pools**
   - Watch logs for any errors
   - Verify pools appear on Raydium
   - Check Jupiter finds them

4. ✅ **Scale to Production**
   - Deploy to mainnet
   - Set up monitoring/alerts
   - Document for your team

---

## Support

**Questions?**
- Check Raydium docs: https://docs.raydium.io/
- Solana Stack Exchange: https://solana.stackexchange.com/
- Raydium Discord: https://discord.gg/raydium

**Issues?**
- Check watcher logs: `pm2 logs fundly-pool-watcher`
- Verify RPC endpoint is working
- Ensure sufficient SOL in admin wallet

---

**🎉 Congratulations! Your platform now has automatic DEX listing!**

Tokens will seamlessly go from bonding curve → Raydium → Entire Solana DEX ecosystem!


