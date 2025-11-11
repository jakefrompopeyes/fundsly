/**
 * Update Global Config with Migration Parameters
 * 
 * Updates the existing global config with correct migration parameters
 * 
 * Usage: node scripts/update-global-config.js
 */

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const NETWORK = "devnet";
const ADMIN_KEYPAIR_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config/solana/id.json"
);

// Migration parameters to update
const MIGRATION_THRESHOLD_SOL = 85;        // Migrate when 85 SOL accumulated

// Raydium AMM V4 Program ID
const RAYDIUM_AMM_V4 = new PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
);

function getConnection(network) {
  switch (network) {
    case "devnet":
      return new Connection("https://api.devnet.solana.com", "confirmed");
    case "testnet":
      return new Connection("https://api.testnet.solana.com", "confirmed");
    case "mainnet-beta":
      return new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    default:
      throw new Error(`Unknown network: ${network}`);
  }
}

function deriveGlobalConfigPda(programId) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    programId
  );
  return pda;
}

async function main() {
  console.log("🔄 Update Global Config");
  console.log("======================\n");
  
  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/fundly.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address);
  
  // Load admin keypair  
  const keypairData = JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  // Setup connection
  const connection = getConnection(NETWORK);
  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new anchor.Program(idl, provider);
  
  // Derive global config PDA
  const globalConfigPda = deriveGlobalConfigPda(programId);
  
  console.log(`📍 Global Config PDA: ${globalConfigPda.toBase58()}`);
  console.log(`👤 Admin: ${adminKeypair.publicKey.toBase58()}`);
  console.log(`🌐 Network: ${NETWORK}\n`);
  
  // Show current config
  try {
    const config = await program.account.globalConfig.fetch(globalConfigPda);
    console.log("📋 Current Configuration:");
    console.log("========================");
    console.log(`Migration Threshold:     ${config.migrationThresholdSol.toNumber() / 1e9} SOL`);
    console.log(`Raydium AMM Program:     ${config.raydiumAmmProgram.toBase58()}\n`);
  } catch (error) {
    console.log("⚠️  Could not fetch current config\n");
  }
  
  console.log("📝 New Configuration:");
  console.log("====================");
  console.log(`Migration Threshold:     ${MIGRATION_THRESHOLD_SOL} SOL 🚀`);
  console.log(`Raydium AMM Program:     ${RAYDIUM_AMM_V4.toBase58()}\n`);
  
  console.log("⏳ Updating global config...\n");
  
  try {
    const migrationThresholdLamports = new anchor.BN(MIGRATION_THRESHOLD_SOL * 1e9);
    
    const signature = await program.methods
      .updateGlobalConfig(
        null,  // virtual_sol_reserves (keep existing)
        null,  // virtual_token_reserves (keep existing)
        null,  // initial_token_supply (keep existing)
        null,  // fee_basis_points (keep existing)
        migrationThresholdLamports,  // UPDATE migration threshold
        RAYDIUM_AMM_V4  // UPDATE Raydium program
      )
      .accounts({
        globalConfig: globalConfigPda,
        authority: adminKeypair.publicKey,
      })
      .rpc();
    
    console.log("✅ Global config updated successfully!");
    console.log(`📝 Transaction signature: ${signature}`);
    console.log(`🔍 View on explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`);
    
    // Show updated config
    const updatedConfig = await program.account.globalConfig.fetch(globalConfigPda);
    console.log("\n📊 Updated Configuration:");
    console.log("========================");
    console.log(`Virtual SOL Reserves:    ${updatedConfig.virtualSolReserves.toNumber() / 1e9} SOL`);
    console.log(`Virtual Token Reserves:  ${(updatedConfig.virtualTokenReserves.toNumber() / 1_000_000).toLocaleString()} tokens`);
    console.log(`Initial Token Supply:    ${(updatedConfig.initialTokenSupply.toNumber() / 1_000_000).toLocaleString()} tokens`);
    console.log(`Fee Basis Points:        ${updatedConfig.feeBasisPoints} (${updatedConfig.feeBasisPoints / 100}%)`);
    console.log(`Migration Threshold:     ${updatedConfig.migrationThresholdSol.toNumber() / 1e9} SOL 🚀`);
    console.log(`Raydium AMM Program:     ${updatedConfig.raydiumAmmProgram.toBase58()}`);
    
    console.log("\n🎉 Setup complete!");
    console.log("\nNext steps:");
    console.log("1. Create test bonding curves");
    console.log("2. Buy tokens to test progress");
    console.log(`3. Watch migration progress in the UI (0-${MIGRATION_THRESHOLD_SOL} SOL)`);
    console.log(`4. When ${MIGRATION_THRESHOLD_SOL} SOL reached, test migration!`);
    
  } catch (error) {
    console.error("❌ Error updating global config:");
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

