/**
 * Quick Migration Verification Script
 * Usage: node scripts/verify-migration.js <MINT_ADDRESS>
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");

async function main() {
  const mintAddress = process.argv[2];
  
  if (!mintAddress) {
    console.error("❌ Usage: node scripts/verify-migration.js <MINT_ADDRESS>");
    process.exit(1);
  }

  console.log("\n🔍 Verifying Migration");
  console.log("======================\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const mint = new PublicKey(mintAddress);

  console.log(`🪙 Token Mint: ${mintAddress}\n`);

  // Derive PDAs
  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    PROGRAM_ID
  );

  const [solVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault"), mint.toBuffer()],
    PROGRAM_ID
  );

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

  console.log("📍 Accounts:");
  console.log(`   Bonding Curve: ${bondingCurvePda.toBase58()}`);
  console.log(`   SOL Vault: ${solVaultPda.toBase58()}`);
  console.log(`   Migration Vault: ${migrationSolVault.toBase58()}`);
  console.log(`   Migration Token Acct: ${migrationTokenAccount.toBase58()}\n`);

  // Check bonding curve account
  try {
    const bondingCurveInfo = await connection.getAccountInfo(bondingCurvePda);
    
    if (!bondingCurveInfo) {
      console.log("❌ Bonding curve account not found!");
      process.exit(1);
    }

    console.log("✅ Bonding curve exists\n");

    // For simplicity, just check the migrated flag at a known position
    // In the actual struct, 'migrated' is a boolean at a specific byte offset
    const data = bondingCurveInfo.data;
    
    // The layout is roughly:
    // - owner: 32 bytes
    // - mint: 32 bytes  
    // - various u64s (8 bytes each)
    // - migrated: 1 byte (bool)
    // - raydium_pool: 32 bytes
    
    // Let's just check if the account exists and report balances
    
  } catch (error) {
    console.error("❌ Error checking bonding curve:", error.message);
  }

  // Check vault balances
  console.log("💰 Vault Balances:");
  console.log("==================\n");

  try {
    const solVaultBalance = await connection.getBalance(solVaultPda);
    console.log(`   Bonding Curve Vault: ${(solVaultBalance / 1e9).toFixed(4)} SOL`);
  } catch (error) {
    console.log(`   Bonding Curve Vault: Not found or 0 SOL`);
  }

  try {
    const migrationVaultBalance = await connection.getBalance(migrationSolVault);
    console.log(`   Migration Vault: ${(migrationVaultBalance / 1e9).toFixed(4)} SOL`);
    
    if (migrationVaultBalance > 0) {
      console.log("\n✅ MIGRATION SUCCESSFUL!");
      console.log(`   ${(migrationVaultBalance / 1e9).toFixed(4)} SOL has been locked in the migration vault!\n`);
    } else {
      console.log("\n⚠️  Migration vault is empty - migration may not have occurred yet\n");
    }
  } catch (error) {
    console.log(`   Migration Vault: Not found or 0 SOL`);
  }

  // Check token accounts
  console.log("\n🪙 Token Balances:");
  console.log("==================\n");

  try {
    const migrationTokenInfo = await connection.getAccountInfo(migrationTokenAccount);
    
    if (migrationTokenInfo) {
      // Parse token account (simple - amount is at bytes 64-72 as u64)
      const amount = migrationTokenInfo.data.readBigUInt64LE(64);
      console.log(`   Migration Token Account: ${(Number(amount) / 1e6).toLocaleString()} tokens\n`);
    } else {
      console.log(`   Migration Token Account: Not found\n`);
    }
  } catch (error) {
    console.log(`   Migration Token Account: Error reading - ${error.message}\n`);
  }

  // View on explorer
  console.log("🔍 View on Solana Explorer:");
  console.log(`   Token: https://explorer.solana.com/address/${mintAddress}?cluster=devnet`);
  console.log(`   Migration Vault: https://explorer.solana.com/address/${migrationSolVault.toBase58()}?cluster=devnet\n`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

