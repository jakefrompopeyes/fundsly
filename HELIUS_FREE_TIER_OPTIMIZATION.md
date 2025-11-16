# Helius Free Tier Optimization Guide

## Issues Fixed

### 1. **"Trying to access beyond buffer length" Error**

**Location**: `frontend/src/lib/anchorClient.ts` - `fetchTokenMetadata()` function

**Root Cause**: 
- When parsing Metaplex metadata accounts, the code was reading length values without validating them
- Corrupted or malformed metadata accounts could return very large length values
- This caused buffer access errors when trying to read beyond the actual buffer size

**Solution Implemented**:
- Added comprehensive bounds checking before every buffer read operation
- Validate that buffer is large enough before reading (minimum 65 bytes)
- Check each field length against both buffer size AND Metaplex standards:
  - Name: max 32 bytes
  - Symbol: max 10 bytes  
  - URI: max 200 bytes
- Return `null` gracefully if any validation fails
- Log specific error messages for debugging

**Code Changes**:
```typescript
// Before: No validation
const nameLen = data.readUInt32LE(offset);
const name = data.slice(offset, offset + nameLen).toString('utf8');

// After: Full validation
if (offset + 4 > data.length) {
  console.error("Invalid metadata: cannot read name length");
  return null;
}
const nameLen = data.readUInt32LE(offset);
offset += 4;

if (nameLen > 32 || offset + nameLen > data.length) {
  console.error(`Invalid metadata: name length ${nameLen} exceeds buffer`);
  return null;
}
const name = data.slice(offset, offset + nameLen).toString('utf8');
```

---

### 2. **"Server responded with 429" Rate Limit Errors**

**Location**: `frontend/src/components/trading/TransactionHistory.tsx`

**Root Cause**:
Helius free tier has strict rate limits:
- ~100 requests per second
- ~250,000 requests per day

The original implementation was:
- Fetching 20 signatures per page load
- Processing 5 transactions concurrently
- Only 100ms delay between batches
- Auto-refreshing every 45 seconds
- No retry logic for 429 errors

**Solutions Implemented**:

#### A. **Exponential Backoff Retry Logic**
```typescript
const fetchWithRetry = async <T,>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 500
): Promise<T | null> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const is429 = error?.message?.includes("429") || error?.status === 429;
      
      if (is429 && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i); // 500ms, 1000ms, 2000ms
        console.warn(`Rate limited - retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (!is429) {
        throw error; // Non-429 errors throw immediately
      }
    }
  }
  return null;
};
```

#### B. **Reduced Request Volume**
- **Signatures**: Reduced from 20 → 15 per fetch
- **Batch size**: Reduced from 5 → 2 concurrent requests
- **Delay between batches**: Increased from 100ms → 500ms
- **Auto-refresh interval**: Increased from 45s → 60s

#### C. **Graceful Degradation**
- If requests fail after retries, show empty state instead of crashing
- Log warnings instead of errors for rate limit issues
- Continue functioning with partial data

---

## Helius Free Tier Best Practices

### Current Limits (Free Tier)
- **Rate Limit**: ~100 requests/second
- **Daily Limit**: ~250,000 requests/day
- **No Burst**: Consistent rate enforcement

### Optimization Strategies

#### 1. **Request Batching**
```typescript
// ✅ Good: Small batches with delays
const batchSize = 2;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await Promise.all(batch.map(item => fetchData(item)));
  await new Promise(resolve => setTimeout(resolve, 500));
}

// ❌ Bad: Large concurrent requests
await Promise.all(items.map(item => fetchData(item)));
```

#### 2. **Caching Strategy**
Consider implementing:
- Local storage caching for transaction history
- Timestamp-based cache invalidation
- Only fetch new transactions since last update

#### 3. **Progressive Loading**
```typescript
// Load most recent first
const recentTxs = await fetch(limit: 5);
setTransactions(recentTxs);

// Then load more in background
const moreTxs = await fetch(limit: 15);
setTransactions([...recentTxs, ...moreTxs]);
```

#### 4. **Request Prioritization**
- Critical requests: User wallet balance, current price
- Important: Recent 5 transactions
- Nice to have: Full transaction history, historical data

#### 5. **WebSocket Subscriptions**
Instead of polling, consider using Helius webhooks for real-time updates:
```typescript
// Instead of setInterval every 60s
// Use Helius account monitoring webhooks
```

---

## Monitoring Rate Limits

Add logging to track your usage:

```typescript
let requestCount = 0;
let windowStart = Date.now();

const trackRateLimit = () => {
  requestCount++;
  const elapsed = Date.now() - windowStart;
  
  if (elapsed >= 60000) {
    console.log(`Rate: ${requestCount} requests/min`);
    requestCount = 0;
    windowStart = Date.now();
  }
};
```

---

## When to Upgrade to Paid Tier

Consider upgrading when:

1. **Consistent 429 errors** despite optimizations
2. **User base grows** beyond 10-20 concurrent users
3. **Need for real-time data** (<10s latency)
4. **Multiple features** requiring RPC calls simultaneously

**Helius Paid Tiers**:
- **Developer**: $50/month - 500 req/s, unlimited daily
- **Professional**: $250/month - 1,500 req/s, premium support
- **Enterprise**: Custom pricing - Dedicated infrastructure

---

## Testing Rate Limits

To test if optimizations are working:

```bash
# Monitor console for rate limit warnings
# Should see exponential backoff messages instead of crashes

# Check network tab in browser DevTools
# Count RPC requests per minute
# Should be under 100/minute for free tier
```

---

## Alternative RPC Providers

If Helius free tier is insufficient, consider:

1. **Alchemy** - Similar free tier, good for development
2. **QuickNode** - Different rate limit structure
3. **Multiple providers** - Rotate between endpoints
4. **Self-hosted** - Run your own Solana RPC node

---

## Summary of Changes

### anchorClient.ts
- ✅ Added buffer bounds validation
- ✅ Added Metaplex standard length checks
- ✅ Graceful error handling with null returns

### TransactionHistory.tsx  
- ✅ Implemented exponential backoff retry logic
- ✅ Reduced concurrent requests (5 → 2)
- ✅ Increased delays between batches (100ms → 500ms)
- ✅ Increased auto-refresh interval (45s → 60s)
- ✅ Reduced signatures fetched (20 → 15)
- ✅ Graceful degradation on failures

### Impact
- **Buffer errors**: Should be eliminated completely
- **429 errors**: Should be rare, automatically retried
- **User experience**: More stable, slightly slower data updates
- **RPC usage**: Reduced by ~40-50%

---

## Next Steps (Optional Improvements)

1. **Implement caching** for transaction history
2. **Add loading states** during retries
3. **Use Helius webhooks** for real-time updates
4. **Add request queue** for rate limiting across components
5. **Implement progressive loading** for better UX
6. **Monitor actual RPC usage** with analytics

---

**Last Updated**: November 14, 2024  
**Status**: ✅ Production Ready


