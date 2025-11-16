const { Connection, PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");

const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");
const mint = new PublicKey("FQSpzuQUnaTn9zWx7iEG9VddRmsv36pCMKwmB2Wcib5t");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function check() {
  console.log("Checking migration vaults for:", mint.toBase58());
  
  // Get migration vault PDAs
  const [solVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
  
  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );
  
  const tokenAccount = await getAssociatedTokenAddress(mint, authority, true);
  
  // Check balances
  const solBalance = await connection.getBalance(solVault);
  const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
  
  let tokenAmount = 0;
  if (tokenAccountInfo) {
    tokenAmount = Number(tokenAccountInfo.data.readBigUInt64LE(64));
  }
  
  console.log("\n✅ Migration Vault Status:");
  console.log("   SOL Vault:", solVault.toBase58());
  console.log("   SOL Balance:", (solBalance / 1e9).toFixed(4), "SOL");
  console.log("   Token Account:", tokenAccount.toBase58());
  console.log("   Token Balance:", (tokenAmount / 1e6).toLocaleString(), "tokens");
  
  if (solBalance > 0 && tokenAmount > 0) {
    console.log("\n🎉 Migration vaults have funds! Ready to create pool.");
  } else {
    console.log("\n⚠️  Migration vaults are empty or incomplete.");
  }
}

check().catch(console.error);
