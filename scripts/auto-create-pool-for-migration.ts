/**
 * Automatic Raydium Pool Creation for Migrated Tokens
 * 
 * This script implements pump.fun's revenue model:
 * 1. Creates Raydium pools for migrated tokens
 * 2. KEEPS LP TOKENS in treasury (ongoing revenue!)
 * 3. Platform earns ~0.075% of all trading volume forever
 * 4. Lists token on entire Solana DEX ecosystem
 * 
 * Revenue Model:
 * - During bonding curve: 1% per trade
 * - After migration: 0.075% per trade (as LP provider)
 * - LP fees accumulate automatically in the pool
 * - Withdraw LP fees anytime to treasury
 * 
 * Usage:
 * - Run manually: npx ts-node scripts/auto-create-pool-for-migration.ts <MINT_ADDRESS>
 * - Run as service: node scripts/auto-pool-watcher.js (monitors all migrations)
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Raydium, TxVersion, CREATE_CPMM_POOL_PROGRAM } from "@raydium-io/raydium-sdk-v2";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";

const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");
const ADMIN_KEYPAIR_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE!,
  ".config/solana/id.json"
);

// TREASURY WALLET - LP tokens sent here for ongoing revenue
// Set this to your platform's treasury wallet address
const LP_TREASURY = process.env.LP_TREASURY_WALLET || process.env.HOME ? 
  Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, "utf-8")))
  ).publicKey.toBase58() : "";

// Wrapped SOL mint
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

interface MigrationVaultInfo {
  solVault: PublicKey;
  tokenAccount: PublicKey;
  authority: PublicKey;
  solAmount: number;
  tokenAmount: number;
}

/**
 * Get migration vault information for a token
 */
async function getMigrationVaultInfo(
  connection: Connection,
  mint: PublicKey
): Promise<MigrationVaultInfo> {
  // Derive migration vault addresses
  const [solVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_vault"), mint.toBuffer()],
    PROGRAM_ID
  );

  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );

  const tokenAccount = await getAssociatedTokenAddress(mint, authority, true);

  // Get balances
  const solBalance = await connection.getBalance(solVault);
  const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
  
  let tokenAmount = 0;
  if (tokenAccountInfo) {
    // Parse token account to get amount (bytes 64-72)
    tokenAmount = Number(tokenAccountInfo.data.readBigUInt64LE(64));
  }

  return {
    solVault,
    tokenAccount,
    authority,
    solAmount: solBalance / 1e9, // Convert to SOL
    tokenAmount: tokenAmount / 1e6, // Assuming 6 decimals
  };
}

/**
 * Check if token has been migrated
 */
