# Fundly Bonding Curve - Deployment Checklist

## Pre-Deployment

### 1. Environment Setup
- [ ] Rust toolchain installed (1.75+)
- [ ] Solana CLI installed (1.17+)
- [ ] Anchor CLI installed (0.32.1)
- [ ] Node.js installed (18+)
- [ ] Wallet funded with SOL for deployment

### 2. Configuration Review
- [ ] Review `Anchor.toml` - ensure correct cluster settings
- [ ] Review bonding curve parameters:
  - [ ] Virtual SOL reserves (recommended: 30 SOL)
  - [ ] Virtual token reserves (recommended: 1B tokens)
  - [ ] Initial token supply (recommended: 1B tokens)
  - [ ] Platform fee (recommended: 100 bps = 1%)

### 3. Security Audit
- [ ] Code review completed
- [ ] Math calculations verified
- [ ] Edge cases tested
- [ ] Slippage protection tested
- [ ] Access control verified
- [ ] Consider professional audit for mainnet

## Smart Contract Deployment

### Build & Test

```bash
# 1. Build the program
cd /Users/dannyzirko/fundly.site
anchor build

# 2. Run tests
anchor test

# 3. Verify program ID matches
anchor keys list
# Should output: fundly: H7XbHBj8QiHn6rE69UDHXeVs8Dtjvo12fZDvCdtpMSZC
```

### Deploy to Devnet (Testing)

```bash
# Set cluster to devnet
solana config set --url devnet

# Airdrop SOL for deployment (if needed)
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show <PROGRAM_ID>
```

### Deploy to Mainnet-Beta (Production)

```bash
# Set cluster to mainnet
solana config set --url mainnet-beta

# Ensure wallet has sufficient SOL (~5-10 SOL recommended)
solana balance

# Deploy
anchor deploy --provider.cluster mainnet-beta

# Verify deployment
solana program show <PROGRAM_ID>

# IMPORTANT: Save program ID and deployment transaction
```

## Initialize Global Configuration

### Create Initialization Script

Create `frontend/scripts/init-config.ts`:

```typescript
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { rpc_initializeGlobalConfig } from "../src/lib/anchorClient";
import fs from "fs";

async function main() {
  // Load admin keypair
  const secretKey = JSON.parse(
    fs.readFileSync("path/to/admin-keypair.json", "utf-8")
  );
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  // Connect to network
  const connection = new Connection(
    process.env.SOLANA_RPC || "https://api.devnet.solana.com",
    "confirmed"
  );

  // Create wallet interface
  const wallet = {
    publicKey: adminKeypair.publicKey,
    signTransaction: async (tx: any) => {
      tx.sign(adminKeypair);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      txs.forEach(tx => tx.sign(adminKeypair));
      return txs;
    },
  };

  console.log("Initializing global config...");
  console.log("Admin:", adminKeypair.publicKey.toBase58());

  try {
    await rpc_initializeGlobalConfig(
      connection,
      wallet,
      30,              // 30 SOL virtual reserves
      1_000_000_000,   // 1 billion virtual tokens
      1_000_000_000,   // 1 billion default initial supply
      100              // 1% fee (100 basis points)
    );

    console.log("✅ Global config initialized successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
```

### Run Initialization

```bash
# For devnet
npx ts-node scripts/init-config.ts

# For mainnet, update RPC endpoint first
export SOLANA_RPC=https://api.mainnet-beta.solana.com
npx ts-node scripts/init-config.ts
```

### Checklist
- [ ] Script created
- [ ] Admin keypair secured
- [ ] RPC endpoint configured
- [ ] Initialization completed
- [ ] Global config PDA verified on explorer

## Frontend Deployment

### 1. Update Configuration

```bash
cd frontend

# Create/update .env.local
cat > .env.local << EOF
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://your-rpc-endpoint.com
EOF
```

### 2. Update IDL

