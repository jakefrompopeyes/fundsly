# Market Cap System - Quick Reference Card

**TL;DR**: Choose your target market cap, system handles everything else.

---

## 🎯 Choose Your Market Cap

```
💚 Micro Launch    →  $4,600   →  Meme coins, fun projects
💙 Small Launch    →  $10,000  →  MVP, early stage
💜 Medium Launch   →  $25,000  →  Serious projects ⭐
🧡 Large Launch    →  $50,000  →  Established projects
💛 Premium Launch  →  $100,000 →  Major protocols
```

---

## 📊 Quick Comparison

| Market Cap | 50% Costs | 90% Costs | Time | Whale Resistance |
|-----------|-----------|-----------|------|------------------|
| **$4.6k** | 12 SOL | 23 SOL | 2-6h | Moderate |
| **$10k** | 29 SOL | 58 SOL | 6-12h | Good |
| **$25k** ⭐ | 91 SOL | 257 SOL | 1-2d | Excellent |
| **$50k** | 200 SOL | 1,800 SOL | 2-4d | Very Strong |
| **$100k** | 200 SOL | 1,800 SOL | 4-7d | Maximum |

---

## 🚀 3-Step Setup

### 1. Open Admin Page
```
Visit: /admin/init-config
```

### 2. Select Market Cap
```
Click your preferred preset
OR
Enter custom amount
```

### 3. Initialize
```
Click: "Initialize Global Config"
Done! ✅
```

---

## 🎮 Test It

```bash
# Run analyzer
python3 scripts/market_cap_analyzer.py

# See:
# - All presets compared
# - Whale resistance
# - Time estimates
# - Recommendations
```

---

## 💡 Recommendations

### Meme/Fun → Micro ($4.6k)
- Fast launch
- Maximum reach
- Viral potential

### MVP/Testing → Small ($10k)
- Test market
- Quick feedback
- Low commitment

### Serious Project → Medium ($25k) ⭐
- Professional
- Good distribution
- Balanced approach

### Established → Large ($50k)
- Premium signal
- Quality investors
- Strong protection

### Major Protocol → Premium ($100k)
- Maximum credibility
- Institutional grade
- Ultimate protection

---

## ⚡ What Happens Behind the Scenes

```
You select: $25k market cap

System calculates:
✓ Virtual SOL: 200
✓ Virtual Tokens: 600M
✓ Initial Price: 0.000000125 SOL
✓ Cost for 50%: ~91 SOL
✓ Whale protection: Excellent

All automatic! 🎉
```

---

## 📈 Cost Examples

### Micro ($4.6k)
```
1 SOL   →   82M tokens  (8.2% supply)
5 SOL   →  283M tokens  (28.3% supply)
10 SOL  →  429M tokens  (42.9% supply) ⚠️
```

### Small ($10k)
```
1 SOL   →   33M tokens  (3.3% supply)
5 SOL   →  136M tokens  (13.6% supply)
10 SOL  →  222M tokens  (22.2% supply)
```

### Medium ($25k) ⭐
```
1 SOL   →   14M tokens  (1.4% supply)
5 SOL   →   59M tokens  (5.9% supply)
10 SOL  →  105M tokens  (10.5% supply) ✅
```

### Large ($50k)
```
1 SOL   →    5M tokens  (0.5% supply)
5 SOL   →   24M tokens  (2.4% supply)
10 SOL  →   45M tokens  (4.5% supply) ✅
```

---

## 🛡️ Whale Resistance

**20 SOL whale can buy:**

```
Micro:   79% of supply  ❌
Small:   36% of supply  ⚠️
Medium:  14% of supply  ✅
Large:    9% of supply  ✅✅
Premium:  9% of supply  ✅✅
```

**Recommendation**: Use Medium+ for serious projects

---

## ⏱️ Time to Complete

```
Micro:    2-6 hours    ⚡
Small:    6-12 hours   ⚡
Medium:   1-2 days     ◆
Large:    2-4 days     ◉
Premium:  4-7 days     ◉
```

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `MARKET_CAP_LAUNCH_GUIDE.md` | Complete guide (650 lines) |
| `MARKET_CAP_SYSTEM_SUMMARY.md` | Implementation details |
| `MARKET_CAP_QUICK_REFERENCE.md` | This cheat sheet |
| `scripts/market_cap_analyzer.py` | Analysis tool |
| `frontend/.../marketCapCalculator.ts` | Core engine |
| `frontend/.../init-config/page.tsx` | Admin UI |

---

## 🎯 Decision Tree

```
Q: Is this a meme/fun token?
   ├─ Yes → Micro ($4.6k)
   └─ No ↓

Q: Do you have a working product?
   ├─ No → Small ($10k)
   └─ Yes ↓

Q: Do you have significant users?
   ├─ No → Medium ($25k) ⭐
   └─ Yes ↓

Q: Are you established/proven?
   ├─ No → Large ($50k)
   └─ Yes → Premium ($100k)
```

---

## ✅ Checklist

- [ ] Choose market cap preset
- [ ] Update SOL price
- [ ] Review configuration
- [ ] Test on devnet first
- [ ] Deploy to mainnet
- [ ] Monitor first launches
- [ ] Adjust based on results

---

## 🔧 Commands

```bash
# Analyze market caps
python3 scripts/market_cap_analyzer.py

# Compare bonding curves
python3 scripts/bonding_curve_simulator.py

# Deploy
anchor deploy --provider.cluster devnet

# Admin page
open http://localhost:3000/admin/init-config
```

---

## 🎉 That's It!

**Old way**: "Set virtual SOL to X and virtual tokens to Y"  
**New way**: "Launch with $25k market cap" ✨

**Simple. Professional. Intuitive.**

---

**Status**: ✅ Production Ready  
**Last Updated**: November 9, 2025  
**Version**: 2.0

