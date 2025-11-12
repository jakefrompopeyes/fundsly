/**
 * Check if Treasury is Configured in Global Config
 * 
 * This checks if the global config has a treasury address set
 * and shows the current balance
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
  console.log("🔍 Checking Treasury Configuration");
  console.log("===================================\n");
  
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
    
    // Check if treasury field exists
    if (config.treasury) {
      console.log(`Treasury:                ${config.treasury.toBase58()}`);
      console.log(`Fee Basis Points:        ${config.feeBasisPoints} (${config.feeBasisPoints / 100}%)`);
      console.log("");
      
      // Check treasury balance
      const treasuryBalance = await connection.getBalance(config.treasury);
      console.log("💰 Treasury Balance:");
      console.log(`   ${treasuryBalance / 1e9} SOL`);
      console.log("");
      
      // Check if treasury is collecting fees
      if (treasuryBalance > 0) {
        console.log("✅ Treasury is receiving fees!");
        console.log("   Your platform is collecting revenue automatically.");
      } else {
        console.log("⚠️  Treasury balance is 0 SOL");
        console.log("   Either no trades have happened yet, or fees aren't being collected.");
      }
      
      console.log("");
      console.log("🔗 View Treasury on Explorer:");
      console.log(`   https://explorer.solana.com/address/${config.treasury.toBase58()}?cluster=devnet`);
      
    } else {
      console.log("❌ Treasury:                NOT CONFIGURED");
      console.log("");
      console.log("⚠️  WARNING: Your global config doesn't have a treasury field!");
      console.log("   This means fees are NOT being collected automatically.");
      console.log("");
      console.log("💡 To fix this:");
      console.log("   1. Update your global config to include a treasury:");
      console.log("      ts-node scripts/update-treasury.ts YOUR_TREASURY_ADDRESS");
      console.log("");
      console.log("   2. Or re-initialize with the new version:");
      console.log("      node scripts/reset-global-config.js");
    }
    
  } catch (error) {
    if (error.message?.includes("Account does not exist")) {
      console.log("❌ Global config not found");
      console.log("\n💡 Initialize it first: ts-node scripts/init-global-config.ts");
    } else {
      console.error("Error:", error.message);
    }
  }
}

main().catch(console.error);

