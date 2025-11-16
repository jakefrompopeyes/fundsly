/**
 * Burn Raydium LP Tokens Script
 * 
 * This script burns LP tokens to permanently lock liquidity in a Raydium pool.
 * This is the final step after creating a Raydium pool for a migrated token.
 * 
 * IMPORTANT: This action is IRREVERSIBLE! Once LP tokens are burned, 
 * the liquidity is permanently locked and cannot be removed.
 * 
 * PREREQUISITES:
 * 1. Token has been migrated (migrate_to_raydium called)
 * 2. Raydium pool has been created
 * 3. LP tokens are in the migration authority's token account
 * 4. You have the Raydium pool address and LP token mint address
 * 
 * USAGE:
 * npx ts-node scripts/burn-lp-tokens.ts <TOKEN_MINT> <LP_MINT> <RAYDIUM_POOL> <LP_AMOUNT>
 * 
 * EXAMPLE:
 * npx ts-node scripts/burn-lp-tokens.ts \
 *   EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
 *   5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1 \
 *   58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2 \
 *   1000000
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import BN from "bn.js";

// Load IDL
const idlPath = path.join(__dirname, "../target/idl/fundly.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");

/**
 * Load keypair from file or environment
 */
function loadKeypair(): Keypair {
  const keypairPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME!, ".config/solana/id.json");
  
  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error("❌ Failed to load keypair from:", keypairPath);
    console.error("Set ANCHOR_WALLET environment variable or ensure ~/.config/solana/id.json exists");
    process.exit(1);
  }
}

/**
 * Verify migration vault has LP tokens
 */
