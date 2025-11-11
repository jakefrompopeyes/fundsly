/**
 * Test script for platform fee withdrawal functionality
 * 
 * This script demonstrates:
 * 1. How to calculate accumulated fees for a bonding curve
 * 2. How to withdraw fees to a treasury address
 * 
 * Prerequisites:
 * - A bonding curve must exist with some trading activity
 * - The connected wallet must be the platform authority
 * - Fees must have accumulated through buy/sell transactions
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Fundly } from "../target/types/fundly";
import * as fs from "fs";

// Load keypair from file
function loadKeypair(filename: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filename, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function main() {
  // Configuration
  const RPC_URL = "http://127.0.0.1:8899"; // Localnet
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Load the authority keypair (must match the one used in global config)
  const authority = loadKeypair(
    process.env.AUTHORITY_KEYPAIR || 
    `${process.env.HOME}/.config/solana/id.json`
  );
  
  console.log("🔑 Authority:", authority.publicKey.toString());
  
  // Setup Anchor
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(authority),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);
  
  const program = anchor.workspace.Fundly as Program<Fundly>;
  
  // Get MINT_ADDRESS from command line or environment
  const mintAddress = process.env.MINT_ADDRESS || process.argv[2];
  if (!mintAddress) {
    console.error("❌ Please provide MINT_ADDRESS as argument or env var");
    console.log("Usage: ts-node test-fee-withdrawal.ts <MINT_ADDRESS>");
    process.exit(1);
  }
  
  const mint = new PublicKey(mintAddress);
  console.log("🪙 Token Mint:", mint.toString());
  
  // Derive PDAs
  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    program.programId
  );
  
  const [solVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault"), mint.toBuffer()],
    program.programId
  );
  
  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    program.programId
  );
  
  console.log("\n📍 PDAs:");
  console.log("  Bonding Curve:", bondingCurvePda.toString());
  console.log("  SOL Vault:    ", solVaultPda.toString());
  console.log("  Global Config:", globalConfigPda.toString());
  
  try {
    // Fetch bonding curve state
    console.log("\n📊 Fetching bonding curve state...");
    const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda);
    
    console.log("  Real SOL Reserves:", bondingCurve.realSolReserves.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("  Real Token Reserves:", bondingCurve.realTokenReserves.toNumber() / 1e6, "tokens");
    console.log("  Complete:", bondingCurve.complete);
    console.log("  Migrated:", bondingCurve.migrated);
    
    // Fetch vault balance
    console.log("\n💰 Calculating accumulated fees...");
    const vaultBalance = await connection.getBalance(solVaultPda);
    const realSolReserves = bondingCurve.realSolReserves.toNumber();
    const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(0);
    
    console.log("  Vault Balance:     ", vaultBalance / LAMPORTS_PER_SOL, "SOL");
    console.log("  Real SOL Reserves: ", realSolReserves / LAMPORTS_PER_SOL, "SOL");
    console.log("  Rent Exempt:       ", rentExemptMinimum / LAMPORTS_PER_SOL, "SOL");
    
    const accumulatedFees = Math.max(0, vaultBalance - realSolReserves - rentExemptMinimum);
    console.log("\n  ✨ Accumulated Fees:", accumulatedFees / LAMPORTS_PER_SOL, "SOL");
    
    if (accumulatedFees === 0) {
      console.log("\n⚠️  No fees to withdraw. Try making some buy/sell transactions first.");
      return;
    }
    
    // Verify authority
    console.log("\n🔐 Verifying authority...");
    const globalConfig = await program.account.globalConfig.fetch(globalConfigPda);
    if (!globalConfig.authority.equals(authority.publicKey)) {
      console.error("❌ Connected wallet is not the platform authority");
      console.log("   Expected:", globalConfig.authority.toString());
      console.log("   Got:     ", authority.publicKey.toString());
      return;
    }
    console.log("✅ Authority verified");
    
    // Define treasury (for testing, we'll use the authority's address)
    const treasury = authority.publicKey;
    console.log("\n💼 Treasury address:", treasury.toString());
    
    // Get treasury balance before
    const treasuryBalanceBefore = await connection.getBalance(treasury);
    console.log("   Treasury balance before:", treasuryBalanceBefore / LAMPORTS_PER_SOL, "SOL");
    
    // Withdraw fees
    console.log("\n🚀 Withdrawing fees...");
    const tx = await program.methods
      .withdrawPlatformFees()
      .accounts({
        bondingCurve: bondingCurvePda,
        mint: mint,
        bondingCurveSolVault: solVaultPda,
        globalConfig: globalConfigPda,
        authority: authority.publicKey,
        treasury: treasury,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
    
    console.log("✅ Transaction successful!");
    console.log("   Signature:", tx);
    
    // Wait for confirmation
    await connection.confirmTransaction(tx, "confirmed");
    
    // Get treasury balance after
    const treasuryBalanceAfter = await connection.getBalance(treasury);
    console.log("\n💰 Treasury balance after:", treasuryBalanceAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("   Received:", (treasuryBalanceAfter - treasuryBalanceBefore) / LAMPORTS_PER_SOL, "SOL");
    
    // Verify vault balance
    const vaultBalanceAfter = await connection.getBalance(solVaultPda);
    console.log("\n🏦 Vault balance after:", vaultBalanceAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("   Withdrawn:", (vaultBalance - vaultBalanceAfter) / LAMPORTS_PER_SOL, "SOL");
    
    console.log("\n✨ Fee withdrawal completed successfully!");
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.logs) {
      console.error("\nProgram logs:");
      error.logs.forEach((log: string) => console.error("  ", log));
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

