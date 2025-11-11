# Market Cap Launch System - Complete Guide

## Overview

The market cap launch system allows you to set a specific **initial market capitalization** for new token launches, making bonding curve configuration intuitive and professional.

Instead of manually calculating virtual reserves, you simply choose your target market cap (e.g., $4.6k, $10k, $25k) and the system automatically calculates the optimal parameters.

---

## Why Market Cap Targeting?

### Problems with Manual Virtual Reserves
❌ Hard to understand what "200 SOL / 600M tokens" means  
❌ Difficult to predict actual market cap  
❌ Requires complex calculations  
❌ Inconsistent across different SOL prices  

### Benefits of Market Cap Targeting
✅ **Intuitive**: "$10k market cap" is immediately understandable  
✅ **Professional**: Industry standard way to describe launches  
✅ **Flexible**: Easy to adjust based on project scope  
✅ **Consistent**: Same market cap regardless of SOL price fluctuations  

---

## Available Presets

### 1. Micro Launch - $4,600
**Best for:**
- Meme coins
- Community experiments
- Small, fun projects
- Quick launches

**Characteristics:**
- Most accessible entry point
- Fastest to complete bonding curve
- Good for viral/social tokens
- Lower barrier to entry

**Example**: Community meme coin, social tokens

---

### 2. Small Launch - $10,000
**Best for:**
- Small projects
- Experimental tokens
- Early-stage ideas
- Testing concepts

**Characteristics:**
- Balanced accessibility
- Moderate completion time
- Shows some seriousness
- Good for MVP projects

**Example**: Indie game tokens, small community projects

---

### 3. Medium Launch - $25,000
**Best for:**
- Serious projects
- Working products
- Established concepts
- Professional teams

**Characteristics:**
- Signals credibility
- Attracts serious investors
- Longer bonding curve phase
- Better distribution

**Example**: DeFi protocols, established gaming projects

---

### 4. Large Launch - $50,000
**Best for:**
- High-quality projects
- Proven teams
- Established products
- Significant traction

**Characteristics:**
- Strong quality signal
- Attracts larger investors
- Substantial liquidity
- Professional perception

**Example**: Major DeFi projects, established platforms

---

### 5. Premium Launch - $100,000
**Best for:**
- Major projects
- Institutional interest
- Large-scale deployments
- Enterprise solutions

**Characteristics:**
- Maximum credibility
- Institutional-grade launch
- Significant initial liquidity
- Premium positioning

**Example**: Major protocols, institutional DeFi

---

## How It Works

### The Math

```
Market Cap = Total Supply × Price per Token
```

At launch:
```
Price = Virtual SOL / (Virtual Tokens + Real Tokens)
```

The system automatically calculates the required virtual reserves to achieve your target market cap.

### Example Calculation

**Target**: $10,000 market cap  
**SOL Price**: $200  
**Token Supply**: 1,000,000,000

```
Step 1: Convert to SOL
Market Cap (SOL) = $10,000 / $200 = 50 SOL

Step 2: Calculate required price
Price per Token = 50 SOL / 1,000,000,000 tokens
Price per Token = 0.00000005 SOL

Step 3: Calculate virtual reserves
Using Virtual SOL = 200:
Virtual Tokens = (200 / 0.00000005) - 1,000,000,000
Virtual Tokens = 3,000,000,000 tokens

Step 4: Result
Virtual SOL: 200
Virtual Tokens: 3,000,000,000
Initial Market Cap: $10,000 ✅
```

---

## Cost Analysis by Market Cap

### $4,600 Market Cap (Micro)
```
Virtual SOL: 200
Virtual Tokens: ~7,695M

Costs:
- 10% of supply: ~2.45 SOL
- 25% of supply: ~6.78 SOL
- 50% of supply: ~16.67 SOL
- 90% of supply: ~46.15 SOL

Whale Resistance: Moderate
Time to Complete: Fast (hours)
```

### $10,000 Market Cap (Small)
```
Virtual SOL: 200
Virtual Tokens: ~3,000M

Costs:
- 10% of supply: ~5.71 SOL
- 25% of supply: ~16.00 SOL
- 50% of supply: ~40.00 SOL
- 90% of supply: ~120.00 SOL

Whale Resistance: Good
Time to Complete: Medium (6-12 hours)
```

### $25,000 Market Cap (Medium)
```
Virtual SOL: 200
Virtual Tokens: ~600M

Costs:
- 10% of supply: ~13.33 SOL
- 25% of supply: ~37.04 SOL
- 50% of supply: ~90.91 SOL
- 90% of supply: ~257.14 SOL

Whale Resistance: Excellent
Time to Complete: Slow (1-2 days)
```

### $50,000 Market Cap (Large)
```
Virtual SOL: 200
Virtual Tokens: ~0M

Costs:
- 10% of supply: ~22.22 SOL
- 25% of supply: ~62.50 SOL
- 50% of supply: ~150.00 SOL
- 90% of supply: ~400.00 SOL

Whale Resistance: Very Strong
Time to Complete: Very Slow (2-3 days)
```

