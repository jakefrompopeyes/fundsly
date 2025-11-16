# 🤖 Automatic Raydium Pool Creation Service

This backend service **automatically** monitors for token migrations and creates Raydium pools without any manual intervention.

## ✨ What It Does

```
Token Migration Detected (85 SOL threshold)
        ↓
Backend Service Triggered (automatic)
        ↓
Withdraws Funds from Migration Vaults (smart contract call)
        ↓
Creates Raydium CPMM Pool (Raydium SDK)
        ↓
Token Listed on DEX Ecosystem!
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Set your admin keypair path and RPC endpoint.

### 3. Start the Service

**Development:**
```bash
npm start
```

**Production (with PM2):**
```bash
npm run pm2:start
npm run pm2:logs
```

## 📋 Prerequisites

- ✅ **Node.js 18+** installed
- ✅ **Admin wallet** with ~0.5 SOL per pool
- ✅ **Smart contract deployed** with withdraw_migration_funds instruction
- ✅ **Admin wallet** set as platform authority in global config

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOLANA_NETWORK` | Network (devnet/mainnet-beta) | `devnet` |
| `SOLANA_RPC_URL` | RPC endpoint | `https://api.devnet.solana.com` |
| `ADMIN_KEYPAIR_PATH` | Path to admin keypair | `~/.config/solana/id.json` |

### Admin Wallet Requirements

The admin wallet must:
1. Be set as `authority` in the global config
2. Have sufficient SOL (~0.5 SOL per pool)
3. Have the private key accessible to the service

## 📊 How It Works

### 1. Migration Detection

The service monitors the blockchain 24/7 for migration events:
- **Event Listening**: Real-time detection via WebSocket
- **Periodic Scanning**: Every 5 minutes as backup
- **Duplicate Prevention**: Tracks processed migrations

### 2. Automatic Withdrawal

When a migration is detected:
```typescript
// Calls your smart contract
await program.methods
  .withdrawMigrationFunds(solAmount, tokenAmount)
  .accounts({ ... })
  .rpc();
```

Funds are transferred from migration vaults to backend wallet.

### 3. Pool Creation

Using the withdrawn funds:
```typescript
// Creates Raydium CPMM pool
const { txId } = await raydium.cpmm.createPool({
  mint1: WSOL,
  mint2: tokenMint,
  mint1Amount: solAmount,
  mint2Amount: tokenAmount,
  ...
});
```

Token is now trading on:
- ✅ Raydium DEX
- ✅ Jupiter (auto-indexed within 5 minutes)
- ✅ DexScreener (auto-discovered)
- ✅ Your platform UI

### 4. Error Handling

The service includes:
- **Retry Logic**: 3 attempts with exponential backoff
- **Graceful Degradation**: If pool fails, funds stay in wallet for manual creation
- **Logging**: Detailed logs for debugging
- **State Tracking**: Prevents duplicate processing

## 🎮 Usage

### Start Service

```bash
# Development
npm start

# Production with PM2
npm run pm2:start
```

### Monitor Service

```bash
# View logs
npm run pm2:logs

# Check status
pm2 status pool-service

# Restart if needed
npm run pm2:restart
```

### Stop Service

```bash
npm run pm2:stop
```

## 💰 Costs

Per pool creation:
- **Withdrawal**: ~0.01 SOL (transaction fee)
- **Pool Creation**: ~0.4 SOL (Raydium fee)
- **Total**: ~0.41 SOL per migration

**Monthly estimate** (100 migrations):
- 100 × 0.41 = **41 SOL** (~$4,100 at $100/SOL)

Make sure your admin wallet has sufficient SOL!

## 📝 Logs

The service logs:
- ✅ Migration detections
- ✅ Withdrawal transactions
- ✅ Pool creation transactions
- ✅ Errors and retries
- ✅ Processing statistics

