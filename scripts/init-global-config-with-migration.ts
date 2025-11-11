/**
 * Initialize Global Config with Migration Parameters
 * 
 * This script initializes the global configuration for the Fundly bonding curve system
 * including the new automatic DEX migration threshold feature.
 * 
 * Usage:
 *   1. Update the ADMIN_KEYPAIR_PATH with your admin keypair location
 *   2. Update NETWORK to target network (devnet, testnet, or mainnet-beta)
 *   3. Run: npx tsx scripts/init-global-config-with-migration.ts
 *          or: node --loader ts-node/esm scripts/init-global-config-with-migration.ts
 */

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// Import the RPC function (adjust path as needed)
// Since this is in scripts/, we need to import from frontend/src
const { rpc_initializeGlobalConfig } = require("../frontend/src/lib/anchorClient");

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

const NETWORK = "devnet"; // "devnet" | "testnet" | "mainnet-beta"
const ADMIN_KEYPAIR_PATH = path.join(process.env.HOME || "", ".config/solana/id.json");

// Bonding curve parameters
const VIRTUAL_SOL_RESERVES = 30;              // 30 SOL virtual reserves
const VIRTUAL_TOKEN_RESERVES = 350_000_000;   // 350 million virtual tokens
const INITIAL_TOKEN_SUPPLY = 1_000_000_000;   // 1 billion tokens
const FEE_BASIS_POINTS = 100;              // 1% fee (100 basis points)

// Migration parameters
const MIGRATION_THRESHOLD_SOL = 84;        // Migrate slightly under theoretical cap (~85.7 SOL)

// Raydium AMM V4 Program ID
const RAYDIUM_AMM_V4_MAINNET = new PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
);

// For devnet/testnet, use the same program or a test version
const RAYDIUM_AMM_V4_DEVNET = RAYDIUM_AMM_V4_MAINNET; // Same for devnet

// ============================================================================
// Script
// ============================================================================

function getConnection(network: string): Connection {
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

function getRaydiumProgramId(network: string): PublicKey {
  return network === "mainnet-beta" ? RAYDIUM_AMM_V4_MAINNET : RAYDIUM_AMM_V4_DEVNET;
}

async function main() {
  console.log("🚀 Fundly Global Config Initialization");
  console.log("=====================================\n");
  
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
  
  // Create wallet adapter-like object
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
  
  // Display configuration
  console.log("\n📋 Configuration Parameters:");
  console.log("============================");
  console.log(`Virtual SOL Reserves:      ${VIRTUAL_SOL_RESERVES} SOL`);
  console.log(`Virtual Token Reserves:    ${VIRTUAL_TOKEN_RESERVES.toLocaleString()} tokens`);
  console.log(`Initial Token Supply:      ${INITIAL_TOKEN_SUPPLY.toLocaleString()} tokens`);
  console.log(`Fee Basis Points:          ${FEE_BASIS_POINTS} (${FEE_BASIS_POINTS / 100}%)`);
  console.log(`Migration Threshold:       ${MIGRATION_THRESHOLD_SOL} SOL 🚀`);
  
  const raydiumProgram = getRaydiumProgramId(NETWORK);
  console.log(`Raydium AMM Program:       ${raydiumProgram.toBase58()}`);
  
  console.log("\n⏳ Initializing global config...\n");
  
  try {
    const signature = await rpc_initializeGlobalConfig(
      connection,
      wallet as any,
      VIRTUAL_SOL_RESERVES,
      VIRTUAL_TOKEN_RESERVES,
      INITIAL_TOKEN_SUPPLY,
      FEE_BASIS_POINTS,
      MIGRATION_THRESHOLD_SOL,
      raydiumProgram
    );
    
    console.log("✅ Global config initialized successfully!");
    console.log(`📝 Transaction signature: ${signature}`);
    console.log(`🔍 View on explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`);
    
    console.log("\n🎉 Setup complete!");
    console.log("\nNext steps:");
    console.log("1. Create test bonding curves");
    console.log("2. Buy tokens to test progress");
    console.log("3. Watch migration progress in the UI");
    console.log(`4. When ${MIGRATION_THRESHOLD_SOL} SOL accumulated, test migration!`);
    
  } catch (error: any) {
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

