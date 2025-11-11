/**
 * Fix Global Config - Close and Reinitialize
 * 
 * This script:
 * 1. Closes the old global_config account
 * 2. Reinitializes it with the correct structure
 * 
 * Usage: node scripts/fix-global-config.js
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

// Bonding curve parameters (matching init-global-config-migration.js)
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
  console.log("🔧 Fixing Global Config");
  console.log("========================\n");
  
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
  
  // Step 1: Check if account exists
  console.log("🔍 Checking existing account...");
  const accountInfo = await connection.getAccountInfo(globalConfigPda);
  
  if (accountInfo) {
    console.log(`✅ Found existing account (${accountInfo.data.length} bytes)`);
    console.log(`💰 Account has ${accountInfo.lamports / 1e9} SOL in rent\n`);
    
    // We need to close this account first
    // Since it's a PDA, we can't directly close it without a program instruction
    // The workaround is to use a new program deployment or add a close instruction
    
    console.log("⚠️  The account exists but has an incompatible structure.");
    console.log("\n🔧 Solutions:\n");
    console.log("Option 1 (Recommended for devnet):");
    console.log("  1. Deploy a fresh program instance:");
    console.log("     solana-keygen new -o target/deploy/fundly-keypair.json --force");
    console.log("     anchor build");
    console.log("     anchor deploy --provider.cluster devnet");
    console.log("     cp target/idl/fundly.json frontend/src/idl/fundly.json");
    console.log("  2. Then run this script again to initialize the new global config\n");
    
    console.log("Option 2 (If you want to keep the same program):");
    console.log("  Add a 'close_global_config' instruction to your program");
    console.log("  that allows the authority to close and recover rent.\n");
    
    console.log("For now, let's try to initialize anyway (will fail if account exists)...\n");
  } else {
    console.log("✅ No existing account found - ready to initialize\n");
  }
  
  // Step 2: Try to initialize
  console.log("🚀 Initializing global config...\n");
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
    
    console.log("✅ Global config initialized successfully!");
    console.log(`📝 Transaction: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}\n`);
    
    console.log("🎉 Setup complete! You can now create coins.");
    
  } catch (error) {
    console.error("\n❌ Error:");
    
    if (error.message?.includes("already in use") || error.message?.includes("0x0")) {
      console.log("\nThe account already exists and cannot be reinitialized.");
      console.log("\n💡 You need to deploy a new program version:");
      console.log("\n  # Generate new program keypair");
      console.log("  solana-keygen new -o target/deploy/fundly-keypair.json --force");
      console.log("  ");
      console.log("  # Build and deploy");
      console.log("  anchor build");
      console.log("  anchor deploy --provider.cluster devnet");
      console.log("  ");
      console.log("  # Update frontend IDL");
      console.log("  cp target/idl/fundly.json frontend/src/idl/fundly.json");
      console.log("  ");
      console.log("  # Run this script again");
      console.log("  node scripts/fix-global-config.js");
    } else {
      console.error(error);
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

