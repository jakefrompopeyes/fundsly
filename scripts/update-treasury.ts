#!/usr/bin/env ts-node
/**
 * Update Treasury Address in Global Config
 * Use this to change where platform fees are sent
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import idlJson from "../frontend/src/idl/fundly.json";

async function main() {
  console.log("🔄 Updating Treasury Address in Global Config\n");

  // Load admin keypair (must be the authority that initialized global config)
  const keypairPath = path.join(
    process.env.HOME || "",
    ".config/solana/id.json"
  );
  
  if (!fs.existsSync(keypairPath)) {
    console.error("❌ Admin keypair not found at:", keypairPath);
    process.exit(1);
  }

  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("👤 Admin wallet:", adminKeypair.publicKey.toBase58());

  // Connect to devnet (change to mainnet if needed)
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // Check balance
  const balance = await connection.getBalance(adminKeypair.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL\n`);

  // Set up Anchor
  const wallet = {
    publicKey: adminKeypair.publicKey,
    signTransaction: async (tx: any) => {
      tx.sign([adminKeypair]);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      txs.forEach((tx) => tx.sign([adminKeypair]));
      return txs;
    },
  } as any;

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const programId = new PublicKey(idlJson.address);
  const program = new Program(idlJson as any, programId, provider);

  // Find global config PDA
  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    programId
  );

  // Fetch current config
  try {
    const currentConfig = await program.account.globalConfig.fetch(globalConfigPda);
    console.log("📋 Current Configuration:");
    console.log("   Authority:", currentConfig.authority.toBase58());
    console.log("   Current Treasury:", currentConfig.treasury.toBase58());
    console.log("");
  } catch (error) {
    console.error("❌ Could not fetch global config. Has it been initialized?");
    process.exit(1);
  }

  // IMPORTANT: Replace this with YOUR new treasury address
  // You can:
  // 1. Generate a new wallet: solana-keygen new --outfile ~/.config/solana/treasury-keypair.json
  // 2. Use your existing wallet address
  // 3. Use a hardware wallet address (recommended for mainnet)
  
  const newTreasuryAddress = process.argv[2];
  
  if (!newTreasuryAddress) {
    console.log("❌ Please provide a new treasury address:");
    console.log("\nUsage:");
    console.log("   ts-node scripts/update-treasury.ts <NEW_TREASURY_ADDRESS>");
    console.log("\nExample:");
    console.log("   ts-node scripts/update-treasury.ts YOUR_WALLET_ADDRESS_HERE");
    console.log("\nTo generate a new treasury wallet:");
    console.log("   solana-keygen new --outfile ~/.config/solana/treasury-keypair.json");
    console.log("   solana-keygen pubkey ~/.config/solana/treasury-keypair.json\n");
    process.exit(1);
  }

  let newTreasury: PublicKey;
  try {
    newTreasury = new PublicKey(newTreasuryAddress);
  } catch {
    console.error("❌ Invalid treasury address format");
    process.exit(1);
  }

  console.log("🎯 New Treasury Address:", newTreasury.toBase58());
  console.log("\n⚠️  WARNING: All future platform fees will be sent to this address!");
  console.log("   Make sure you control this wallet!\n");

  // Update global config
  try {
    const signature = await program.methods
      .updateGlobalConfig(
        newTreasury,  // new treasury
        null,         // keep virtual_sol_reserves
        null,         // keep virtual_token_reserves
        null,         // keep initial_token_supply
        null,         // keep fee_basis_points
        null,         // keep migration_threshold_sol
        null          // keep raydium_amm_program
      )
      .accounts({
        globalConfig: globalConfigPda,
        authority: adminKeypair.publicKey,
      })
      .rpc();

    console.log("✅ Treasury updated successfully!");
    console.log("📋 Transaction signature:", signature);
    console.log(`🔍 View on Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);
    
    // Verify the update
    const updatedConfig = await program.account.globalConfig.fetch(globalConfigPda);
    console.log("✅ Verified - New Treasury:", updatedConfig.treasury.toBase58());
    console.log("\n🎉 All future platform fees will now go to this address!");
    
  } catch (error: any) {
    console.error("❌ Error updating treasury:");
    console.error(error);
    
    if (error.message?.includes("Unauthorized")) {
      console.log("\n⚠️  You must be the global config authority to change the treasury!");
    }
    
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