Example output:
```
🤖 Raydium Pool Auto-Creation Service
======================================================================

📡 Configuration:
   Network: devnet
   RPC: https://api.devnet.solana.com
   Program: 5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK

👤 Admin Wallet: ABC...XYZ

💰 Balance: 5.2341 SOL

======================================================================
🚀 Service Started!
======================================================================

🔎 Running initial scan for existing migrations...

   Found 3 bonding curve accounts

✅ Migration vault has funds!
   SOL: 2.4800 SOL
   Tokens: 804,734,411 tokens

🔧 Starting automatic pool creation...

Step 1: Withdrawing funds from migration vaults...

   SOL to withdraw: 2.4800 SOL
   Tokens to withdraw: 804,734,411 tokens

📝 Calling withdraw_migration_funds instruction...
✅ Withdrawal successful!
   Transaction: ABC123...
   Backend wallet balance: 7.7141 SOL

✅ Step 1 complete: Funds withdrawn to backend wallet

Step 2: Creating Raydium pool...

🔵 Creating Raydium Pool
========================

💰 Pool Liquidity:
   SOL: 2.4800 SOL
   Tokens: 804,734,411 tokens
   Price: 0.0000000031 SOL/token

🔧 Initializing Raydium SDK...
✅ Raydium SDK initialized

🏊 Creating CPMM pool...
📝 Signing and sending transaction...

✅ Pool Created Successfully!
   Transaction: DEF456...
   Pool ID: GHI789...
   Explorer: https://explorer.solana.com/tx/DEF456...?cluster=devnet

🎉 Token is now listed on:
   • Raydium
   • Jupiter (auto-indexed)
   • DexScreener (auto-discovered)
   • Your platform UI (automatic!)

✅ Step 2 complete: Pool created successfully!

============================================================
🎉 AUTOMATIC POOL CREATION COMPLETE!
============================================================

✅ Token: ABC...XYZ
✅ Pool: GHI789...
✅ Transaction: DEF456...

🌐 Your token is now trading on:
   • Raydium DEX
   • Jupiter Aggregator (auto-indexed)
   • DexScreener (auto-discovered)
   • Your platform UI (automatic!)
```

## 🔒 Security

### Authorization

- ✅ Only platform authority can withdraw funds
- ✅ Smart contract validates all operations
- ✅ No external access to migration vaults

### Fund Safety

- ✅ Funds locked on-chain until withdrawal
- ✅ Withdrawal requires authority signature
- ✅ All operations are atomic

### Best Practices

1. **Secure Keypair**: Store admin keypair securely
2. **Limited Balance**: Don't store more SOL than needed
3. **Monitor Logs**: Watch for unexpected behavior
4. **Test on Devnet**: Fully test before mainnet

## 🐛 Troubleshooting

### "Low balance" warning

**Issue**: Admin wallet doesn't have enough SOL

**Fix**:
```bash
# Devnet
solana airdrop 2 <ADMIN_WALLET> --url devnet

# Mainnet
# Send SOL manually to admin wallet
```

### Service not detecting migrations

**Issue**: RPC connection issues

**Fix**:
1. Check RPC endpoint is accessible
2. Try a different RPC (Helius, Alchemy, QuickNode)
3. Check logs: `npm run pm2:logs`

### Pool creation fails

**Issue**: Raydium SDK error or insufficient funds

**Fix**:
1. Check admin wallet balance
2. Verify Raydium program IDs are correct
3. Check network (devnet vs mainnet)
4. Review error logs for specific issue

### "Cannot find module @raydium-io/raydium-sdk-v2"

**Issue**: Dependencies not installed

**Fix**:
```bash
cd backend
npm install
```

## 🔄 Updates

### Update Dependencies

```bash
npm update
```

### Update Service

```bash
# Pull latest code
git pull

# Restart service
npm run pm2:restart
```

## 🎯 Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start service
npm run pm2:start

# Configure auto-restart on server reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### Using systemd

Create `/etc/systemd/system/pool-service.service`:
```ini
[Unit]
Description=Raydium Pool Auto-Creation Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/fundly.site/backend
ExecStart=/usr/bin/node raydium-pool-service.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable pool-service
sudo systemctl start pool-service
sudo systemctl status pool-service
```

### Using Docker (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "raydium-pool-service.js"]
```

Build and run:
```bash
docker build -t fundly-pool-service .
docker run -d --name pool-service \
  -v ~/.config/solana:/root/.config/solana \
  --env-file .env \
  fundly-pool-service
```

## 📈 Monitoring

### Check Processed Migrations

```bash
cat .processed-migrations.json
```

### View Service Metrics

```bash
pm2 monit pool-service
```

### Set Up Alerts (Optional)

Use PM2 Plus for advanced monitoring:
```bash
pm2 link <SECRET> <PUBLIC>
```

## 🤝 Support

- **Raydium Docs**: https://docs.raydium.io/
- **Raydium Discord**: https://discord.gg/raydium
- **Solana Docs**: https://docs.solana.com/

## 📄 License

MIT

---

**Status**: ✅ Fully Automated & Production Ready
**Last Updated**: November 16, 2025
