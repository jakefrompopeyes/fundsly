/**
 * Check Global Config
 * 
 * View the current global configuration
 * 
 * Usage: node scripts/check-global-config.js
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
  console.log("🔍 Checking Global Config");
  console.log("=========================\n");
  
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
  console.log(`🌐 Network: ${NETWORK}\n`);
  
  try {
    const config = await program.account.globalConfig.fetch(globalConfigPda);
    
    console.log("✅ Global Config Found!");
    console.log("=======================\n");
    console.log(`Authority:               ${config.authority.toBase58()}`);
    console.log(`Virtual SOL Reserves:    ${config.virtualSolReserves.toNumber() / 1e9} SOL`);
    console.log(`Virtual Token Reserves:  ${(config.virtualTokenReserves.toNumber() / 1_000_000).toLocaleString()} tokens`);
    console.log(`Initial Token Supply:    ${(config.initialTokenSupply.toNumber() / 1_000_000).toLocaleString()} tokens`);
    console.log(`Fee Basis Points:        ${config.feeBasisPoints} (${config.feeBasisPoints / 100}%)`);
    
    // Check if migration parameters exist
    if (config.migrationThresholdSol) {
      console.log(`Migration Threshold:     ${config.migrationThresholdSol.toNumber() / 1e9} SOL 🚀`);
      console.log(`Raydium AMM Program:     ${config.raydiumAmmProgram.toBase58()}`);
      console.log("\n✅ Migration parameters configured!");
    } else {
      console.log("\n⚠️  Migration parameters NOT configured (old version)");
      console.log("\n💡 To add migration support:");
      console.log("   1. Close this account (solana program close)");
      console.log("   2. Redeploy the program");
      console.log("   3. Run init script again");
    }
    
  } catch (error) {
    if (error.message?.includes("Account does not exist")) {
      console.log("❌ Global config not found");
      console.log("\n💡 Run: node scripts/init-global-config-migration.js");
    } else {
      console.error("Error fetching config:", error.message);
    }
  }
}

main().catch(console.error);

