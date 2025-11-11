/**
 * Initialize Global Config with Migration Parameters
 * 
 * Simple JavaScript version that works without module configuration
 * 
 * Usage:
 *   1. Update ADMIN_KEYPAIR_PATH if needed (defaults to ~/.config/solana/id.json)
 *   2. Update NETWORK (devnet, testnet, or mainnet-beta)
 *   3. Run: node scripts/init-global-config-migration.js
 */

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

const NETWORK = "devnet"; // "devnet" | "testnet" | "mainnet-beta"
const ADMIN_KEYPAIR_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config/solana/id.json"
);

// Bonding curve parameters
const VIRTUAL_SOL_RESERVES = 30;              // 30 SOL virtual reserves
const VIRTUAL_TOKEN_RESERVES = 350_000_000;   // 350 million virtual tokens
const INITIAL_TOKEN_SUPPLY = 1_000_000_000;   // 1 billion tokens
const FEE_BASIS_POINTS = 100;              // 1% fee (100 basis points)

// Migration parameters
const MIGRATION_THRESHOLD_SOL = 84;        // Migrate slightly under theoretical cap (~85.7 SOL)

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
  console.log("🚀 Fundly Global Config Initialization");
  console.log("=====================================\n");
  
  // Load IDL
  console.log("📁 Loading IDL...");
  const idlPath = path.join(__dirname, "../target/idl/fundly.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Did you run 'anchor build'?`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address);
  console.log(`✅ Program ID: ${programId.toBase58()}\n`);
  
  // Load admin keypair
  console.log(`📁 Loading admin keypair from: ${ADMIN_KEYPAIR_PATH}`);
  if (!fs.existsSync(ADMIN_KEYPAIR_PATH)) {
    throw new Error(`Keypair not found at ${ADMIN_KEYPAIR_PATH}`);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`✅ Admin public key: ${adminKeypair.publicKey.toBase58()}\n`);
  
  // Setup connection
  console.log(`🌐 Connecting to ${NETWORK}...`);
  const connection = getConnection(NETWORK);
  
  // Check balance
  const balance = await connection.getBalance(adminKeypair.publicKey);
  console.log(`💰 Admin balance: ${balance / 1e9} SOL`);
  
  if (balance < 0.1 * 1e9) {
    console.log("⚠️  Warning: Low balance. You may need more SOL for rent.");
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
  
  // Display configuration
  console.log("📋 Configuration Parameters:");
  console.log("============================");
  console.log(`Virtual SOL Reserves:      ${VIRTUAL_SOL_RESERVES} SOL`);
  console.log(`Virtual Token Reserves:    ${VIRTUAL_TOKEN_RESERVES.toLocaleString()} tokens`);
  console.log(`Initial Token Supply:      ${INITIAL_TOKEN_SUPPLY.toLocaleString()} tokens`);
  console.log(`Fee Basis Points:          ${FEE_BASIS_POINTS} (${FEE_BASIS_POINTS / 100}%)`);
  console.log(`Migration Threshold:       ${MIGRATION_THRESHOLD_SOL} SOL 🚀`);
  console.log(`Raydium AMM Program:       ${RAYDIUM_AMM_V4.toBase58()}`);
  
  console.log("\n⏳ Initializing global config...\n");
  
  try {
    // Convert to proper units
    const virtualSolLamports = new anchor.BN(VIRTUAL_SOL_RESERVES * 1e9);
    const virtualTokenRaw = new anchor.BN(VIRTUAL_TOKEN_RESERVES * 1_000_000);
    const initialTokenSupplyRaw = new anchor.BN(INITIAL_TOKEN_SUPPLY * 1_000_000);
    const migrationThresholdLamports = new anchor.BN(MIGRATION_THRESHOLD_SOL * 1e9);
    
    const signature = await program.methods
      .initializeGlobalConfig(
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
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Global config initialized successfully!");
    console.log(`📝 Transaction signature: ${signature}`);
    console.log(`🔍 View on explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`);
    
    console.log("\n🎉 Setup complete!");
    console.log("\nNext steps:");
    console.log("1. Copy IDL to frontend: cp target/idl/fundly.json frontend/src/idl/fundly.json");
    console.log("2. Create test bonding curves");
    console.log("3. Buy tokens to test progress");
    console.log(`4. When ${MIGRATION_THRESHOLD_SOL} SOL accumulated, test migration!`);
    
  } catch (error) {
    console.error("❌ Error initializing global config:");
    console.error(error);
    
    if (error.message?.includes("already in use")) {
      console.log("\n💡 Tip: Global config already exists. You can only initialize it once.");
      console.log("   If you need to change parameters, you'll need to:");
      console.log("   1. Deploy a new program version, or");
      console.log("   2. Add an update_global_config instruction");
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

