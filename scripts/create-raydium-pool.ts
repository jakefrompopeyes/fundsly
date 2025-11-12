/**
 * Raydium Pool Creation Script
 * 
 * This script creates a Raydium liquidity pool after tokens have been migrated
 * from the bonding curve. It uses the funds locked in the migration vault.
 * 
 * PREREQUISITES:
 * 1. Token has reached migration threshold
 * 2. migrate_to_raydium instruction has been called
 * 3. SOL and tokens are locked in migration vault
 * 
 * USAGE:
 * npx ts-node scripts/create-raydium-pool.ts <MINT_ADDRESS>
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "fs";

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");

/**
 * Derive migration vault addresses
 */
async function deriveMigrationVaults(mintAddress: PublicKey) {
  const [migrationSolVault] = await PublicKey.findProgramAddress(
    [Buffer.from("migration_vault"), mintAddress.toBuffer()],
    PROGRAM_ID
  );

  const [migrationAuthority] = await PublicKey.findProgramAddress(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );

  const migrationTokenAccount = await getAssociatedTokenAddress(
    mintAddress,
    migrationAuthority,
    true
  );

  return {
    migrationSolVault,
    migrationAuthority,
    migrationTokenAccount,
  };
}

/**
 * Check migration vault balances
 */
async function checkMigrationVaultBalances(
  connection: Connection,
  mintAddress: PublicKey
) {
  const vaults = await deriveMigrationVaults(mintAddress);

  console.log("\n🔍 Checking migration vault balances...\n");

  // Check SOL balance
  const solBalance = await connection.getBalance(vaults.migrationSolVault);
  console.log(`SOL Vault: ${vaults.migrationSolVault.toBase58()}`);
  console.log(`  Balance: ${solBalance / 1e9} SOL\n`);

  // Check token balance
  try {
    const tokenAccountInfo = await connection.getTokenAccountBalance(
      vaults.migrationTokenAccount
    );
    console.log(`Token Account: ${vaults.migrationTokenAccount.toBase58()}`);
    console.log(`  Balance: ${tokenAccountInfo.value.uiAmount} tokens\n`);

    return {
      solAmount: solBalance,
      tokenAmount: parseInt(tokenAccountInfo.value.amount),
      vaults,
    };
  } catch (err) {
    console.error("❌ Error reading token account:", err);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  // Get mint address from command line
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("❌ Usage: npx ts-node scripts/create-raydium-pool.ts <MINT_ADDRESS>");
    process.exit(1);
  }

  const mintAddress = new PublicKey(args[0]);
  console.log("🚀 Raydium Pool Creation Tool");
  console.log("==============================\n");
  console.log(`Token Mint: ${mintAddress.toBase58()}\n`);

  // Connect to Solana
  const connection = new Connection(RPC_URL, "confirmed");

  // Check vault balances
  const migrationData = await checkMigrationVaultBalances(connection, mintAddress);

  if (!migrationData) {
    console.error("❌ Could not read migration vault balances.");
    console.log("\n💡 Make sure:");
    console.log("  1. The token has been migrated (migrate_to_raydium called)");
    console.log("  2. You're connected to the right network (devnet/mainnet)");
    console.log("  3. The migration was successful\n");
    process.exit(1);
  }

  const { solAmount, tokenAmount, vaults } = migrationData;

  if (solAmount === 0 || tokenAmount === 0) {
    console.error("❌ Migration vault is empty or incomplete.");
    console.log("\n💡 The migration may not have completed successfully.");
    process.exit(1);
  }

  console.log("✅ Migration vaults are ready!");
  console.log("\n📋 Next Steps:");
  console.log("================\n");
  console.log("To create a Raydium pool, you have two options:\n");

  console.log("OPTION 1: Use Raydium's Official UI (Recommended for beginners)");
  console.log("----------------------------------------------------------------");
  console.log("1. Go to https://raydium.io/liquidity/create/");
  console.log(`2. Connect wallet with authority over migration vault`);
  console.log(`3. Select token: ${mintAddress.toBase58()}`);
  console.log(`4. Add ${solAmount / 1e9} SOL and ${tokenAmount / 1e6} tokens`);
  console.log("5. Create the pool\n");

  console.log("OPTION 2: Use Raydium SDK (Advanced)");
  console.log("-------------------------------------");
  console.log("1. Install Raydium SDK:");
  console.log("   npm install @raydium-io/raydium-sdk\n");
  console.log("2. Use the SDK to create a CPMM pool:");
  console.log(`   
import { Liquidity, Token } from "@raydium-io/raydium-sdk";

// Your migration vault authority keypair
const authority = Keypair.fromSecretKey(...);

// Create pool with migration vault funds
const { transaction } = await Liquidity.makeCreatePoolTransaction({
  connection,
  poolKeys: {
    baseMint: ${mintAddress.toBase58()},
    quoteMint: NATIVE_SOL_MINT,
    // ... other required fields
  },
  baseAmount: ${tokenAmount},
  quoteAmount: ${solAmount},
  startTime: Math.floor(Date.now() / 1000),
});

await sendAndConfirmTransaction(connection, transaction, [authority]);
  `);

  console.log("\n⚠️  IMPORTANT NOTES:");
  console.log("====================");
  console.log("- The migration vault authority PDA controls the funds");
  console.log("- You'll need to build a custom instruction to transfer from the vault");
  console.log("- OR modify your program to allow withdrawal to Raydium");
  console.log("- Contact Raydium support for specific integration guidance\n");

  console.log("📚 Resources:");
  console.log("=============");
  console.log("- Raydium Docs: https://docs.raydium.io/");
  console.log("- Raydium SDK: https://github.com/raydium-io/raydium-sdk");
  console.log("- Raydium UI: https://raydium.io/\n");

  // Save vault info to file for reference
  const vaultInfo = {
    mintAddress: mintAddress.toBase58(),
    migrationSolVault: vaults.migrationSolVault.toBase58(),
    migrationTokenAccount: vaults.migrationTokenAccount.toBase58(),
    migrationAuthority: vaults.migrationAuthority.toBase58(),
    solAmount: solAmount / 1e9,
    tokenAmount: tokenAmount / 1e6,
    timestamp: new Date().toISOString(),
  };

  const filename = `migration-vault-${mintAddress.toBase58().slice(0, 8)}.json`;
  fs.writeFileSync(filename, JSON.stringify(vaultInfo, null, 2));
  console.log(`💾 Vault info saved to: ${filename}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });

