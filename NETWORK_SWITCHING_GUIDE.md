# Network Switching Guide

## Current Configuration: Devnet (Testing)

Everything is currently configured to use **devnet** for testing. The program is deployed and ready to use.

---

## How to Switch to Mainnet (When Ready)

### Step 1: Deploy Program to Mainnet

```bash
cd /Users/dannyzirko/fundly.site
export PATH="$HOME/.cargo/bin:/Users/dannyzirko/.local/share/solana/install/active_release/bin:/Users/dannyzirko/.avm/bin:$PATH"

# Switch Solana CLI to mainnet
solana config set --url mainnet-beta

# Deploy (requires 2-3 SOL in deployment wallet)
anchor deploy --provider.cluster mainnet
```

**Note**: The program ID might change after mainnet deployment. If it does:
1. Update `programs/fundly/src/lib.rs` with new `declare_id!()`
2. Update `Anchor.toml` `[programs.mainnet]` section
3. Rebuild: `anchor build`
4. Copy new IDL: `cp target/idl/fundly.json frontend/src/idl/fundly.json`

### Step 2: Update Frontend to Mainnet

**Option A: Via Environment Variable (Recommended)**

Create/update `frontend/.env.local`:
```
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://your-mainnet-rpc-endpoint/?api-key=...
```

**Option B: Change Default in Code**

In `frontend/src/components/wallet/WalletProviders.tsx`:
```typescript
const FALLBACK_CLUSTER = 'mainnet-beta' as const; // Change from 'devnet'
```

### Step 3: Restart Frontend

```bash
cd frontend
npm run dev
```

---

## Current Devnet Setup

✅ **Program Deployed**: `H7XbHBj8QiHn6rE69UDHXeVs8Dtjvo12fZDvCdtpMSZC`  
✅ **Network**: Devnet  
✅ **Frontend Default**: Devnet  
✅ **Deployment Wallet**: `4fNVi5QAnjLP6JTXURbQJ4xHkQZRHiAGDeF3sSAxpBUj`

---

## Getting Devnet SOL

If you need more devnet SOL for testing:

```bash
solana airdrop 2 YOUR_WALLET_ADDRESS
```

You can request airdrops multiple times on devnet.

---

## Files That Control Network

1. **`Anchor.toml`**: Program deployment configuration
   - `[provider].cluster` = default cluster for Anchor commands
   - `[programs.devnet]` and `[programs.mainnet]` = program IDs per network

2. **`frontend/src/components/wallet/WalletProviders.tsx`**: Frontend network selection
   - `FALLBACK_CLUSTER` = default network if env var not set
   - Reads `NEXT_PUBLIC_SOLANA_NETWORK` from `.env.local`

3. **`frontend/.env.local`**: Environment variables (not in git)
   - `NEXT_PUBLIC_SOLANA_NETWORK` = network selection
   - `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` = custom RPC URL (optional)

---

## Testing Checklist

Before switching to mainnet, ensure:
- [ ] All features work on devnet
- [ ] Program is tested and audited
- [ ] Deployment wallet has 2-3 SOL for mainnet deployment
- [ ] Mainnet RPC endpoint is configured (Helius, etc.)
- [ ] Program ID is updated if it changed during deployment

