# 🚀 Quick Fix Guide - Insufficient Tokens Error

## ✅ What Was Fixed

**Problem:** Buying with 10 SOL failed with "Insufficient tokens in bonding curve"

**Solution:** Changed token allocation to put **100% of tokens in bonding curve** (instead of 80%)

---

## 🎯 For Your Existing Token (That's Failing)

### Option 1: Try Smaller Amount First
```
Instead of 10 SOL, try:
• 1 SOL first
• Then 2 SOL
• Then 5 SOL
```

This works within the current 800M token limit.

### Option 2: Debug Your Token
```bash
cd /Users/dannyzirko/fundly.site
node scripts/debug-bonding-curve.js <YOUR_MINT_ADDRESS>
```

This will tell you:
- ✅ How many tokens are actually in the curve
- ✅ Whether 10 SOL purchase is possible
- ✅ How many tokens it would need

---

## 🆕 For New Tokens (Going Forward)

**✅ Already Fixed! Just create normally:**

1. Go to `/dashboard/create-startup`
2. Fill out the form
3. **Important:** Leave "Creator Allocation" at **0%** (new default)
4. Create token
5. All 1 billion tokens go to bonding curve
6. Large purchases (10+ SOL) will work! ✅

---

## 📊 Token Allocation Options

| Creator % | Bonding Curve Tokens | Notes |
|-----------|---------------------|-------|
| **0%** (NEW DEFAULT) | 1,000,000,000 (100%) | ✅ Maximum liquidity, recommended |
| 10% | 900,000,000 (90%) | Good liquidity |
| 20% (OLD DEFAULT) | 800,000,000 (80%) | May fail on very large purchases |

**Recommendation:** Keep at 0% for now. Buy your tokens from the curve to show confidence!

---

## 🔧 Quick Commands

### Debug a Token
```bash
node scripts/debug-bonding-curve.js <MINT_ADDRESS>
```

### Check Global Config
```bash
node scripts/check-global-config.js
```

---

## 📝 Summary

**For existing failing token:**
- Try buying 1 SOL instead of 10 SOL
- Or run debug script to see exact state

**For new tokens:**
- Already fixed! Just use 0% creator allocation
- All tokens go to bonding curve = maximum liquidity

**Need more help?**
- See `BONDING_CURVE_DEBUG_GUIDE.md` for detailed debugging
- See `INSUFFICIENT_TOKENS_FIX_SUMMARY.md` for technical details

