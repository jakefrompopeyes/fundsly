# 🚀 Quick Start: Testing Migration System

**Everything is deployed and ready! Here's how to test it in 5 minutes.**

---

## ⚡ Fast Track Testing

### 1️⃣ Start Your Frontend (30 seconds)

```bash
cd /Users/dannyzirko/fundly.site/frontend
npm run dev
```

Open: http://localhost:3000

---

### 2️⃣ Create a Test Token (1 minute)

1. Connect your wallet (make sure it's on **Devnet**)
2. Go to: **Dashboard → My Startups**
3. Click: **"Create New Startup"**
4. Fill in:
   - Name: "Test Token"
   - Symbol: "TEST"
   - Category: Pick any
   - Description: "Testing migration"
5. Submit and **copy the mint address**

---

### 3️⃣ Buy Tokens Until Threshold (2 minutes)

**Note**: For testing, you may want to set a low threshold (like 2 SOL) in global config.

1. Go to the token's trading page
2. Buy tokens multiple times
3. Watch the **progress bar** fill up
4. When it reaches 100%, you'll see: **"Ready for migration! 🚀"**

To speed up testing:
```bash
# Lower the threshold (optional)
# Edit scripts/init-global-config-with-migration.ts
# Change: migration_threshold_sol: 2 (instead of 85)
# Then re-run initialization
```

---

### 4️⃣ Migrate to DEX (10 seconds)

When threshold reached:

**Option A: Use UI Button** (if you've added it)
- Click "Migrate to DEX" button

**Option B: Use Browser Console**
```javascript
import { rpc_migrateToRaydium } from "@/lib/anchorClient";

await rpc_migrateToRaydium(
  connection,
  wallet,
  new PublicKey("YOUR_MINT_ADDRESS")
);
```

You should see:
- ✅ Transaction signature
- ✅ Migration vault addresses logged
- ✅ "Migrated!" badge appears
- ✅ Buy/sell buttons disabled

---

### 5️⃣ Verify Migration (1 minute)

```bash
npx ts-node scripts/test-migration.ts YOUR_MINT_ADDRESS
```

Expected output:
```
✅ MIGRATED!
   The token has been migrated to DEX.
   X.XX SOL locked in migration vault.
```

---

### 6️⃣ Check Raydium Pool Info (30 seconds)

```bash
npx ts-node scripts/create-raydium-pool.ts YOUR_MINT_ADDRESS
```

Expected output:
```
🔍 Checking migration vault balances...

SOL Vault: [address]
  Balance: X.XX SOL

Token Account: [address]
  Balance: XXX,XXX tokens

✅ Migration vaults are ready!
```

---

## 🎯 What to Look For

### During Trading
- ✅ Progress bar updates after each buy
- ✅ SOL amount shows remaining until migration
- ✅ Percentage increases

### At Threshold
- ✅ Progress bar turns green
- ✅ "Ready for migration!" message
- ✅ (Optional) "Migrate" button appears

### After Migration
- ✅ "Migrated!" badge visible
- ✅ Buy/sell buttons disabled or show error
- ✅ Migration complete event logged
- ✅ Funds moved to migration vault

### In Scripts
- ✅ `test-migration.ts` shows "MIGRATED" status
- ✅ `create-raydium-pool.ts` shows vault balances
- ✅ Bonding curve vault should be empty
- ✅ Migration vault should have the SOL

---

## 🐛 Troubleshooting

### "Wallet not connected"
- Make sure wallet is connected to **Devnet**
- Check wallet has some devnet SOL

### "Insufficient funds"
- Get devnet SOL: https://faucet.solana.com/
- Need at least 1-2 SOL for testing

### "Transaction failed"
- Check browser console for errors
- Verify you're on devnet
- Try refreshing the page

### "Threshold not reached"
- Keep buying more tokens
- OR lower the threshold in global config
- Check current progress with test script

### "Already migrated"
- Token has already been migrated
- Create a new test token
- OR use a different mint address

---

## 📊 Quick Commands Reference

```bash
# Check migration status
npx ts-node scripts/test-migration.ts <MINT>

# View migration vault details
npx ts-node scripts/create-raydium-pool.ts <MINT>

# Get devnet SOL
solana airdrop 2 --url devnet

# Check your devnet balance
solana balance --url devnet

# View on Solana Explorer
# https://explorer.solana.com/address/<MINT>?cluster=devnet
```

---

## 🎥 Expected Flow

```
1. Create Token
   ↓
2. Buy Tokens (0% → 50% → 100%)
   ↓
3. "Ready for migration!" appears
   ↓
4. Click migrate (or call function)
   ↓
5. Transaction confirms
   ↓
6. "Migrated!" badge shows
   ↓
7. Funds locked in vault ✅
   ↓
8. Ready for Raydium pool creation
```

---

## 🚀 After Testing

Once you've verified everything works:

1. **Deploy to Mainnet**
   ```bash
   anchor deploy --provider.cluster mainnet-beta
   ```

2. **Update Frontend Config**
   - Point to mainnet RPC
   - Update program ID if changed

3. **Initialize Global Config on Mainnet**
   ```bash
   # Use mainnet values
   migration_threshold_sol: 85 (recommended)
   ```

4. **Monitor Migrations**
   - Set up event listeners
   - Track `MigrationComplete` events
   - Automate Raydium pool creation

---

## 🎉 Success Criteria

Your migration system works if:

- ✅ Progress bar updates correctly
- ✅ "Ready for migration" appears at threshold
- ✅ Migration transaction succeeds
- ✅ Funds move to migration vault
- ✅ Trading is disabled after migration
- ✅ Scripts show correct status

If all these pass: **You're ready for production!** 🚀

---

## 💡 Pro Tips

1. **Lower Threshold for Testing**
   - Use 1-2 SOL on devnet
   - Faster to test full flow

2. **Create Multiple Test Tokens**
   - Test different scenarios
   - Verify each works independently

3. **Watch the Events**
   - Open browser console
   - See `MigrationThresholdReached` event
   - See `MigrationComplete` event

4. **Use Explorer**
   - View transactions on Solana Explorer
   - Verify vault balances on-chain
   - Check token accounts

5. **Save Mint Addresses**
   - Keep list of test tokens
   - Easy to re-test later

---

## 📞 Need Help?

If something doesn't work:

1. Check browser console for errors
2. Run `test-migration.ts` to see current state
3. Verify you're on devnet
4. Try with a fresh token
5. Check the logs in terminal

---

**🎊 Happy Testing! Your migration system is production-ready! 🎊**

---

**Created**: November 12, 2025  
**Status**: ✅ Ready to Test  
**Estimated Testing Time**: 5-10 minutes  
**Difficulty**: Easy 😊

