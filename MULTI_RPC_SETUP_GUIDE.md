# Multi-RPC Setup Guide

This guide will help you configure multiple RPC providers to avoid rate limiting and ensure high availability.

## Why Multiple RPCs?

Single RPC providers have rate limits that can cause `429 (Too Many Requests)` errors:
- **Helius Free**: 100 req/s, 250k req/day
- **Alchemy Free**: 300 compute units/sec
- **QuickNode Free**: 100k credits/month

By using multiple providers, you get:
- ✅ **Automatic load balancing** - Distributes requests across providers
- ✅ **Failover protection** - Switches to backup when one fails
- ✅ **Higher rate limits** - Combined limits from all providers
- ✅ **Better reliability** - No single point of failure

---

## Quick Start (5 minutes)

### 1. Sign Up for Free RPC Accounts

#### Helius (Recommended - Best for Solana)
1. Go to https://dev.helius.xyz/dashboard/app
2. Sign up with your email
3. Create a new project
4. Copy your API key

#### Alchemy (Recommended - Good free tier)
1. Go to https://dashboard.alchemy.com/
2. Sign up with your email
3. Create new app → Select Solana → Devnet (or Mainnet)
4. Copy the HTTPS endpoint URL

#### QuickNode (Optional - Additional backup)
1. Go to https://dashboard.quicknode.com/
2. Sign up with your email
3. Create endpoint → Select Solana → Devnet (or Mainnet)
4. Copy the endpoint URL

---

### 2. Configure Environment Variables

Create or edit `frontend/.env.local`:

```bash
# Solana Network
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# Helius RPC
NEXT_PUBLIC_HELIUS_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY

# Alchemy RPC
NEXT_PUBLIC_ALCHEMY_RPC_ENDPOINT=https://solana-devnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# QuickNode RPC (Optional)
NEXT_PUBLIC_QUICKNODE_RPC_ENDPOINT=https://YOUR_ENDPOINT.solana-devnet.quiknode.pro/YOUR_API_KEY/
```

**Replace the placeholders with your actual API keys!**

---

### 3. For Mainnet

When deploying to production, update the URLs:

```bash
# Mainnet network
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Helius Mainnet
NEXT_PUBLIC_HELIUS_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY

# Alchemy Mainnet
NEXT_PUBLIC_ALCHEMY_RPC_ENDPOINT=https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# QuickNode Mainnet
NEXT_PUBLIC_QUICKNODE_RPC_ENDPOINT=https://YOUR_ENDPOINT.solana-mainnet.quiknode.pro/YOUR_API_KEY/
```

---

## How It Works

### Automatic Load Balancing

The RPC Manager automatically:

1. **Rotates endpoints** - Switches after 50 requests per minute
2. **Detects rate limits** - Immediately switches on 429 errors
3. **Tracks errors** - Marks problematic endpoints as unhealthy
4. **Cooldown period** - Gives failing endpoints time to recover
5. **Priority system** - Prefers higher-priority providers

### Priority Levels

Endpoints are prioritized automatically:
- **Priority 1**: Helius, Alchemy (best for production)
- **Priority 2**: QuickNode (good backup)
- **Priority 10**: Public RPC (last resort, very limited)

---

## Monitoring

Check which RPC is being used in the browser console:

```
🔗 RPC Manager initialized with endpoints: Helius (priority: 1), Alchemy (priority: 1)
🔗 Using RPC endpoint: https://devnet.helius-rpc.com/?api-key=...
```

When rate limits are hit:

```
⚠️ Rate limit (429) on Helius, rotating...
🔄 Rotating to Alchemy
```

---

## Testing Your Setup

1. Start the development server:
```bash
cd frontend
npm run dev
```

2. Open browser console (F12)

3. Look for RPC manager initialization:
```
🔗 RPC Manager initialized with endpoints: ...
```

4. Navigate to a page that fetches transactions

5. Watch for automatic rotation if limits are hit

---

## Troubleshooting

### "No custom RPC endpoints configured"

**Problem**: You see this warning in the console

**Solution**: Make sure your `.env.local` file:
- Exists in the `frontend/` directory
- Has at least one `NEXT_PUBLIC_*_RPC_ENDPOINT` variable
- Has been saved
- Restart the dev server after editing

### "Rate limited - retrying after 500ms..."

**Problem**: Still seeing 429 errors