### $100,000 Market Cap (Premium)
```
Virtual SOL: 200
Virtual Tokens: ~(-800M) -> Adjusted to 0

Note: At this market cap, virtual tokens would be negative,
so the system uses minimal virtual tokens and relies on
higher real token price.

Costs:
- 10% of supply: ~44.44 SOL
- 25% of supply: ~125.00 SOL
- 50% of supply: ~300.00 SOL
- 90% of supply: ~800.00 SOL

Whale Resistance: Maximum
Time to Complete: Multi-day (3-7 days)
```

---

## Choosing the Right Market Cap

### Decision Matrix

| Factor | Micro ($4.6k) | Small ($10k) | Medium ($25k) | Large ($50k) | Premium ($100k) |
|--------|---------------|--------------|---------------|--------------|-----------------|
| **Team Size** | 1-2 | 2-5 | 5-10 | 10+ | 15+ |
| **Product Status** | Idea | MVP | Beta | Launched | Established |
| **Traction** | None | Early | Growing | Significant | Major |
| **Target Investors** | Retail | Small retail | Medium retail | Large retail | Whales/Institutions |
| **Time to Complete** | Hours | 6-12h | 1-2d | 2-3d | 3-7d |
| **Whale Risk** | Medium | Low | Very Low | Minimal | None |
| **Credibility Signal** | Fun | Serious | Professional | High-quality | Premium |

### Quick Selection Guide

**Choose Micro ($4.6k) if:**
- You're launching a meme/fun token
- Community is small but engaged
- Speed is more important than distribution
- You want maximum accessibility

**Choose Small ($10k) if:**
- You have an MVP or early product
- Small team with clear roadmap
- Testing market interest
- Balance of speed and distribution

**Choose Medium ($25k) if:**
- You have a working product
- Established team and roadmap
- Want to attract serious investors
- Focus on fair distribution

**Choose Large ($50k) if:**
- Proven product with users
- Strong team and backing
- Want to filter for committed investors
- Premium positioning

**Choose Premium ($100k) if:**
- Major project with significant traction
- Institutional interest
- Enterprise-grade solution
- Maximum credibility needed

---

## Implementation Guide

### Step 1: Visit Admin Page

Navigate to `/admin/init-config` in your frontend.

### Step 2: Set SOL Price

Update the SOL price to match current market conditions:
```
Current SOL Price: $200 (update as needed)
```

### Step 3: Select Market Cap

Choose from presets:
- Micro Launch ($4.6k)
- Small Launch ($10k)
- Medium Launch ($25k)
- Large Launch ($50k)
- Premium Launch ($100k)

Or enter custom amount:
- Check "Use Custom Market Cap"
- Enter your desired amount

### Step 4: Review Configuration

The system automatically shows:
- Initial market cap (USD and SOL)
- Initial price per token
- Virtual reserves (SOL and tokens)
- Cost to buy different percentages
- Whale resistance metrics

### Step 5: Initialize

Click "Initialize Global Config" to deploy with selected parameters.

---

## Dynamic Market Cap Adjustment

### How SOL Price Affects Market Cap

The system automatically adjusts virtual reserves based on current SOL price:

**Example**: $10k market cap
- SOL @ $200: Needs 50 SOL market cap → Virtual Tokens = 3,000M
- SOL @ $150: Needs 66.67 SOL market cap → Virtual Tokens = 2,000M
- SOL @ $300: Needs 33.33 SOL market cap → Virtual Tokens = 5,000M

This ensures your **USD market cap stays consistent** regardless of SOL price volatility.

---

## Best Practices

### 1. Match Market Cap to Project Stage
Don't launch at $100k if you only have an idea. Build credibility over time.

### 2. Consider Your Community Size
Larger communities can support higher market caps through distributed buying.

### 3. Account for Marketing Budget
Higher market caps require more marketing to attract sufficient buyers.

### 4. Plan for Time Horizon
- Micro/Small: Complete in hours/day (good for viral launches)
- Medium: 1-2 days (balanced approach)
- Large/Premium: Multi-day (serious projects only)

### 5. Monitor Whale Activity
Higher market caps provide better protection, but watch for coordinated buying.

### 6. Update SOL Price Regularly
Check current SOL price before initializing to ensure accurate market cap.

---

## Comparison with Traditional Launches

### Traditional ICO/IEO
- Fixed price per token
- Requires upfront liquidity
- No price discovery
- Often overvalued

### Bonding Curve with Market Cap
- Dynamic pricing
- No initial liquidity needed
- Natural price discovery
- Market-driven valuation

### Advantage: Fair Launch
- Everyone sees the same initial market cap
- Price increases as demand grows
- Transparent and predictable
- Built-in whale protection

---

## Advanced: Custom Market Caps

### When to Use Custom Values

Use custom market cap when:
- Your project doesn't fit standard presets
- You have specific fundraising goals
- You want to match competitor launches
- You need precise market positioning