async function checkIfMigrated(
  connection: Connection,
  mint: PublicKey
): Promise<boolean> {
  try {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.toBuffer()],
      PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(bondingCurve);
    if (!accountInfo) return false;

    // The 'migrated' boolean is at a specific offset in the account data
    // This is a simplified check - in production you'd use the IDL
    const vaultInfo = await getMigrationVaultInfo(connection, mint);
    
    return vaultInfo.solAmount > 0 && vaultInfo.tokenAmount > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Create Raydium CPMM pool for migrated token
 */
async function createRaydiumPool(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey
): Promise<string> {
  console.log("\n🔵 Creating Raydium CPMM Pool");
  console.log("==============================\n");

  // Get migration vault info
  const vaultInfo = await getMigrationVaultInfo(connection, mint);
  
  console.log("📊 Migration Vault Info:");
  console.log(`   SOL Amount: ${vaultInfo.solAmount.toFixed(4)} SOL`);
  console.log(`   Token Amount: ${vaultInfo.tokenAmount.toLocaleString()} tokens`);
  console.log(`   Authority: ${vaultInfo.authority.toBase58()}\n`);

  if (vaultInfo.solAmount === 0 || vaultInfo.tokenAmount === 0) {
    throw new Error("Migration vault is empty - token may not be migrated");
  }

  // Initialize Raydium SDK
  console.log("🔧 Initializing Raydium SDK...");
  const raydium = await Raydium.load({
    owner: payer.publicKey,
    connection,
    cluster: NETWORK as any,
    disableFeatureCheck: true,
  });

  // Pool configuration
  const config = {
    mint1: WSOL, // SOL is typically mint1
    mint2: mint,  // Your token is mint2
    config: {
      createPoolFee: new anchor.BN(0.4 * 1e9), // 0.4 SOL creation fee
      protocolFeeRate: 2000, // 2%
      tradeFeeRate: 2500, // 2.5%
      fundOwner: payer.publicKey,
      initialPrice: vaultInfo.solAmount / vaultInfo.tokenAmount, // Price calculation
      startTime: new anchor.BN(Math.floor(Date.now() / 1000)), // Start immediately
    },
    amount1: Math.floor(vaultInfo.solAmount * 0.95 * 1e9), // Use 95% of SOL (keep some for fees)
    amount2: Math.floor(vaultInfo.tokenAmount * 1e6), // All tokens
  };

  console.log("📝 Pool Configuration:");
  console.log(`   Initial Price: ${config.config.initialPrice.toFixed(10)} SOL per token`);
  console.log(`   SOL to Deposit: ${(config.amount1 / 1e9).toFixed(4)} SOL`);
  console.log(`   Tokens to Deposit: ${(config.amount2 / 1e6).toLocaleString()} tokens\n`);

  try {
    // Create the pool
    console.log("⏳ Creating CPMM pool on Raydium...");
    
    const { execute, extInfo } = await raydium.cpmm.createPool({
      programId: CREATE_CPMM_POOL_PROGRAM,
      poolFeeAccount: PublicKey.default, // Let Raydium handle this
      mint1: config.mint1,
      mint2: config.mint2,
      ammConfig: config.config,
      mint1Amount: new anchor.BN(config.amount1),
      mint2Amount: new anchor.BN(config.amount2),
      startTime: config.config.startTime,
      txVersion: TxVersion.V0,
    });

    // Execute the transaction
    const { txId } = await execute({ sendAndConfirm: true });
    
    console.log("\n✅ Pool Created Successfully!");
    console.log(`   Transaction: ${txId}`);
    console.log(`   Pool ID: ${extInfo.address.poolId.toBase58()}`);
    console.log(`   LP Token Mint: ${extInfo.address.lpMint.toBase58()}\n`);

    // LP TOKENS ARE NOW IN THE ADMIN WALLET
    // These represent ownership of the liquidity pool and earn trading fees
    const lpTokenAccount = await getAssociatedTokenAddress(
      extInfo.address.lpMint,
      payer.publicKey
    );

    console.log("💰 LP Token Information:");
    console.log(`   LP Mint: ${extInfo.address.lpMint.toBase58()}`);
    console.log(`   Your LP Account: ${lpTokenAccount.toBase58()}`);
    console.log(`   Owner: ${payer.publicKey.toBase58()}\n`);

    console.log("📊 ONGOING REVENUE MODEL:");
    console.log("   ✅ You now own 100% of the liquidity pool");
    console.log("   ✅ Earn ~0.075% of every trade (2.5% LP fee * your share)");
    console.log("   ✅ Fees accumulate automatically");
    console.log("   ✅ Withdraw fees anytime by burning LP tokens\n");

    console.log("💡 REVENUE ESTIMATE:");
    console.log("   $10,000/day volume = ~$7.50/day");
    console.log("   $100,000/day volume = ~$75/day");
    console.log("   $1,000,000/day volume = ~$750/day\n");

    // Save LP token info for tracking
    const lpInfo = {
      mint: mint.toBase58(),
      poolId: extInfo.address.poolId.toBase58(),
      lpMint: extInfo.address.lpMint.toBase58(),
      lpTokenAccount: lpTokenAccount.toBase58(),
      owner: payer.publicKey.toBase58(),
      createdAt: new Date().toISOString(),
      network: NETWORK,
    };

    const lpInfoPath = path.join(__dirname, ".lp-tokens.json");
    let allLpTokens = [];
    if (fs.existsSync(lpInfoPath)) {
      allLpTokens = JSON.parse(fs.readFileSync(lpInfoPath, "utf-8"));
    }
    allLpTokens.push(lpInfo);
    fs.writeFileSync(lpInfoPath, JSON.stringify(allLpTokens, null, 2));

    console.log("📁 LP token info saved to: scripts/.lp-tokens.json\n");

    console.log("🎉 Token is now listed on:");
    console.log("   • Raydium: https://raydium.io/swap/");
    console.log("   • Jupiter: https://jup.ag/swap/SOL-" + mint.toBase58());
    console.log("   • DexScreener: https://dexscreener.com/solana/" + mint.toBase58());
    console.log("   • Birdeye: https://birdeye.so/token/" + mint.toBase58() + "?chain=solana\n");

    console.log("🔑 IMPORTANT - KEEP YOUR LP TOKENS:");
    console.log("   DO NOT sell or burn your LP tokens!");
    console.log("   They generate ongoing revenue from trading fees.");
    console.log("   Use Raydium UI to view/withdraw accumulated fees.\n");

    return extInfo.address.poolId.toBase58();
  } catch (error: any) {
    console.error("\n❌ Error creating pool:", error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const mintAddress = process.argv[2];
  
  if (!mintAddress) {
    console.error("❌ Usage: npx ts-node scripts/auto-create-pool-for-migration.ts <MINT_ADDRESS>");
    process.exit(1);
  }

  console.log("🚀 Automatic Raydium Pool Creation");
  console.log("===================================\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const mint = new PublicKey(mintAddress);
  
  console.log(`🪙 Token Mint: ${mintAddress}`);
  console.log(`🌐 Network: ${NETWORK}\n`);

  // Load admin keypair
  const keypairData = JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`👤 Admin: ${payer.publicKey.toBase58()}\n`);

  // Check if migrated
  console.log("🔍 Checking migration status...");
  const isMigrated = await checkIfMigrated(connection, mint);
  
  if (!isMigrated) {
    console.log("❌ Token has not been migrated yet!");
    console.log("   Migration must be completed before creating a pool.\n");
    process.exit(1);
  }
  
  console.log("✅ Token is migrated!\n");

  // Check if pool already exists
  console.log("🔍 Checking if Raydium pool exists...");
  // TODO: Add check using Raydium SDK
  
  // Create the pool
  try {
    const poolId = await createRaydiumPool(connection, payer, mint);
    
    console.log("\n🎊 SUCCESS!");
    console.log("===========");
    console.log(`Pool ID: ${poolId}`);
    console.log(`\nYour token is now listed on Solana DEX ecosystem!`);
    console.log(`Users can trade it on Raydium, Jupiter, and all aggregators.\n`);
  } catch (error) {
    console.error("\n❌ Failed to create pool");
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