**Solutions**:
1. **Check API keys** - Make sure they're valid and active
2. **Verify URLs** - Check for typos in endpoint URLs
3. **Add more providers** - Configure additional RPCs
4. **Upgrade tier** - Consider paid plans for higher limits

### "All RPC endpoints in cooldown, resetting..."

**Problem**: All RPCs are rate limited simultaneously

**Solutions**:
1. **Add more providers** - Diversify across different companies
2. **Reduce request volume** - Increase polling intervals
3. **Implement caching** - Cache responses locally
4. **Upgrade plans** - Get paid tiers with higher limits

---

## Cost Comparison

### Free Tiers (Sufficient for Development)

| Provider | Rate Limit | Daily Limit | Cost |
|----------|------------|-------------|------|
| Helius | 100 req/s | 250k/day | Free |
| Alchemy | ~300 CU/s | ~2M CU/day | Free |
| QuickNode | Varies | 100k credits | Free |
| **Combined** | **~200 req/s** | **~500k/day** | **$0** |

### Paid Tiers (For Production)

| Provider | Plan | Rate Limit | Cost/Month |
|----------|------|------------|------------|
| Helius | Developer | 500 req/s | $50 |
| Helius | Professional | 1,500 req/s | $250 |
| Alchemy | Growth | 1,200 CU/s | $49 |
| QuickNode | Build | 25 req/s | $49 |

**Recommendation**: Start with all free tiers (3 providers) = 0 cost, ~200 req/s

---

## Best Practices

### 1. Always Use Multiple RPCs

```bash
# ✅ Good - Multiple providers
NEXT_PUBLIC_HELIUS_RPC_ENDPOINT=...
NEXT_PUBLIC_ALCHEMY_RPC_ENDPOINT=...

# ❌ Bad - Single provider
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=...
```

### 2. Keep API Keys Secret

```bash
# ✅ Good - In .env.local (gitignored)
NEXT_PUBLIC_HELIUS_RPC_ENDPOINT=https://...?api-key=abc123

# ❌ Bad - Hardcoded in source
const endpoint = "https://...?api-key=abc123";
```

### 3. Test Before Deploying

Always test with your actual RPC endpoints in `.env.local` before deploying to production.

### 4. Monitor Your Usage

Check provider dashboards regularly to track:
- Request volume
- Error rates  
- Remaining credits
- Rate limit hits

---

## Deployment (Vercel/Railway/etc.)

Add environment variables in your hosting platform:

### Vercel
1. Project Settings → Environment Variables
2. Add each `NEXT_PUBLIC_*_RPC_ENDPOINT`
3. Redeploy

### Railway
1. Project → Variables
2. Add each `NEXT_PUBLIC_*_RPC_ENDPOINT`
3. Redeploy

### Other Platforms
Follow their documentation for adding environment variables.

---

## Advanced Configuration

### Custom Priority

Edit `frontend/src/lib/rpcManager.ts` to adjust priorities:

```typescript
// Higher priority for specific provider
endpoints.push({
  name: 'Helius',
  url: heliusUrl,
  priority: 0, // Change from 1 to 0 for highest priority
  maxRetries: 2,
  errorCount: 0,
});
```

### Adjust Rate Limit Threshold

```typescript
private readonly RATE_LIMIT_THRESHOLD = 50; // Change to 30 for faster rotation
```

### Adjust Cooldown Period

```typescript
private readonly COOLDOWN_PERIOD = 60000; // Change to 30000 for 30 second cooldown
```

---

## Support

If you continue experiencing rate limit issues:

1. **Check provider status pages**:
   - Helius: https://status.helius.dev/
   - Alchemy: https://status.alchemy.com/
   - QuickNode: https://status.quicknode.com/

2. **Review logs** in browser console for specific error messages

3. **Test each endpoint individually** to isolate issues

4. **Contact provider support** if API keys aren't working

---

## Summary

✅ **Setup**: 5 minutes to configure  
✅ **Cost**: $0 for development (free tiers)  
✅ **Reliability**: 3x more reliable with multiple providers  
✅ **Rate Limits**: Combined ~200 req/s, ~500k req/day  
✅ **Automatic**: No code changes needed, works automatically  

**Get Started Now**:
1. Sign up for Helius + Alchemy (5 minutes)
2. Add API keys to `.env.local`
3. Restart dev server
4. Done! 🎉

---

**Last Updated**: November 14, 2024  
**Status**: ✅ Production Ready


