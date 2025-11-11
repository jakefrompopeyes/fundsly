/**
 * Debug script to check bonding curve state and diagnose insufficient tokens error
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const { Program, AnchorProvider, web3, BN } = require("@coral-xyz/anchor");
const idl = require("../target/idl/fundly.json");

// Get mint address from command line
const mintAddress = process.argv[2];

if (!mintAddress) {
  console.error("❌ Usage: node debug-bonding-curve.js <MINT_ADDRESS>");
  process.exit(1);
}

async function main() {
  try {
    // Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Create a dummy wallet for read-only operations
    const dummyWallet = {
      publicKey: new PublicKey("11111111111111111111111111111111"),
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    };
    
    const provider = new AnchorProvider(connection, dummyWallet, {
      commitment: "confirmed",
    });
    
    const program = new Program(idl, provider);
    const mint = new PublicKey(mintAddress);
    
    console.log("\n🔍 Debugging Bonding Curve for mint:", mintAddress);
    console.log("=".repeat(80));
    
    // Derive PDAs
    const [bondingCurvePda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.toBuffer()],
      program.programId
    );
    
    const [globalConfigPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      program.programId
    );
    
    // Fetch accounts
    console.log("\n📊 Fetching account data...\n");
    
    const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda);
    const globalConfig = await program.account.globalConfig.fetch(globalConfigPda);
    
    // Display global config
    console.log("🌐 Global Config:");
    console.log("  Virtual SOL Reserves:", globalConfig.virtualSolReserves.toNumber() / 1e9, "SOL");
    console.log("  Virtual Token Reserves:", globalConfig.virtualTokenReserves.toNumber() / 1e6, "tokens");
    console.log("  Fee (basis points):", globalConfig.feeBasisPoints);
    console.log("  Migration Threshold:", globalConfig.migrationThresholdSol.toNumber() / 1e9, "SOL");
    
    // Display bonding curve state
    console.log("\n📈 Bonding Curve State:");
    console.log("  Mint:", bondingCurve.mint.toBase58());
    console.log("  Creator:", bondingCurve.creator.toBase58());
    console.log("  Virtual SOL:", bondingCurve.virtualSolReserves.toNumber() / 1e9, "SOL");
    console.log("  Virtual Tokens:", bondingCurve.virtualTokenReserves.toNumber() / 1e6, "tokens");
    console.log("  Real SOL:", bondingCurve.realSolReserves.toNumber() / 1e9, "SOL");
    console.log("  Real Tokens:", bondingCurve.realTokenReserves.toNumber() / 1e6, "tokens");
    console.log("  Complete:", bondingCurve.complete);
    console.log("  Migrated:", bondingCurve.migrated);
    
    // Calculate current state for 10 SOL buy
    console.log("\n🧮 Simulating 10 SOL Buy:");
    console.log("=".repeat(80));
    
    const solIn = 10 * 1e9; // 10 SOL in lamports
    const feeBps = globalConfig.feeBasisPoints;
    const fee = Math.floor((solIn * feeBps) / 10000);
    const solAfterFee = solIn - fee;
    
    console.log("  Input: 10 SOL");
    console.log("  Fee:", fee / 1e9, "SOL");
    console.log("  After fee:", solAfterFee / 1e9, "SOL");
    
    // Calculate using constant product formula
    const virtualSol = bondingCurve.virtualSolReserves.toNumber();
    const virtualToken = bondingCurve.virtualTokenReserves.toNumber();
    const realSol = bondingCurve.realSolReserves.toNumber();
    const realToken = bondingCurve.realTokenReserves.toNumber();
    
    const totalSolBefore = virtualSol + realSol;
    const totalTokenBefore = virtualToken + realToken;
    const k = totalSolBefore * totalTokenBefore;
    
    console.log("\n  Reserves before trade:");
    console.log("    Total SOL:", totalSolBefore / 1e9, "SOL (virtual:", virtualSol / 1e9, "+ real:", realSol / 1e9, ")");
    console.log("    Total Tokens:", totalTokenBefore / 1e6, "tokens (virtual:", virtualToken / 1e6, "+ real:", realToken / 1e6, ")");
    console.log("    K (constant product):", (k / 1e15).toFixed(2), "× 10^15");
    
    const totalSolAfter = totalSolBefore + solAfterFee;
    const totalTokenAfter = k / totalSolAfter;
    const tokensOut = totalTokenBefore - totalTokenAfter;
    
    console.log("\n  Reserves after trade:");
    console.log("    Total SOL:", totalSolAfter / 1e9, "SOL");
    console.log("    Total Tokens:", totalTokenAfter / 1e6, "tokens");
    console.log("    Tokens out:", tokensOut / 1e6, "tokens");
    
    // Check if this exceeds available tokens
    console.log("\n  ✅ Available real tokens:", realToken / 1e6, "tokens");
    console.log("  📊 Tokens needed:", tokensOut / 1e6, "tokens");
    
    if (tokensOut > realToken) {
      console.log("\n  ❌ ERROR: Not enough tokens in bonding curve!");
      console.log("     Shortfall:", (tokensOut - realToken) / 1e6, "tokens");
      console.log("\n💡 PROBLEM IDENTIFIED:");
      console.log("   The bonding curve doesn't have enough tokens to fulfill this trade.");
      console.log("   This usually means:");
      console.log("   1. The bonding curve was not properly funded with tokens");
      console.log("   2. The tokens were not transferred after initialization");
      console.log("   3. The virtual/real reserve ratio is misconfigured");
    } else {
      console.log("\n  ✅ Trade should succeed - sufficient tokens available");
      const effectivePrice = (solAfterFee / 1e9) / (tokensOut / 1e6);
      console.log("  💰 Effective price:", effectivePrice.toFixed(9), "SOL per token");
    }
    
    // Check the actual token account balance
    const { getAssociatedTokenAddress, getAccount } = require("@solana/spl-token");
    const bondingCurveAta = await getAssociatedTokenAddress(
      mint,
      bondingCurvePda,
      true
    );
    
    console.log("\n💼 Token Account Balance:");
    try {
      const tokenAccount = await getAccount(connection, bondingCurveAta);
      console.log("  Bonding Curve ATA:", bondingCurveAta.toBase58());
      console.log("  Actual balance:", Number(tokenAccount.amount) / 1e6, "tokens");
      
      if (Number(tokenAccount.amount) !== realToken) {
        console.log("  ⚠️  WARNING: Account balance doesn't match bonding curve state!");
        console.log("     State says:", realToken / 1e6, "tokens");
        console.log("     Account has:", Number(tokenAccount.amount) / 1e6, "tokens");
      }
    } catch (e) {
      console.log("  ❌ Could not fetch token account:", e.message);
    }
    
    console.log("\n" + "=".repeat(80));
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.logs) {
      console.error("Program logs:");
      error.logs.forEach(log => console.error("  ", log));
    }
    process.exit(1);
  }
}

main();

