#!/usr/bin/env ts-node
/**
 * Initialize Global Config for Bonding Curves
 * This should be run ONCE by the platform admin
 */

import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { rpc_initializeGlobalConfig } from "../frontend/src/lib/anchorClient";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Initializing Global Config for Fundly Bonding Curves\n");

  // Load your keypair (the one that deployed the program)
  const keypairPath = path.join(
    process.env.HOME || "",
    ".config/solana/id.json"
  );
  
  if (!fs.existsSync(keypairPath)) {
    console.error("❌ Keypair not found at:", keypairPath);
    console.log("Make sure you have a Solana keypair configured");
    process.exit(1);
  }

  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("👤 Admin wallet:", adminKeypair.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // Check balance
  const balance = await connection.getBalance(adminKeypair.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL\n`);

  if (balance < 0.01e9) {
    console.log("⚠️  Low balance! Get some devnet SOL:");
    console.log(`   solana airdrop 2 ${adminKeypair.publicKey.toBase58()} --url devnet\n`);
  }

  // Create wallet interface for Anchor
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

  // Default treasury address - all platform fees will be sent here automatically
  const defaultTreasury = new PublicKey("DF6KTfmnnJTCEMS8JkHhq64qwfTnrJL4UTgiFJdEwrJj");

  console.log("📝 Initializing with these parameters:");
  console.log("   Treasury:               ", defaultTreasury.toBase58());
  console.log("   Virtual SOL Reserves:   30 SOL");
  console.log("   Virtual Token Reserves: 1,000,000,000 tokens");
  console.log("   Initial Token Supply:   1,000,000,000 tokens");
  console.log("   Platform Fee:           100 bps (1%)");
  console.log("   Note: Fees will be automatically sent to treasury\n");

  try {
    const signature = await rpc_initializeGlobalConfig(
      connection,
      wallet,
      defaultTreasury, // Treasury - receives all platform fees automatically
      30,              // 30 SOL virtual reserves
      1_000_000_000,   // 1 billion virtual tokens
      1_000_000_000,   // 1 billion default initial supply
      100              // 1% fee (100 basis points)
    );

    console.log("✅ Global config initialized successfully!");
    console.log("📋 Transaction signature:", signature);
    console.log(`🔍 View on Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);
    console.log("🎉 Your platform is now ready for bonding curve trading!");
  } catch (error: any) {
    console.error("❌ Error initializing global config:");
    
    if (error.message?.includes("already in use")) {
      console.log("ℹ️  Global config already exists - you're all set!");
    } else {
      console.error(error);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

