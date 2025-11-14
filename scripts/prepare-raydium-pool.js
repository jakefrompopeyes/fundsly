/**
 * Prepare Raydium Pool Information
 * 
 * This script shows you exactly what you need to create a Raydium pool
 * for a migrated token. You can then:
 * - Use Raydium's UI to create the pool (2 minutes)
 * - OR use this info to create it programmatically
 * 
 * Usage: node scripts/prepare-raydium-pool.js <MINT_ADDRESS>
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");
const NETWORK = "devnet";

async function main() {
  const mintAddress = process.argv[2];
  
  if (!mintAddress) {
    console.error("❌ Usage: node scripts/prepare-raydium-pool.js <MINT_ADDRESS>");
    process.exit(1);
  }

  console.log("\n🔵 Raydium Pool Preparation");
  console.log("============================\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const mint = new PublicKey(mintAddress);

  console.log(`🪙 Token Mint: ${mintAddress}`);
  console.log(`🌐 Network: ${NETWORK}\n`);

  // Derive migration vault addresses
  const [migrationSolVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_vault"), mint.toBuffer()],
    PROGRAM_ID
  );

  const [migrationAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );

  const migrationTokenAccount = await getAssociatedTokenAddress(
    mint,
    migrationAuthority,
    true
  );

  console.log("📍 Migration Vault Addresses:");
  console.log(`   SOL Vault: ${migrationSolVault.toBase58()}`);
  console.log(`   Token Account: ${migrationTokenAccount.toBase58()}`);
  console.log(`   Authority: ${migrationAuthority.toBase58()}\n`);

  // Get balances
  const solBalance = await connection.getBalance(migrationSolVault);
  const tokenAccountInfo = await connection.getAccountInfo(migrationTokenAccount);
  
  let tokenAmount = 0;
  if (tokenAccountInfo) {
    tokenAmount = Number(tokenAccountInfo.data.readBigUInt64LE(64));
  }

  const solInVault = solBalance / 1e9;
  const tokensInVault = tokenAmount / 1e6;

  console.log("💰 Vault Balances:");
  console.log(`   SOL: ${solInVault.toFixed(4)} SOL`);
  console.log(`   Tokens: ${tokensInVault.toLocaleString()} tokens\n`);

  if (solInVault === 0 || tokensInVault === 0) {
    console.log("❌ Migration vault is empty!");
    console.log("   This token may not have been migrated yet.\n");
    process.exit(1);
  }

  // Calculate initial price
  const initialPrice = solInVault / tokensInVault;
  const pricePerToken = initialPrice;
  const mcap = tokensInVault * initialPrice;

  console.log("📊 Pool Parameters:");
  console.log(`   Initial Price: ${pricePerToken.toFixed(10)} SOL per token`);
  console.log(`   Market Cap: ${mcap.toFixed(2)} SOL (~$${(mcap * 100).toFixed(0)} at $100/SOL)`);
  console.log(`   Liquidity: ${solInVault.toFixed(4)} SOL + ${tokensInVault.toLocaleString()} tokens\n`);

  console.log("="  .repeat(60));
  console.log("🎯 NEXT STEPS:");
  console.log("="  .repeat(60));
  console.log();

  console.log("Option 1: Create Pool via Raydium UI (Easiest) 🖱️");
  console.log("-".repeat(60));
  console.log("1. Go to: https://raydium.io/liquidity/create-cpmm-pool/");
  console.log("2. Select Network: Devnet");
  console.log("3. Connect wallet with migration authority");
  console.log(`4. Token Address: ${mintAddress}`);
  console.log("5. Pair with: SOL");
  console.log(`6. Add Liquidity: ${solInVault.toFixed(4)} SOL + ${tokensInVault.toLocaleString()} tokens`);
  console.log("7. Set Fee: 0.25% (standard)");
  console.log("8. Create Pool!");
  console.log();

  console.log("Option 2: Transfer to Regular Wallet (Alternative) 💸");
  console.log("-".repeat(60));
  console.log("If you have the migration authority keypair:");
  console.log("1. Transfer SOL from migration vault to your wallet");
  console.log("2. Transfer tokens to your wallet");
  console.log("3. Use Raydium UI with your regular wallet");
  console.log();

  console.log("Option 3: Automated Script (Coming Soon) 🤖");
  console.log("-".repeat(60));
  console.log("We're working on a fully automated solution!");
  console.log("For now, Option 1 is fastest (takes ~2 minutes).");
  console.log();

  console.log("="  .repeat(60));
  console.log("📋 QUICK REFERENCE:");
  console.log("="  .repeat(60));
  console.log(`Token Mint:      ${mintAddress}`);
  console.log(`SOL Amount:      ${solInVault.toFixed(4)}`);
  console.log(`Token Amount:    ${tokensInVault.toLocaleString()}`);
  console.log(`Initial Price:   ${pricePerToken.toFixed(10)} SOL/token`);
  console.log();

  console.log("🔗 Useful Links:");
  console.log(`   Token Explorer: https://explorer.solana.com/address/${mintAddress}?cluster=devnet`);
  console.log(`   Raydium Pool Creator: https://raydium.io/liquidity/create-cpmm-pool/`);
  console.log(`   Migration Vault: https://explorer.solana.com/address/${migrationSolVault.toBase58()}?cluster=devnet`);
  console.log();

  console.log("💡 TIP: After creating the pool, your token will automatically appear on:");
  console.log("   ✅ Raydium");
  console.log("   ✅ Jupiter (within minutes)");
  console.log("   ✅ DexScreener (auto-discovery)");
  console.log("   ✅ Your platform's UI (automatic Raydium integration!)");
  console.log();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

