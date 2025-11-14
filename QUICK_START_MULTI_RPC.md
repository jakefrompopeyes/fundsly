# Quick Start: Fix Rate Limiting with Multiple RPCs

## The Problem

You're seeing these errors:
- ❌ `Server responded with 429. Retrying after 500ms delay...`
- ❌ `Trying to access beyond buffer length`

**Cause**: Helius free tier rate limits (100 req/s, 250k req/day)

---

## The Solution (5 Minutes)

### Step 1: Sign Up for Alchemy (FREE)

1. Go to: https://dashboard.alchemy.com/
2. Click "Sign Up" 
3. Create new app → Select **Solana** → **Devnet**
4. Copy the **HTTPS endpoint URL**

Example: `https://solana-devnet.g.alchemy.com/v2/abc123xyz`

### Step 2: Add to Your Project

**Option A: Automatic Setup (Recommended)**

```bash
# Run the setup script
./setup-rpc.sh

# Then edit frontend/.env.local and add your API keys
```

**Option B: Manual Setup**

Create or edit `frontend/.env.local`:

```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# Your existing Helius key
NEXT_PUBLIC_HELIUS_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY

# Add your new Alchemy endpoint
NEXT_PUBLIC_ALCHEMY_RPC_ENDPOINT=https://solana-devnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

### Step 3: Restart Dev Server

```bash
cd frontend
npm run dev
```

### Step 4: Verify It's Working

Open browser console (F12) and look for:

```
✅ 🔗 RPC Manager initialized with endpoints: Helius (priority: 1), Alchemy (priority: 1)
✅ 🔗 Using RPC endpoint: https://devnet.helius-rpc.com/...
```

When rate limits are hit, you'll see:
```
⚠️ Rate limit (429) on Helius, rotating...
🔄 Rotating to Alchemy
```

---

## What This Does

✅ **Automatically rotates** between Helius and Alchemy  
✅ **Doubles your rate limits** (~200 req/s combined)  
✅ **Provides failover** - If one fails, uses the other  
✅ **No code changes needed** - Works automatically  

---

## Results

| Before | After |
|--------|-------|
| ❌ 429 errors every few minutes | ✅ Rare 429 errors |
| ❌ Single point of failure | ✅ Automatic failover |
| ❌ 100 req/s limit | ✅ 200+ req/s combined |
| ❌ Buffer access errors | ✅ Fixed with validation |

---

## Troubleshooting

### Still seeing 429 errors?

1. **Check API keys are valid**:
   ```bash
   # Test Helius
   curl "https://devnet.helius-rpc.com/?api-key=YOUR_KEY" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
   
   # Test Alchemy
   curl "https://solana-devnet.g.alchemy.com/v2/YOUR_KEY" \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
   ```

2. **Verify .env.local location**:
   ```bash
   # Should be in frontend/ directory
   ls -la frontend/.env.local
   ```

3. **Check environment variables are loaded**:
   ```javascript
   // In browser console
   console.log(process.env.NEXT_PUBLIC_HELIUS_RPC_ENDPOINT);
   console.log(process.env.NEXT_PUBLIC_ALCHEMY_RPC_ENDPOINT);
   ```

### Buffer errors still happening?

These should be fixed automatically with the buffer validation we added. If you still see them:

```bash
# Check the logs for specific errors
# Look for: "Invalid metadata: ..." messages
```

---

## Next Steps (Optional)

### Add More Providers

You can add QuickNode for even more reliability:

```bash
# Sign up at https://dashboard.quicknode.com/
NEXT_PUBLIC_QUICKNODE_RPC_ENDPOINT=https://YOUR_ENDPOINT.solana-devnet.quiknode.pro/YOUR_KEY/
```

### For Mainnet

When deploying to production, change endpoints:

```bash
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_HELIUS_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_ALCHEMY_RPC_ENDPOINT=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### Monitor Usage

Check your provider dashboards:
- Helius: https://dev.helius.xyz/dashboard/app
- Alchemy: https://dashboard.alchemy.com/

---

## Cost

**Development (Free Tier)**:
- Helius: 100 req/s, 250k req/day - **$0**
- Alchemy: 300 CU/s, ~2M CU/day - **$0**
- **Total: $0/month** ✅

**Production (If needed)**:
- Start with free tier
- Upgrade only if you hit limits consistently
- Helius Developer: $50/month (500 req/s)
- Alchemy Growth: $49/month (1,200 CU/s)

---

## Summary

**Time to setup**: 5 minutes  
**Cost**: $0 (free tiers)  
**Benefit**: 2x rate limits + automatic failover  
**Maintenance**: Zero - works automatically  

**Get started now**:
```bash
./setup-rpc.sh
```

Then add your Alchemy API key to `frontend/.env.local` and restart! 🚀

---

## Files Changed

✅ `frontend/src/lib/rpcManager.ts` - Multi-RPC rotation logic  
✅ `frontend/src/components/wallet/WalletProviders.tsx` - Uses RPC manager  
✅ `frontend/src/components/trading/TransactionHistory.tsx` - Reports errors  
✅ `frontend/src/lib/anchorClient.ts` - Buffer validation  

**All changes are backward compatible** - Still works with single RPC if needed.

---

**Need help?** See detailed guide: `MULTI_RPC_SETUP_GUIDE.md`

**Last Updated**: November 14, 2024

