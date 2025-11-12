/**
 * Migration Testing Script
 * 
 * This script helps you test the complete migration flow on devnet
 * 
 * USAGE:
 * npx ts-node scripts/test-migration.ts
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");

async function deriveBondingCurvePda(mint: PublicKey) {
  const [pda] = await PublicKey.findProgramAddress(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function deriveSolVaultPda(mint: PublicKey) {
  const [pda] = await PublicKey.findProgramAddress(
    [Buffer.from("sol_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function deriveMigrationVaults(mint: PublicKey) {
  const [migrationSolVault] = await PublicKey.findProgramAddress(
    [Buffer.from("migration_vault"), mint.toBuffer()],
    PROGRAM_ID
  );

  const [migrationAuthority] = await PublicKey.findProgramAddress(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );

  const migrationTokenAccount = await getAssociatedTokenAddress(
    mint,
    migrationAuthority,
    true
  );

  return {
    migrationSolVault,
    migrationAuthority,
    migrationTokenAccount,
  };
}

async function checkBondingCurve(connection: Connection, mint: PublicKey) {
  const bondingCurvePda = await deriveBondingCurvePda(mint);
  
  try {
    const accountInfo = await connection.getAccountInfo(bondingCurvePda);
    
    if (!accountInfo) {
      console.log("❌ Bonding curve not found. Token not launched yet.\n");
      return null;
    }

    // Parse bonding curve data (simplified - you'd need proper deserialization)
    console.log("✅ Bonding curve found!");
    console.log(`   Address: ${bondingCurvePda.toBase58()}\n`);
    
    return bondingCurvePda;
  } catch (err) {
    console.error("❌ Error fetching bonding curve:", err);
    return null;
  }
}

async function checkVaults(connection: Connection, mint: PublicKey) {
  console.log("📦 Checking Vaults\n");
  console.log("==================\n");

  // Bonding curve vaults
  const solVault = await deriveSolVaultPda(mint);
  const bondingCurve = await deriveBondingCurvePda(mint);
  
  const solBalance = await connection.getBalance(solVault);
  console.log("Bonding Curve SOL Vault:");
  console.log(`  Address: ${solVault.toBase58()}`);
  console.log(`  Balance: ${solBalance / 1e9} SOL\n`);

  const tokenAccount = await getAssociatedTokenAddress(mint, bondingCurve, true);
  try {
    const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
    console.log("Bonding Curve Token Account:");
    console.log(`  Address: ${tokenAccount.toBase58()}`);
    console.log(`  Balance: ${tokenBalance.value.uiAmount} tokens\n`);
  } catch (err) {
    console.log("Bonding Curve Token Account:");
    console.log(`  Not found or empty\n`);
  }

  // Migration vaults
  const migrationVaults = await deriveMigrationVaults(mint);
  
  const migrationSolBalance = await connection.getBalance(migrationVaults.migrationSolVault);
  console.log("Migration SOL Vault:");
  console.log(`  Address: ${migrationVaults.migrationSolVault.toBase58()}`);
  console.log(`  Balance: ${migrationSolBalance / 1e9} SOL\n`);

  try {
    const migrationTokenBalance = await connection.getTokenAccountBalance(
      migrationVaults.migrationTokenAccount
    );
    console.log("Migration Token Account:");
    console.log(`  Address: ${migrationVaults.migrationTokenAccount.toBase58()}`);
    console.log(`  Balance: ${migrationTokenBalance.value.uiAmount} tokens\n`);
  } catch (err) {
    console.log("Migration Token Account:");
    console.log(`  Not created yet\n`);
  }

  return {
    bondingCurve: {
      sol: solBalance,
      tokens: 0, // Would need proper parsing
    },
    migration: {
      sol: migrationSolBalance,
      tokens: 0, // Would need proper parsing
    },
  };
}

async function main() {
  console.log("🧪 Migration Testing Tool");
  console.log("=========================\n");

  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log("📋 Usage Instructions");
    console.log("====================\n");
    console.log("To test a specific token:");
    console.log("  npx ts-node scripts/test-migration.ts <MINT_ADDRESS>\n");
    console.log("What this script does:");
    console.log("  ✓ Checks if bonding curve exists");
    console.log("  ✓ Shows SOL balance in bonding curve vault");
    console.log("  ✓ Shows token balance in bonding curve");
    console.log("  ✓ Shows migration vault balances");
    console.log("  ✓ Indicates migration status\n");
    console.log("To test the full flow:");
    console.log("  1. Create a token on your frontend");
    console.log("  2. Note the mint address");
    console.log("  3. Run: npx ts-node scripts/test-migration.ts <MINT>");
    console.log("  4. Buy tokens until threshold reached");
    console.log("  5. Call migrate_to_raydium from frontend");
    console.log("  6. Run this script again to verify migration\n");
    return;
  }

  const mintAddress = new PublicKey(args[0]);
  console.log(`🪙 Token Mint: ${mintAddress.toBase58()}\n`);

  const connection = new Connection(RPC_URL, "confirmed");

  // Check bonding curve
  console.log("🔍 Checking Bonding Curve\n");
  console.log("=========================\n");
  const bondingCurve = await checkBondingCurve(connection, mintAddress);
  
  if (!bondingCurve) {
    console.log("💡 To create this token:");
    console.log("   1. Go to your frontend dashboard");
    console.log("   2. Create a new startup token");
    console.log("   3. Use the mint address from there\n");
    return;
  }

  // Check vaults
  const vaults = await checkVaults(connection, mintAddress);

  // Determine migration status
  console.log("📊 Migration Status\n");
  console.log("===================\n");

  if (vaults.migration.sol > 0) {
    console.log("✅ MIGRATED!");
    console.log("   The token has been migrated to DEX.");
    console.log(`   ${vaults.migration.sol / 1e9} SOL locked in migration vault.\n`);
    console.log("🚀 Next Steps:");
    console.log("   Run: npx ts-node scripts/create-raydium-pool.ts " + mintAddress.toBase58());
  } else if (vaults.bondingCurve.sol > 0) {
    console.log("⏳ ACTIVE BONDING CURVE");
    console.log("   Token is trading on bonding curve.");
    console.log(`   ${vaults.bondingCurve.sol / 1e9} SOL accumulated so far.\n`);
    console.log("💡 To test migration:");
    console.log("   1. Buy tokens on frontend");
    console.log("   2. Watch for 'Ready for migration!' message");
    console.log("   3. Click migrate button (or call rpc_migrateToRaydium)");
    console.log("   4. Run this script again to verify\n");
  } else {
    console.log("🆕 NEW TOKEN");
    console.log("   Token launched but no trades yet.\n");
    console.log("💡 Start trading:");
    console.log("   Go to your frontend and buy some tokens!");
  }

  console.log("\n📚 Useful Commands:\n");
  console.log(`View on Solana Explorer (devnet):`);
  console.log(`  https://explorer.solana.com/address/${mintAddress.toBase58()}?cluster=devnet\n`);
  console.log(`Check migration vault details:`);
  console.log(`  npx ts-node scripts/create-raydium-pool.ts ${mintAddress.toBase58()}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });

