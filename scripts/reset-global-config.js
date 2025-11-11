/**
 * Reset Global Config - Close old and reinitialize with correct structure
 * 
 * This script:
 * 1. Closes the old global_config account
 * 2. Reinitializes it with the correct structure including treasury
 * 
 * Usage: node scripts/reset-global-config.js
 */

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIGURATION
// ============================================================================

const NETWORK = "devnet";
const ADMIN_KEYPAIR_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config/solana/id.json"
);

// Bonding curve parameters
const VIRTUAL_SOL_RESERVES = 30;              // 30 SOL virtual reserves
const VIRTUAL_TOKEN_RESERVES = 350_000_000;   // 350 million virtual tokens
const INITIAL_TOKEN_SUPPLY = 1_000_000_000;   // 1 billion tokens
const FEE_BASIS_POINTS = 100;                 // 1% fee (100 basis points)
const MIGRATION_THRESHOLD_SOL = 84;           // Migrate at 84 SOL

// Raydium AMM V4 Program ID
const RAYDIUM_AMM_V4 = new PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
);

// ============================================================================
// Helper Functions
// ============================================================================

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

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log("🔧 Resetting Global Config");
  console.log("===========================\n");
  
  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/fundly.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Run 'anchor build' first.`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address);
  console.log(`✅ Program ID: ${programId.toBase58()}\n`);
  
  // Load admin keypair
  console.log(`📁 Loading admin keypair...`);
  if (!fs.existsSync(ADMIN_KEYPAIR_PATH)) {
    throw new Error(`Keypair not found at ${ADMIN_KEYPAIR_PATH}`);
  }
  const keypairData = JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`✅ Admin: ${adminKeypair.publicKey.toBase58()}\n`);
  
  // Setup connection
  console.log(`🌐 Connecting to ${NETWORK}...`);
  const connection = getConnection(NETWORK);
  
  // Check balance
  const balance = await connection.getBalance(adminKeypair.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL\n`);
  
  if (balance < 0.1 * 1e9) {
    throw new Error("Insufficient balance. You need at least 0.1 SOL.");
  }
  
  // Setup Anchor
  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new anchor.Program(idl, provider);
  
  // Derive global config PDA
  const globalConfigPda = deriveGlobalConfigPda(programId);
  console.log(`📍 Global Config PDA: ${globalConfigPda.toBase58()}\n`);
  
  // Step 1: Close the old account
  console.log("🗑️  Step 1: Closing old global config...");
  const accountInfo = await connection.getAccountInfo(globalConfigPda);
  
  if (accountInfo) {
    console.log(`   Found existing account (${accountInfo.data.length} bytes)`);
    console.log(`   Rent to recover: ${accountInfo.lamports / 1e9} SOL\n`);
    
    try {
      const closeSig = await program.methods
        .closeGlobalConfig()
        .accounts({
          globalConfig: globalConfigPda,
          authority: adminKeypair.publicKey,
        })
        .rpc();
      
      console.log(`   ✅ Closed old global config`);
      console.log(`   📝 Transaction: https://explorer.solana.com/tx/${closeSig}?cluster=${NETWORK}\n`);
      
      // Wait a bit for the transaction to finalize
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      if (error.message?.includes("could not find account")) {
        console.log("   ℹ️  Account already closed\n");
      } else {
        throw error;
      }
    }
  } else {
    console.log("   ℹ️  No existing account found\n");
  }
  
  // Step 2: Initialize with correct structure
  console.log("🚀 Step 2: Initializing global config with correct structure...\n");
  console.log("Configuration:");
  console.log(`  Virtual SOL Reserves:      ${VIRTUAL_SOL_RESERVES} SOL`);
  console.log(`  Virtual Token Reserves:    ${VIRTUAL_TOKEN_RESERVES.toLocaleString()} tokens`);
  console.log(`  Initial Token Supply:      ${INITIAL_TOKEN_SUPPLY.toLocaleString()} tokens`);
  console.log(`  Fee:                       ${FEE_BASIS_POINTS / 100}%`);
  console.log(`  Migration Threshold:       ${MIGRATION_THRESHOLD_SOL} SOL`);
  console.log(`  Treasury:                  ${adminKeypair.publicKey.toBase58()}\n`);
  
  try {
    // Convert to proper units
    const virtualSolLamports = new anchor.BN(VIRTUAL_SOL_RESERVES * 1e9);
    const virtualTokenRaw = new anchor.BN(VIRTUAL_TOKEN_RESERVES * 1_000_000);
    const initialTokenSupplyRaw = new anchor.BN(INITIAL_TOKEN_SUPPLY * 1_000_000);
    const migrationThresholdLamports = new anchor.BN(MIGRATION_THRESHOLD_SOL * 1e9);
    
    const signature = await program.methods
      .initializeGlobalConfig(
        adminKeypair.publicKey, // treasury
        virtualSolLamports,
        virtualTokenRaw,
        initialTokenSupplyRaw,
        FEE_BASIS_POINTS,
        migrationThresholdLamports,
        RAYDIUM_AMM_V4
      )
      .accounts({
        globalConfig: globalConfigPda,
        authority: adminKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("   ✅ Global config initialized successfully!");
    console.log(`   📝 Transaction: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}\n`);
    
    // Verify the new config
    console.log("🔍 Verifying new config...");
    const config = await program.account.globalConfig.fetch(globalConfigPda);
    
    console.log("\n✅ Verification successful!");
    console.log("===========================");
    console.log(`Authority:               ${config.authority.toBase58()}`);
    console.log(`Treasury:                ${config.treasury.toBase58()}`);
    console.log(`Virtual SOL Reserves:    ${config.virtualSolReserves.toNumber() / 1e9} SOL`);
    console.log(`Virtual Token Reserves:  ${(config.virtualTokenReserves.toNumber() / 1_000_000).toLocaleString()} tokens`);
    console.log(`Initial Token Supply:    ${(config.initialTokenSupply.toNumber() / 1_000_000).toLocaleString()} tokens`);
    console.log(`Fee Basis Points:        ${config.feeBasisPoints} (${config.feeBasisPoints / 100}%)`);
    console.log(`Migration Threshold:     ${config.migrationThresholdSol.toNumber() / 1e9} SOL`);
    console.log(`Raydium AMM Program:     ${config.raydiumAmmProgram.toBase58()}`);
    
    console.log("\n🎉 Setup complete! You can now create coins.");
    
  } catch (error) {
    console.error("\n❌ Error during initialization:");
    console.error(error);
    
    if (error.message?.includes("already in use")) {
      console.log("\n💡 The account was not properly closed. Please try again.");
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