```bash
# Copy latest IDL from build
cp ../target/idl/fundly.json src/idl/fundly.json

# Verify IDL contains new instructions
cat src/idl/fundly.json | grep -A 2 "buy_tokens"
```

### 3. Build & Test Frontend

```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
npm run dev
# Visit http://localhost:3000
```

### 4. Deploy to Hosting

#### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

### Checklist
- [ ] Environment variables set
- [ ] IDL updated
- [ ] Build successful
- [ ] Local testing passed
- [ ] Deployed to hosting
- [ ] Production URL verified

## Post-Deployment Verification

### 1. Smart Contract Verification

```bash
# Check program is deployed
solana program show <PROGRAM_ID>

# Verify global config exists
solana account <GLOBAL_CONFIG_PDA>

# Test basic operations (on devnet first)
```

### 2. Frontend Verification

- [ ] Website loads correctly
- [ ] Wallet connection works
- [ ] Can fetch bonding curve data
- [ ] Buy operation works
- [ ] Sell operation works
- [ ] Error handling works
- [ ] Mobile responsive

### 3. Create Test Bonding Curve

```bash
# Create a test token and bonding curve
# Use the create-startup flow or CLI script
```

### 4. Execute Test Trades

- [ ] Buy small amount of tokens
- [ ] Verify token balance updated
- [ ] Verify SOL balance updated
- [ ] Sell tokens back
- [ ] Verify reserves updated correctly
- [ ] Check transaction on explorer

## Monitoring & Maintenance

### Setup Monitoring

- [ ] Monitor program logs
- [ ] Track transaction volume
- [ ] Monitor error rates
- [ ] Set up alerts for failures
- [ ] Track fee accumulation

### Backup & Security

- [ ] Backup all keypairs (encrypted!)
- [ ] Document all PDAs
- [ ] Save deployment transactions
- [ ] Document upgrade authority
- [ ] Setup multi-sig for admin (recommended)

## Emergency Procedures

### If Something Goes Wrong

1. **Pause Trading** (if emergency pause implemented)
2. **Contact users** via Discord/Twitter
3. **Debug issue** using transaction logs
4. **Prepare fix** and test on devnet
5. **Deploy upgrade** (if program is upgradeable)
6. **Verify fix** works
7. **Resume operations**

### Important Contacts

- Solana Discord: https://discord.gg/solana
- Anchor Support: https://discord.gg/anchorlang
- [Your team contact info]

## Success Criteria

- [ ] Smart contract deployed successfully
- [ ] Global config initialized
- [ ] Frontend deployed and accessible
- [ ] Test trades executed successfully
- [ ] No errors in monitoring
- [ ] Documentation complete
- [ ] Team trained on operations

## Recommended Parameters

### Conservative (Lower Risk)
- Virtual SOL: 50 SOL
- Virtual Tokens: 1,000,000,000
- Initial Supply: 1,000,000,000
- Fee: 1% (100 bps)

### Standard (Balanced)
- Virtual SOL: 30 SOL
- Virtual Tokens: 1,000,000,000
- Initial Supply: 1,000,000,000
- Fee: 1% (100 bps)

### Aggressive (Higher Volatility)
- Virtual SOL: 10 SOL
- Virtual Tokens: 1,000,000,000
- Initial Supply: 1,000,000,000
- Fee: 0.5% (50 bps)

## Resources

- **Main Guide**: `/BONDING_CURVE_GUIDE.md`
- **Codebase Docs**: `/CODEBASE_DOCUMENTATION.md`
- **Anchor Docs**: https://www.anchor-lang.com/
- **Solana Docs**: https://docs.solana.com/

---

**Note**: This checklist should be followed sequentially. Test everything on devnet before deploying to mainnet!

**Estimated Deployment Time**: 2-4 hours (excluding audits)

**Estimated Cost**:
- Program deployment: ~5-10 SOL
- Global config initialization: ~0.01 SOL
- Testing: ~1-2 SOL
- **Total**: ~6-13 SOL

Good luck with your deployment! 🚀

