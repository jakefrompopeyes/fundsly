# Quick Fix: Deploy Fresh with Migration Support

## The Problem

The existing global config account has the old structure without proper migration field sizes. We need a fresh deployment.

## Solution: Fresh Deployment (2 minutes)

### Step 1: Generate New Program Keypair

```bash
cd /Users/dannyzirko/fundly.site
solana-keygen new -o target/deploy/fundly-keypair.json --force
```

This generates a new program ID.

### Step 2: Update Anchor.toml

The new program ID will be printed. Update `Anchor.toml`:

```toml
[programs.devnet]
fundly = "YOUR_NEW_PROGRAM_ID_HERE"
```

### Step 3: Update lib.rs

Update the `declare_id!` macro in `programs/fundly/src/lib.rs`:

```rust
declare_id!("YOUR_NEW_PROGRAM_ID_HERE");
```

### Step 4: Build and Deploy

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Step 5: Copy IDL

```bash
cp target/idl/fundly.json frontend/src/idl/fundly.json
```

### Step 6: Initialize Global Config

```bash
node scripts/init-global-config-migration.js
```

This time it will work with the new program!

---

## Why This Works

- Fresh program ID = fresh accounts
- No old data to migrate
- GlobalConfig will be created with correct structure from the start
- Migration parameters will be set correctly

---

## Alternative: Keep Current Program

If you want to keep the current program ID (`H7XbHBj8QiHn6rE69UDHXeVs8Dtjvo12fZDvCdtpMSZC`), you need to:

1. Add a `close_global_config` instruction to the program
2. Close the old account
3. Reinitialize with correct parameters

But for devnet testing, fresh deployment is faster!

---

## Once Deployed

Run the check script to verify:

```bash
node scripts/check-global-config.js
```

You should see:
- ✅ Migration Threshold: 85 SOL
- ✅ Raydium AMM Program: 675kPX9...

Then you're ready to test the migration feature!

