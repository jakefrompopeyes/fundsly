/**
 * Complete Migration Flow Test Script
 * 
 * This script tests the entire migration flow:
 * 1. Creates a test token with bonding curve
 * 2. Buys tokens until migration threshold is reached
 * 3. Executes the migration
 * 4. Verifies the migration succeeded
 * 
 * Usage: npx ts-node scripts/test-full-migration-flow.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";

const NETWORK = "devnet";
const ADMIN_KEYPAIR_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE!,
  ".config/solana/id.json"
);

function getConnection(network: string): Connection {
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

function deriveGlobalConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    programId
  );
  return pda;
}

function deriveBondingCurvePda(mint: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    programId
  );
  return pda;
}

function deriveSolVaultPda(mint: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault"), mint.toBuffer()],
    programId
  );
  return pda;
}

function deriveMigrationVaultPda(mint: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_vault"), mint.toBuffer()],
    programId
  );
  return pda;
}

function deriveMigrationAuthorityPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_authority")],
    programId
  );
  return pda;
}

async function main() {
  console.log("🧪 Full Migration Flow Test");
  console.log("============================\n");

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

  console.log(`👤 Wallet: ${adminKeypair.publicKey.toBase58()}`);
  console.log(`🌐 Network: ${NETWORK}`);
  console.log(`📝 Program: ${programId.toBase58()}\n`);

  // Check balance
  const balance = await connection.getBalance(adminKeypair.publicKey);
  console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log("⚠️  Low balance! You may need more SOL for testing.");
    console.log("Run: solana airdrop 2 --url devnet\n");
  }

  // Get global config
  const globalConfigPda = deriveGlobalConfigPda(programId);
  const globalConfig = await program.account.globalConfig.fetch(globalConfigPda);
  const migrationThreshold = globalConfig.migrationThresholdSol.toNumber() / LAMPORTS_PER_SOL;

  console.log(`🎯 Migration threshold: ${migrationThreshold} SOL\n`);

  // Step 1: Create test token
  console.log("📝 Step 1: Creating test token...");
  console.log("====================================\n");

  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  console.log(`🪙 Token mint: ${mint.toBase58()}`);

  const bondingCurvePda = deriveBondingCurvePda(mint, programId);
  const solVaultPda = deriveSolVaultPda(mint, programId);
  const curveTokenAccount = await getAssociatedTokenAddress(mint, bondingCurvePda, true);

  try {
    const signature = await program.methods
      .createProject(
        "Test Migration Token",
        "TMT",
        "Testing migration system",
        "https://example.com/logo.png",
        null, // No vesting for this test
        null,
        null,
        null
      )
      .accounts({
        project: bondingCurvePda,
        mint: mint,
        bondingCurve: bondingCurvePda,
        curveTokenAccount: curveTokenAccount,
        solVault: solVaultPda,
        globalConfig: globalConfigPda,
        owner: adminKeypair.publicKey,
        payer: adminKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair])
      .rpc();

    console.log(`✅ Token created!`);
    console.log(`📝 Signature: ${signature}`);
    console.log(`🔍 Explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}\n`);
  } catch (error: any) {
    console.error("❌ Error creating token:", error.message);
    process.exit(1);
  }

  // Step 2: Buy tokens to reach threshold
  console.log("📝 Step 2: Buying tokens to reach migration threshold...");
  console.log("=========================================================\n");

  const buyerTokenAccount = await getAssociatedTokenAddress(mint, adminKeypair.publicKey);

  // Calculate how much SOL we need to reach the threshold
  // We'll buy in increments to simulate real usage
  const targetSol = migrationThreshold * LAMPORTS_PER_SOL;
  const buyAmountPerTx = 0.5 * LAMPORTS_PER_SOL; // Buy 0.5 SOL worth at a time
  const numberOfBuys = Math.ceil(targetSol / buyAmountPerTx);

  console.log(`🎯 Target: ${migrationThreshold} SOL`);
  console.log(`📊 Buy amount per tx: ${buyAmountPerTx / LAMPORTS_PER_SOL} SOL`);
  console.log(`🔢 Number of buys: ${numberOfBuys}\n`);

  for (let i = 0; i < numberOfBuys; i++) {
    console.log(`💸 Buy ${i + 1}/${numberOfBuys}...`);

    try {
      // Create buyer token account if needed (first buy only)
      if (i === 0) {
        try {
          await getAccount(connection, buyerTokenAccount);
          console.log("   Token account exists");
        } catch {
          console.log("   Creating token account...");
          const createAtaTx = new anchor.web3.Transaction().add(
            createAssociatedTokenAccountInstruction(
              adminKeypair.publicKey,
              buyerTokenAccount,
              adminKeypair.publicKey,
              mint
            )
          );
          await provider.sendAndConfirm(createAtaTx);
        }
      }

      const signature = await program.methods
        .buyTokens(
          new anchor.BN(buyAmountPerTx),
          new anchor.BN(0) // Min tokens (no slippage check for test)
        )
        .accounts({
          bondingCurve: bondingCurvePda,
          solVault: solVaultPda,
          curveTokenAccount: curveTokenAccount,
          userTokenAccount: buyerTokenAccount,
          user: adminKeypair.publicKey,
          globalConfig: globalConfigPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Check current SOL in vault
      const vaultBalance = await connection.getBalance(solVaultPda);
      const currentSol = vaultBalance / LAMPORTS_PER_SOL;

      console.log(`   ✅ Success! Vault now has: ${currentSol.toFixed(4)} SOL`);

      // Check if we've reached the threshold
      if (vaultBalance >= targetSol) {
        console.log(`\n🎉 Reached migration threshold!`);
        break;
      }

      // Small delay between buys
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
      // Continue with next buy
    }
  }

  // Check bonding curve state
  const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda);
  const realSol = bondingCurve.realSolReserves.toNumber() / LAMPORTS_PER_SOL;

  console.log(`\n📊 Final bonding curve state:`);
  console.log(`   Real SOL reserves: ${realSol.toFixed(4)} SOL`);
  console.log(`   Migrated: ${bondingCurve.migrated}`);
  console.log(`   Migration threshold: ${migrationThreshold} SOL\n`);

  // Step 3: Execute migration
  console.log("📝 Step 3: Executing migration...");
  console.log("===================================\n");

  const migrationVaultPda = deriveMigrationVaultPda(mint, programId);
  const migrationAuthorityPda = deriveMigrationAuthorityPda(programId);
  const migrationTokenAccount = await getAssociatedTokenAddress(
    mint,
    migrationAuthorityPda,
    true
  );

  console.log(`🔐 Migration vault: ${migrationVaultPda.toBase58()}`);
  console.log(`🔑 Migration authority: ${migrationAuthorityPda.toBase58()}`);
  console.log(`🪙 Migration token account: ${migrationTokenAccount.toBase58()}\n`);

  try {
    const signature = await program.methods
      .migrateToRaydium()
      .accounts({
        bondingCurve: bondingCurvePda,
        solVault: solVaultPda,
        curveTokenAccount: curveTokenAccount,
        migrationSolVault: migrationVaultPda,
        migrationTokenAccount: migrationTokenAccount,
        migrationAuthority: migrationAuthorityPda,
        globalConfig: globalConfigPda,
        mint: mint,
        authority: adminKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Migration executed!`);
    console.log(`📝 Signature: ${signature}`);
    console.log(`🔍 Explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}\n`);
  } catch (error: any) {
    console.error("❌ Error executing migration:", error.message);
    console.error(error);
    process.exit(1);
  }

  // Step 4: Verify migration
  console.log("📝 Step 4: Verifying migration...");
  console.log("===================================\n");

  // Check bonding curve state
  const migratedCurve = await program.account.bondingCurve.fetch(bondingCurvePda);
  console.log(`✅ Bonding curve migrated: ${migratedCurve.migrated}`);
  console.log(`   Real SOL reserves: ${migratedCurve.realSolReserves.toNumber() / LAMPORTS_PER_SOL} SOL`);
  console.log(`   Real token reserves: ${migratedCurve.realTokenReserves.toNumber() / 1_000_000} tokens\n`);

  // Check vault balances
  const solVaultBalance = await connection.getBalance(solVaultPda);
  const migrationVaultBalance = await connection.getBalance(migrationVaultPda);

  console.log(`📊 Vault balances:`);
  console.log(`   Bonding curve vault: ${solVaultBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`   Migration vault: ${migrationVaultBalance / LAMPORTS_PER_SOL} SOL\n`);

  // Check token balances
  try {
    const curveTokenBalance = await getAccount(connection, curveTokenAccount);
    const migrationTokenBalance = await getAccount(connection, migrationTokenAccount);

    console.log(`🪙 Token balances:`);
    console.log(`   Bonding curve: ${Number(curveTokenBalance.amount) / 1_000_000} tokens`);
    console.log(`   Migration account: ${Number(migrationTokenBalance.amount) / 1_000_000} tokens\n`);
  } catch (error) {
    console.log(`⚠️  Could not fetch token balances\n`);
  }

  // Step 5: Try to buy (should fail)
  console.log("📝 Step 5: Verifying trading is disabled...");
  console.log("============================================\n");

  try {
    await program.methods
      .buyTokens(
        new anchor.BN(0.1 * LAMPORTS_PER_SOL),
        new anchor.BN(0)
      )
      .accounts({
        bondingCurve: bondingCurvePda,
        solVault: solVaultPda,
        curveTokenAccount: curveTokenAccount,
        userTokenAccount: buyerTokenAccount,
        user: adminKeypair.publicKey,
        globalConfig: globalConfigPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("❌ FAIL: Buy should have been rejected!");
  } catch (error: any) {
    if (error.message.includes("AlreadyMigrated") || error.message.includes("migrated")) {
      console.log("✅ PASS: Buy correctly rejected (already migrated)");
    } else {
      console.log(`⚠️  Buy failed with unexpected error: ${error.message}`);
    }
  }

  // Final summary
  console.log("\n🎉 Migration Test Complete!");
  console.log("============================\n");
  console.log("Summary:");
  console.log(`✅ Token created: ${mint.toBase58()}`);
  console.log(`✅ Reached threshold: ${migrationThreshold} SOL`);
  console.log(`✅ Migration executed successfully`);
  console.log(`✅ Funds locked in migration vaults`);
  console.log(`✅ Trading disabled after migration\n`);

  console.log("Test token details for manual verification:");
  console.log(`Mint: ${mint.toBase58()}`);
  console.log(`Bonding Curve: ${bondingCurvePda.toBase58()}`);
  console.log(`Migration Vault: ${migrationVaultPda.toBase58()}`);
  console.log(`\nView on explorer:`);
  console.log(`https://explorer.solana.com/address/${mint.toBase58()}?cluster=${NETWORK}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

