/**
 * Close Global Config Account
 * 
 * This closes the global config account so it can be reinitialized with correct values
 * 
 * Usage: node scripts/close-global-config.js
 */

const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require("@solana/web3.js");
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
  console.log("🗑️  Close Global Config Account");
  console.log("================================\n");
  
  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/fundly.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address);
  
  // Load admin keypair
  const keypairData = JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  // Setup connection
  const connection = getConnection(NETWORK);
  
  // Derive global config PDA
  const globalConfigPda = deriveGlobalConfigPda(programId);
  
  console.log(`📍 Global Config PDA: ${globalConfigPda.toBase58()}`);
  console.log(`👤 Admin: ${adminKeypair.publicKey.toBase58()}`);
  console.log(`🌐 Network: ${NETWORK}\n`);
  
  try {
    // Check account exists
    const accountInfo = await connection.getAccountInfo(globalConfigPda);
    
    if (!accountInfo) {
      console.log("✅ Account doesn't exist (already closed or never created)");
      return;
    }
    
    console.log(`📊 Account Data Length: ${accountInfo.data.length} bytes`);
    console.log(`💰 Account Lamports: ${accountInfo.lamports / 1e9} SOL`);
    console.log(`👑 Owner: ${accountInfo.owner.toBase58()}\n`);
    
    // Close the account by transferring lamports to admin and setting data to empty
    console.log("⏳ Closing account...\n");
    
    // Since this is a PDA owned by the program, we need to use a program instruction
    // For now, let's just show what needs to be done
    console.log("⚠️  Cannot automatically close PDA accounts");
    console.log("\n💡 Options:");
    console.log("   1. Add a 'close_global_config' instruction to your program");
    console.log("   2. Or redeploy the program to a new address");
    console.log("   3. Or update the existing config (add 'update_global_config' instruction)");
    
    console.log("\n🔧 Quick Fix:");
    console.log("   Since testing on devnet, easiest is to:");
    console.log("   1. Generate new program keypair: solana-keygen new -o target/deploy/fundly-keypair.json");
    console.log("   2. Update Anchor.toml with new address");
    console.log("   3. Run: anchor build");
    console.log("   4. Run: anchor deploy --provider.cluster devnet");
    console.log("   5. Copy new IDL and reinitialize global config");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);

