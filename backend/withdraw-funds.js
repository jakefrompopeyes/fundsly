const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } = require("@solana/spl-token");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");

const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");
const mint = new PublicKey("FQSpzuQUnaTn9zWx7iEG9VddRmsv36pCMKwmB2Wcib5t");

async function withdraw() {
  console.log("\n💸 Withdrawing Funds from Migration Vaults");
  console.log("===========================================\n");
  
  // Setup
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const keypairPath = path.join(process.env.HOME, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  // Create wallet object for Anchor
  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(payer);
      return tx;
    },
    signAllTransactions: async (txs) => {
      return txs.map(tx => {
        tx.partialSign(payer);
        return tx;
      });
    },
  };
  
  const idlPath = path.join(__dirname, "../target/idl/fundly.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(idl, provider);
  
  console.log("Token:", mint.toBase58());
  console.log("Admin:", payer.publicKey.toBase58(), "\n");
  
  // Get vault info
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
  
  console.log("📊 Vault Balances:");
  console.log("   SOL:", (solBalance / 1e9).toFixed(4), "SOL");
  console.log("   Tokens:", (tokenAmount / 1e6).toLocaleString(), "tokens\n");
  
  // Setup accounts
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
    console.log("Creating recipient token account...");
    const createIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      recipientTokenAccount,
      payer.publicKey,
      mint
    );
    const tx = new Transaction().add(createIx);
    await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log("✅ Token account created\n");
  }
  
  console.log("📝 Calling withdraw_migration_funds instruction...");
  
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
      .rpc();
    
    console.log("\n✅ Withdrawal successful!");
    console.log("   Transaction:", tx);
    console.log("   Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet\n");
    
    // Check new balances
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newBalance = await connection.getBalance(payer.publicKey);
    const newTokenBalance = await connection.getTokenAccountBalance(recipientTokenAccount);
    
    console.log("💰 Your wallet now has:");
    console.log("   SOL:", (newBalance / 1e9).toFixed(4), "SOL");
    console.log("   Tokens:", newTokenBalance.value.uiAmountString, "tokens\n");
    
    console.log("🎉 Funds successfully withdrawn!");
    console.log("\n📝 Next Steps:");
    console.log("   1. Create Raydium pool manually via Raydium UI");
    console.log("   2. Or wait for mainnet where automatic service will handle it\n");
    
  } catch (error) {
    console.error("\n❌ Withdrawal failed:", error.message);
    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach(log => console.error("  ", log));
    }
  }
}

withdraw().catch(console.error);