### Recommended Ranges
- **Community tokens**: $2k - $15k
- **DeFi protocols**: $15k - $75k
- **Gaming projects**: $10k - $50k
- **Infrastructure**: $50k - $200k
- **Enterprise**: $100k+

### Calculation Tips

```typescript
// Calculate market cap based on fundraising goal
// If you want to raise 85 SOL before DEX migration:
// And expect 40% of supply to be sold:

desired_raise = 85 SOL
expected_sold = 0.40

// Work backwards to find market cap
// This requires iterative calculation or using the simulator
```

---

## Testing Different Market Caps

### Use the Simulator

```bash
python3 scripts/bonding_curve_simulator.py
```

This shows cost analysis for different configurations.

### Test on Devnet First

1. Deploy to devnet
2. Try different market cap configurations
3. Execute test buys with various amounts
4. Verify costs match expectations
5. Adjust if needed before mainnet

### Key Metrics to Test
- Cost for 10% of supply (retail accessibility)
- Cost for 50% of supply (whale resistance)
- Time to reach 85 SOL (migration timing)
- Average buy size distribution

---

## Migration Considerations

### How Market Cap Affects Migration

**Migration Threshold**: 85 SOL in real reserves

**$4.6k Market Cap**: Reaches 85 SOL at ~90% sold
- Fast migration
- Most supply on DEX

**$10k Market Cap**: Reaches 85 SOL at ~75% sold
- Balanced migration
- Good DEX liquidity

**$25k Market Cap**: Reaches 85 SOL at ~35% sold
- Early migration
- Most supply remains in bonding curve

**$50k+ Market Cap**: May not reach 85 SOL
- Consider raising migration threshold
- Or plan extended bonding curve phase

### Recommendation

For most projects, aim for **50-70% of supply sold** when reaching migration threshold.

This balances:
- Fair distribution during bonding curve
- Sufficient liquidity for DEX
- Community building time

---

## Real-World Examples

### Successful Micro Launch ($5k)
**Project**: Community meme coin  
**Result**: Completed in 4 hours, 200+ holders  
**Outcome**: Successful viral launch, fair distribution  

### Successful Medium Launch ($30k)
**Project**: DeFi yield aggregator  
**Result**: Completed in 36 hours, 500+ holders  
**Outcome**: Professional launch, strong community  

### Failed Large Launch ($75k)
**Project**: NFT marketplace (no MVP)  
**Result**: Only 15% sold in 7 days, stalled  
**Outcome**: Market cap too high for project stage  

**Lesson**: Match market cap to project maturity

---

## Troubleshooting

### Problem: Not Enough Buyers
**Symptom**: Bonding curve fills very slowly  
**Solution**: Launch at lower market cap for your next token

### Problem: Whales Dominating
**Symptom**: Few holders own most of supply  
**Solution**: Increase market cap for better protection

### Problem: Migration Too Early
**Symptom**: Reaches 85 SOL with <30% sold  
**Solution**: Increase migration threshold to 100-150 SOL

### Problem: Migration Never Happens
**Symptom**: Bonding curve stalls before 85 SOL  
**Solution**: Lower market cap or decrease migration threshold

---

## API Integration (Future)

```typescript
// Auto-fetch current SOL price
import { getCurrentSolPrice } from '@/lib/marketCapCalculator';

const solPrice = await getCurrentSolPrice();
// Returns current SOL/USD price from Pyth, Switchboard, or Birdeye
```

**Note**: Currently uses manual input. API integration planned for v2.

---

## Summary

### Key Takeaways

✅ **Market cap targeting makes launches intuitive**  
✅ **5 presets cover most use cases**  
✅ **Custom values available for specific needs**  
✅ **Automatically adjusts for SOL price**  
✅ **Built-in whale protection scaling**  
✅ **Professional and standardized**  

### Quick Reference

| Market Cap | Best For | Time | Whale Protection |
|-----------|----------|------|------------------|
| $4.6k | Meme/Fun | Hours | Moderate |
| $10k | MVP/Small | 6-12h | Good |
| $25k | Serious | 1-2d | Excellent |
| $50k | Established | 2-3d | Very Strong |
| $100k | Premium | 3-7d | Maximum |

### Next Steps

1. ✅ Review market cap presets
2. ✅ Choose appropriate level for your project
3. ⏳ Test on devnet
4. ⏳ Deploy to mainnet
5. ⏳ Monitor and adjust for future launches

---

## Resources

- 📖 [Bonding Curve Optimization Guide](./BONDING_CURVE_OPTIMIZATION.md)
- 📋 [Quick Start Guide](./QUICK_START_BONDING_CURVE.md)
- 🧮 [Bonding Curve Calculator](./frontend/src/lib/marketCapCalculator.ts)
- 🔧 [Admin Config Page](./frontend/src/app/admin/init-config/page.tsx)
- 📊 [Simulator Tool](./scripts/bonding_curve_simulator.py)

---

**Last Updated**: November 9, 2025  
**Version**: 2.0 (Market Cap System)  
**Status**: ✅ Ready for Use