async function verifyLpTokens(
  connection: Connection,
  lpMint: PublicKey,
  migrationAuthority: PublicKey,
  expectedAmount: number
): Promise<boolean> {
  const lpTokenAccount = await getAssociatedTokenAddress(
    lpMint,
    migrationAuthority,
    true
  );

  try {
    const accountInfo = await connection.getTokenAccountBalance(lpTokenAccount);
    const currentAmount = parseFloat(accountInfo.value.uiAmount || "0");

    console.log("\n📊 LP Token Account Status:");
    console.log(`  Address: ${lpTokenAccount.toBase58()}`);
    console.log(`  Current balance: ${currentAmount} LP tokens`);
    console.log(`  Expected to burn: ${expectedAmount} LP tokens`);

    if (currentAmount < expectedAmount) {
      console.error(`\n❌ Insufficient LP tokens!`);
      console.error(`  Need: ${expectedAmount}, Have: ${currentAmount}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("\n❌ LP token account not found!");
    console.error(`  Expected account: ${lpTokenAccount.toBase58()}`);
    console.error("  Make sure the Raydium pool was created and LP tokens were sent to migration authority.");
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error("❌ Usage: npx ts-node scripts/burn-lp-tokens.ts <TOKEN_MINT> <LP_MINT> <RAYDIUM_POOL> <LP_AMOUNT>");
    console.error("\nExample:");
    console.error("  npx ts-node scripts/burn-lp-tokens.ts \\");
    console.error("    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \\");
    console.error("    5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1 \\");
    console.error("    58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2 \\");
    console.error("    1000000");
    process.exit(1);
  }

  const tokenMint = new PublicKey(args[0]);
  const lpMint = new PublicKey(args[1]);
  const raydiumPool = new PublicKey(args[2]);
  const lpAmount = parseFloat(args[3]);

  console.log("🔥 LP Token Burning Tool");
  console.log("========================\n");
  console.log("Token Mint:", tokenMint.toBase58());
  console.log("LP Token Mint:", lpMint.toBase58());
  console.log("Raydium Pool:", raydiumPool.toBase58());
  console.log("LP Amount to Burn:", lpAmount);
  console.log("\n⚠️  WARNING: This action is IRREVERSIBLE!");
  console.log("⚠️  Liquidity will be PERMANENTLY LOCKED!\n");

  // Setup connection and program
  const connection = new Connection(RPC_URL, "confirmed");
  const keypair = loadKeypair();
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new Program(idl, provider);

  console.log("Authority wallet:", wallet.publicKey.toBase58());

  // Derive PDAs
  const [bondingCurve] = await PublicKey.findProgramAddress(
    [Buffer.from("bonding_curve"), tokenMint.toBuffer()],
    PROGRAM_ID
  );

  const [globalConfig] = await PublicKey.findProgramAddress(
    [Buffer.from("global_config")],
    PROGRAM_ID
  );

  const [migrationAuthority] = await PublicKey.findProgramAddress(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );

  // Verify bonding curve is migrated
  console.log("\n🔍 Verifying migration status...");
  try {
    const bondingCurveData = await program.account.bondingCurve.fetch(bondingCurve);
    
    if (!bondingCurveData.migrated) {
      console.error("❌ Token has not been migrated yet!");
      console.error("   Call migrate_to_raydium first.");
      process.exit(1);
    }

    if (bondingCurveData.lpBurned) {
      console.error("❌ LP tokens have already been burned!");
      console.error(`   ${bondingCurveData.lpBurnedAmount.toString()} LP tokens were burned previously.`);
      process.exit(1);
    }

    console.log("✅ Token is migrated and ready for LP burning");
  } catch (error) {
    console.error("❌ Failed to fetch bonding curve:", error);
    process.exit(1);
  }

  // Verify LP tokens exist
  const hasLpTokens = await verifyLpTokens(connection, lpMint, migrationAuthority, lpAmount);
  if (!hasLpTokens) {
    process.exit(1);
  }

  // Get LP token account
  const lpTokenAccount = await getAssociatedTokenAddress(
    lpMint,
    migrationAuthority,
    true
  );

  // Confirm with user
  console.log("\n⚠️  FINAL CONFIRMATION");
  console.log("======================");
  console.log("You are about to PERMANENTLY LOCK liquidity by burning:");
  console.log(`  ${lpAmount} LP tokens`);
  console.log("\nThis will:");
  console.log("  ✅ Make the liquidity non-rug-pullable");
  console.log("  ✅ Build trust with your community");
  console.log("  ⛔ CANNOT be reversed");
  console.log("\nContinuing in 5 seconds... (Press Ctrl+C to cancel)");
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Convert LP amount to raw units
  const lpAmountRaw = new BN(lpAmount * 1_000_000);

  // Execute burn
  console.log("\n🔥 Burning LP tokens...");
  try {
    const tx = await program.methods
      .burnRaydiumLpTokens(lpAmountRaw)
      .accounts({
        bondingCurve,
        mint: tokenMint,
        lpMint,
        lpTokenAccount,
        migrationAuthority,
        raydiumPool,
        globalConfig,
        authority: wallet.publicKey,
        tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        systemProgram: new PublicKey("11111111111111111111111111111111"),
      })
      .rpc();

    console.log("\n✅ SUCCESS! LP tokens burned!");
    console.log("Transaction signature:", tx);
    console.log("\n🔒 Liquidity is now PERMANENTLY LOCKED!");
    console.log("\n📝 Summary:");
    console.log("  - Token:", tokenMint.toBase58());
    console.log("  - Raydium Pool:", raydiumPool.toBase58());
    console.log("  - LP Tokens Burned:", lpAmount);
    console.log("  - Transaction:", `https://solscan.io/tx/${tx}?cluster=${RPC_URL.includes('devnet') ? 'devnet' : 'mainnet'}`);
    
    // Save burn info
    const burnInfo = {
      tokenMint: tokenMint.toBase58(),
      lpMint: lpMint.toBase58(),
      raydiumPool: raydiumPool.toBase58(),
      lpAmountBurned: lpAmount,
      transactionSignature: tx,
      timestamp: new Date().toISOString(),
    };

    const filename = `lp-burn-${tokenMint.toBase58().slice(0, 8)}.json`;
    fs.writeFileSync(filename, JSON.stringify(burnInfo, null, 2));
    console.log(`\n💾 Burn details saved to: ${filename}`);

  } catch (error: any) {
    console.error("\n❌ Failed to burn LP tokens!");
    console.error("Error:", error.message);
    
    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
    
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("\n🎉 Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });


