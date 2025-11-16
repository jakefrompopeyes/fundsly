const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } = require("@solana/spl-token");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");

const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");
const mint = new PublicKey("FQSpzuQUnaTn9zWx7iEG9VddRmsv36pCMKwmB2Wcib5t");
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

async function complete() {
  console.log("\n🚀 Completing Migration for Token");
  console.log("===================================\n");
  console.log("Token:", mint.toBase58());
  
  // Setup
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const keypairPath = path.join(process.env.HOME, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  const idlPath = path.join(__dirname, "../target/idl/fundly.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new anchor.AnchorProvider(connection, { publicKey: payer.publicKey }, {});
  const program = new anchor.Program(idl, provider);
  
  console.log("Admin:", payer.publicKey.toBase58(), "\n");
  
  // Step 1: Get vault info
  console.log("Step 1: Getting vault balances...\n");
  
  const [solVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
  
  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );
  
  const tokenAccount = await getAssociatedTokenAddress(mint, authority, true);
  
  const solBalance = await connection.getBalance(solVault);
  const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
  const tokenAmount = Number(tokenAccountInfo.data.readBigUInt64LE(64));
  
  console.log("   SOL in vault:", (solBalance / 1e9).toFixed(4), "SOL");
  console.log("   Tokens in vault:", (tokenAmount / 1e6).toLocaleString(), "tokens\n");
  
  // Step 2: Withdraw funds
  console.log("Step 2: Withdrawing funds from vaults...\n");
  
  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    PROGRAM_ID
  );
  
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    PROGRAM_ID
  );
  
  const recipientTokenAccount = await getAssociatedTokenAddress(mint, payer.publicKey, false);
  const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
  
  if (!recipientTokenAccountInfo) {
    console.log("   Creating recipient token account...");
    const createIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      recipientTokenAccount,
      payer.publicKey,
      mint
    );
    const tx = new Transaction().add(createIx);
    await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log("   ✅ Token account created\n");
  }
  
  console.log("   Calling withdraw_migration_funds...");
  
  try {
    const tx = await program.methods
      .withdrawMigrationFunds(
        new anchor.BN(solBalance),
        new anchor.BN(tokenAmount)
      )
      .accounts({
        bondingCurve,
        mint,
        migrationSolVault: solVault,
        migrationTokenAccount: tokenAccount,
        migrationAuthority: authority,
        globalConfig,
        authority: payer.publicKey,
        recipient: payer.publicKey,
        recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
    
    console.log("   ✅ Withdrawal successful!");
    console.log("   Transaction:", tx);
    console.log("   Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet\n");
    
    const newBalance = await connection.getBalance(payer.publicKey);
    console.log("   Your wallet now has:");
    console.log("   - SOL:", (newBalance / 1e9).toFixed(4), "SOL");
    console.log("   - Tokens:", (tokenAmount / 1e6).toLocaleString(), "tokens\n");
    
    console.log("✅ Step 2 complete!\n");
    console.log("📝 Next: You can now manually create a Raydium pool");
    console.log("   Or wait for full Raydium SDK integration on devnet.\n");
    
  } catch (error) {
    console.error("❌ Withdrawal failed:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
  }
}

complete().catch(console.error);
