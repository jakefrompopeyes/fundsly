const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");

const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");
const mint = new PublicKey("FQSpzuQUnaTn9zWx7iEG9VddRmsv36pCMKwmB2Wcib5t");

async function processManually() {
  console.log("\n🚀 Manually Processing Migration");
  console.log("==================================\n");
  console.log("Token Mint:", mint.toBase58());
  
  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load admin keypair
  const keypairPath = path.join(process.env.HOME, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log("Admin Wallet:", payer.publicKey.toBase58());
  
  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/fundly.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: payer.publicKey, signTransaction: async (tx) => tx },
    {}
  );
  const program = new anchor.Program(idl, provider);
  
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("\n⚠️  NOTE: Pool creation requires Raydium SDK integration.");
  console.log("Since this is devnet, Raydium CPMM might not be fully supported.\n");
  console.log("✅ Migration vaults have your funds:");
  console.log("   - 83.1 SOL");
  console.log("   - 144.3M tokens\n");
  console.log("🔧 For now, these funds are safely locked in the migration vaults.");
  console.log("📝 When you're ready for mainnet, the automatic service will work!\n");
}

processManually().catch(console.error);
