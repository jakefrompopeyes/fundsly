/**
 * Automatic Raydium Pool Creation Service
 * 
 * This service monitors for token migrations and automatically creates
 * Raydium CPMM pools when migrations are detected.
 * 
 * Usage: node backend/raydium-pool-service.js
 * 
 * Keep running 24/7 as a background service (PM2, systemd, etc.)
 */

const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } = require("@solana/spl-token");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");

// Configuration
const NETWORK = process.env.SOLANA_NETWORK || "devnet";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");
const ADMIN_KEYPAIR_PATH = process.env.ADMIN_KEYPAIR_PATH || path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config/solana/id.json"
);

// Raydium CPMM Program (Devnet)
const RAYDIUM_CPMM_PROGRAM = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");

// Wrapped SOL
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

// Associated Token Program
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// Storage for processed migrations
const PROCESSED_FILE = path.join(__dirname, ".processed-migrations.json");
let processedMigrations = new Set();

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, retryDelay = RETRY_DELAY) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`   ⏳ Attempt ${attempt} failed, retrying in ${delay / 1000}s...`);
      console.log(`   Error: ${error.message}\n`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Load processed migrations
function loadProcessed() {
  try {
    if (fs.existsSync(PROCESSED_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8"));
      processedMigrations = new Set(data);
      console.log(`📋 Loaded ${processedMigrations.size} previously processed migrations`);
    }
  } catch (error) {
    console.log("⚠️  Could not load processed migrations file");
  }
}

// Save processed migrations
function saveProcessed() {
  try {
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify([...processedMigrations], null, 2));
  } catch (error) {
    console.error("❌ Error saving processed migrations:", error.message);
  }
}

/**
 * Get bonding curve data
 */
async function getBondingCurveData(connection, program, mint) {
  try {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.toBuffer()],
      PROGRAM_ID
    );

    const bondingCurveData = await program.account.bondingCurve.fetch(bondingCurve);
    return bondingCurveData;
  } catch (error) {
    return null;
  }
}

/**
 * Automatically trigger migration when threshold is reached
 */
async function autoMigrateIfReady(connection, program, payer, mint) {
  console.log("\n🔍 Checking if migration needed...");
  
  try {
    const bondingCurveData = await getBondingCurveData(connection, program, mint);
    
    if (!bondingCurveData) {
      console.log("   No bonding curve found\n");
      return { skipped: true, reason: "No bonding curve" };
    }

    if (bondingCurveData.migrated) {
      console.log("   Already migrated\n");
      return { skipped: true, reason: "Already migrated" };
    }

    // Get global config to check threshold
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      PROGRAM_ID
    );
    const globalConfigData = await program.account.globalConfig.fetch(globalConfig);
    const threshold = globalConfigData.migrationThresholdSol;

    const realSol = bondingCurveData.realSolReserves.toNumber();
    const thresholdSol = threshold.toNumber();

    console.log(`   Real SOL: ${(realSol / 1e9).toFixed(4)} SOL`);
    console.log(`   Threshold: ${(thresholdSol / 1e9).toFixed(4)} SOL`);

    if (realSol < thresholdSol) {
      console.log("   Threshold not reached yet\n");
      return { skipped: true, reason: "Threshold not reached" };
    }

    console.log("\n🚀 THRESHOLD REACHED! Triggering automatic migration...\n");

    // Get all accounts needed for migration
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.toBuffer()],
      PROGRAM_ID
    );

    const [bondingCurveSolVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve_sol_vault"), mint.toBuffer()],
      PROGRAM_ID
    );

    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      mint,
      bondingCurve,
      true
    );

    const [migrationSolVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("migration_vault"), mint.toBuffer()],
      PROGRAM_ID
    );

    const [migrationAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("migration_authority")],
      PROGRAM_ID
    );

    const migrationTokenAccount = await getAssociatedTokenAddress(
      mint,
      migrationAuthority,
      true
    );

    const [treasury] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      PROGRAM_ID
    );

    console.log("📝 Calling migrate_to_raydium instruction...");

    const tx = await program.methods
      .migrateToRaydium()
      .accounts({
        bondingCurve,
        mint,
        bondingCurveSolVault,
        bondingCurveTokenAccount,
        migrationSolVault,
        migrationTokenAccount,
        migrationAuthority,
        globalConfig,
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: anchor.web3.ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();

    console.log("\n✅ Automatic migration successful!");
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

    return {
      success: true,
      tx,
      message: "Automatic migration triggered"
    };

  } catch (error) {
    console.error("❌ Auto-migration error:", error.message);
    if (error.logs) {
      console.error("Program logs:", error.logs);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get migration vault information
 */
async function getMigrationVaultInfo(connection, mint) {
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
    tokenAmount = Number(tokenAccountInfo.data.readBigUInt64LE(64));
  }

  return {
    solVault,
    tokenAccount,
    authority,
    solAmount: solBalance,
    tokenAmount: tokenAmount,
  };
}

/**
 * Check if a Raydium pool exists for this token
 */
async function checkPoolExists(connection, mint) {
  try {
    // Simple check: see if there's a pool account
    // In production, query Raydium's pool program
    // For now, return false to always try creating
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Withdraw funds from migration vaults to payer wallet
 * Uses the smart contract's withdraw_migration_funds instruction
 */
async function withdrawFromMigrationVaults(connection, program, payer, mint, vaultInfo) {
  console.log("💸 Withdrawing from migration vaults...\n");

  try {
    const solAmount = vaultInfo.solAmount;
    const tokenAmount = vaultInfo.tokenAmount;

    console.log(`   SOL to withdraw: ${(solAmount / 1e9).toFixed(4)} SOL`);
    console.log(`   Tokens to withdraw: ${(tokenAmount / 1e6).toLocaleString()} tokens\n`);

    // Get global config PDA
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      PROGRAM_ID
    );

    // Get bonding curve PDA
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.toBuffer()],
      PROGRAM_ID
    );

    // Create recipient token account if needed
    const recipientTokenAccount = await getAssociatedTokenAddress(
      mint,
      payer.publicKey,
      false
    );

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

    console.log("📝 Calling withdraw_migration_funds instruction...");

    // Call the withdraw instruction
    const tx = await program.methods
      .withdrawMigrationFunds(
        new anchor.BN(solAmount),
        new anchor.BN(tokenAmount)
      )
      .accounts({
        bondingCurve,
        mint,
        migrationSolVault: vaultInfo.solVault,
        migrationTokenAccount: vaultInfo.tokenAccount,
        migrationAuthority: vaultInfo.authority,
        globalConfig,
        authority: payer.publicKey,
        recipient: payer.publicKey,
        recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Withdrawal successful!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

    // Verify balances
    const newBalance = await connection.getBalance(payer.publicKey);
    console.log(`   Backend wallet balance: ${(newBalance / 1e9).toFixed(4)} SOL\n`);
    
    return {
      success: true,
      tx,
      solAmount,
      tokenAmount,
    };

  } catch (error) {
    console.error("❌ Withdrawal error:", error.message);
    if (error.logs) {
      console.error("Program logs:", error.logs);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Create Raydium CPMM pool with backend wallet
 * This uses the backend wallet's funds (after withdrawing from migration vaults)
 */
async function createRaydiumPool(connection, payer, mint, solAmount, tokenAmount) {
  console.log("\n🔵 Creating Raydium Pool");
  console.log("========================\n");

  console.log(`💰 Pool Liquidity:`);
  console.log(`   SOL: ${(solAmount / 1e9).toFixed(4)} SOL`);
  console.log(`   Tokens: ${(tokenAmount / 1e6).toLocaleString()} tokens`);
  console.log(`   Price: ${((solAmount / 1e9) / (tokenAmount / 1e6)).toFixed(10)} SOL/token\n`);

  try {
    // Import Raydium SDK dynamically
    const { Raydium, CREATE_CPMM_POOL_PROGRAM, DEVNET_PROGRAM_ID } = require("@raydium-io/raydium-sdk-v2");
    
    console.log("🔧 Initializing Raydium SDK...");
    
    const raydium = await Raydium.load({
      owner: payer.publicKey,
      connection,
      cluster: NETWORK === "mainnet-beta" ? "mainnet" : "devnet",
      disableFeatureCheck: true,
    });

    console.log("✅ Raydium SDK initialized\n");

    // Create the pool
    console.log("🏊 Creating CPMM pool...");
    
    const { execute, extInfo } = await raydium.cpmm.createPool({
      programId: CREATE_CPMM_POOL_PROGRAM,
      poolFeeAccount: PublicKey.default,
      mint1: WSOL, // SOL
      mint2: mint,  // Your token
      ammConfig: {
        id: PublicKey.default, // Let Raydium handle this
        index: 0,
        protocolFeeRate: 2000, // 2%
        tradeFeeRate: 2500, // 0.25%
        fundOwner: payer.publicKey,
        fundFeeRate: 0,
      },
      mint1Amount: new anchor.BN(Math.floor(solAmount * 0.95)), // Use 95% (keep some for fees)
      mint2Amount: new anchor.BN(tokenAmount),
      startTime: new anchor.BN(Math.floor(Date.now() / 1000)),
      txVersion: 0,
    });

    console.log("📝 Signing and sending transaction...");

    // Execute the transaction
    const { txId } = await execute({ sendAndConfirm: true });

    console.log("\n✅ Pool Created Successfully!");
    console.log(`   Transaction: ${txId}`);
    console.log(`   Pool ID: ${extInfo.address.poolId.toBase58()}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${txId}?cluster=${NETWORK}\n`);

    // Get LP mint from pool info
    const lpMint = extInfo.address.lpMint;
    console.log(`   LP Mint: ${lpMint.toBase58()}`);

    console.log("🎉 Token is now listed on:");
    console.log("   • Raydium");
    console.log("   • Jupiter (auto-indexed)");
    console.log("   • DexScreener (auto-discovered)");
    console.log("   • Your platform UI (automatic!)\n");

    return {
      success: true,
      poolId: extInfo.address.poolId.toBase58(),
      lpMint: lpMint.toBase58(),
      txId,
    };

  } catch (error) {
    console.error("❌ Pool creation error:", error.message);
    
    if (error.message.includes("Cannot find module")) {
      console.log("\n⚠️  Raydium SDK not properly installed");
      console.log("   Run: npm install @raydium-io/raydium-sdk-v2\n");
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Burn LP tokens to permanently lock liquidity
 */
async function burnLpTokens(connection, program, payer, mint, lpMint, poolId) {
  console.log("\n🔥 Burning LP Tokens (Permanent Lock)");
  console.log("======================================\n");

  try {
    // Get migration authority PDA
    const [migrationAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("migration_authority")],
      PROGRAM_ID
    );

    // Get LP token account for migration authority
    const lpTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(lpMint),
      migrationAuthority,
      true
    );

    // Get LP token balance
    const lpAccountInfo = await connection.getTokenAccountBalance(lpTokenAccount);
    const lpBalance = lpAccountInfo.value.amount;

    if (lpBalance === "0") {
      console.log("⚠️  No LP tokens to burn\n");
      return {
        success: false,
        error: "No LP tokens in migration authority account",
      };
    }

    console.log(`   LP tokens to burn: ${lpBalance}`);
    console.log(`   This will PERMANENTLY lock liquidity!\n`);

    // Get bonding curve PDA
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.toBuffer()],
      PROGRAM_ID
    );

    // Get global config PDA
    const [globalConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      PROGRAM_ID
    );

    // Get LP burn info PDA
    const [lpBurnInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_burn_info"), mint.toBuffer()],
      PROGRAM_ID
    );

    console.log("📝 Calling burn_raydium_lp_tokens instruction...");

    // Call the burn instruction
    const tx = await program.methods
      .burnRaydiumLpTokens(new anchor.BN(lpBalance))
      .accounts({
        bondingCurve,
        mint,
        lpBurnInfo,
        lpMint: new PublicKey(lpMint),
        raydiumPool: new PublicKey(poolId),
        lpTokenAccount,
        migrationAuthority,
        globalConfig,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ LP tokens burned successfully!");
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

    console.log("🔒 LIQUIDITY PERMANENTLY LOCKED!");
    console.log("   • Cannot remove liquidity");
    console.log("   • Cannot rug pull");
    console.log("   • Token holders protected forever\n");

    return {
      success: true,
      tx,
      lpAmount: lpBalance,
    };

  } catch (error) {
    console.error("❌ LP burning error:", error.message);
    if (error.logs) {
      console.error("Program logs:", error.logs);
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Complete flow: Withdraw from vaults and create pool
 */
async function createPoolFromMigration(connection, program, payer, mint, vaultInfo) {
  console.log("\n🚀 Starting Automatic Pool Creation");
  console.log("====================================\n");

  // Step 1: Withdraw funds from migration vaults to backend wallet
  console.log("Step 1: Withdrawing funds from migration vaults...\n");
  
  let withdrawResult;
  try {
    withdrawResult = await retryWithBackoff(async () => {
      return await withdrawFromMigrationVaults(
        connection,
        program,
        payer,
        mint,
        vaultInfo
      );
    });
  } catch (error) {
    return {
      success: false,
      error: `Withdrawal failed after ${MAX_RETRIES} attempts: ${error.message}`,
    };
  }

  if (!withdrawResult.success) {
    return {
      success: false,
      error: `Withdrawal failed: ${withdrawResult.error}`,
    };
  }

  console.log("✅ Step 1 complete: Funds withdrawn to backend wallet\n");

  // Step 2: Create Raydium pool with the withdrawn funds
  console.log("Step 2: Creating Raydium pool...\n");

  let poolResult;
  try {
    poolResult = await retryWithBackoff(async () => {
      return await createRaydiumPool(
        connection,
        payer,
        mint,
        withdrawResult.solAmount,
        withdrawResult.tokenAmount
      );
    });
  } catch (error) {
    console.log("❌ Pool creation failed after retries, but funds are now in backend wallet");
    console.log("   You can manually create the pool with these funds\n");
    return {
      success: false,
      error: `Pool creation failed after ${MAX_RETRIES} attempts: ${error.message}`,
      fundsWithdrawn: true,
      solAmount: withdrawResult.solAmount,
      tokenAmount: withdrawResult.tokenAmount,
    };
  }

  if (!poolResult.success) {
    console.log("❌ Pool creation failed, but funds are now in backend wallet");
    console.log("   You can manually create the pool with these funds\n");
    return {
      success: false,
      error: `Pool creation failed: ${poolResult.error}`,
      fundsWithdrawn: true,
      solAmount: withdrawResult.solAmount,
      tokenAmount: withdrawResult.tokenAmount,
    };
  }

  console.log("✅ Step 2 complete: Pool created successfully!\n");

  // Step 3: Burn LP tokens to permanently lock liquidity
  console.log("Step 3: Burning LP tokens (permanent lock)...\n");

  // Wait a few seconds for LP tokens to be credited
  console.log("   Waiting 5 seconds for LP tokens to be credited...\n");
  await new Promise(resolve => setTimeout(resolve, 5000));

  let burnResult;
  try {
    burnResult = await retryWithBackoff(async () => {
      return await burnLpTokens(
        connection,
        program,
        payer,
        mint,
        poolResult.lpMint,
        poolResult.poolId
      );
    });
  } catch (error) {
    console.log("⚠️  LP burning failed after retries");
    console.log("   Pool is created but liquidity is NOT locked");
    console.log("   You can manually burn LP tokens later\n");
    return {
      success: true,
      poolId: poolResult.poolId,
      lpMint: poolResult.lpMint,
      txId: poolResult.txId,
      withdrawalTx: withdrawResult.tx,
      lpBurned: false,
      warning: `LP burning failed: ${error.message}`,
    };
  }

  if (!burnResult.success) {
    console.log("⚠️  LP burning failed");
    console.log("   Pool is created but liquidity is NOT locked");
    console.log("   You can manually burn LP tokens later\n");
    return {
      success: true,
      poolId: poolResult.poolId,
      lpMint: poolResult.lpMint,
      txId: poolResult.txId,
      withdrawalTx: withdrawResult.tx,
      lpBurned: false,
      warning: burnResult.error,
    };
  }

  console.log("✅ Step 3 complete: LP tokens burned!\n");
  console.log("=" .repeat(60));
  console.log("🎉 FULLY AUTOMATIC POOL CREATION COMPLETE!");
  console.log("=" .repeat(60));
  console.log(`\n✅ Token: ${mint.toBase58()}`);
  console.log(`✅ Pool: ${poolResult.poolId}`);
  console.log(`✅ Pool Creation TX: ${poolResult.txId}`);
  console.log(`✅ LP Burn TX: ${burnResult.tx}`);
  console.log(`✅ LP Amount Burned: ${burnResult.lpAmount}`);
  console.log(`\n🔒 LIQUIDITY PERMANENTLY LOCKED!`);
  console.log(`   • Cannot remove liquidity`);
  console.log(`   • Cannot rug pull`);
  console.log(`   • Token holders protected forever`);
  console.log(`\n🌐 Your token is now trading on:`);
  console.log(`   • Raydium DEX`);
  console.log(`   • Jupiter Aggregator (auto-indexed)`);
  console.log(`   • DexScreener (auto-discovered)`);
  console.log(`   • Your platform UI (automatic!)\n`);

  return {
    success: true,
    poolId: poolResult.poolId,
    lpMint: poolResult.lpMint,
    txId: poolResult.txId,
    withdrawalTx: withdrawResult.tx,
    lpBurned: true,
    lpBurnTx: burnResult.tx,
    lpAmountBurned: burnResult.lpAmount,
  };
}

/**
 * Process a token - auto-migrate if needed, then create pool
 */
async function processMigration(connection, program, payer, mint) {
  const mintStr = mint.toBase58();

  // Check if already processed
  if (processedMigrations.has(mintStr)) {
    return { skipped: true, reason: "Already processed" };
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Processing Token: ${mintStr}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    // STEP 0: Check if migration needed and trigger automatically
    const migrationResult = await autoMigrateIfReady(connection, program, payer, mint);
    
    if (migrationResult.success) {
      console.log("✅ Automatic migration completed!");
      console.log("   Waiting 5 seconds for migration to finalize...\n");
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else if (!migrationResult.skipped || migrationResult.reason !== "Already migrated") {
      // If it's not already migrated and there's an issue, skip this token
      if (migrationResult.reason === "Threshold not reached") {
        return { skipped: true, reason: "Threshold not reached yet" };
      }
      return migrationResult;
    }

    // Get migration vault info
    const vaultInfo = await getMigrationVaultInfo(connection, mint);

    // Check if actually migrated (has funds in vault)
    if (vaultInfo.solAmount === 0 || vaultInfo.tokenAmount === 0) {
      console.log("⏭️  Skipping - no funds in migration vault\n");
      return { skipped: true, reason: "No funds in vault" };
    }

    console.log("✅ Migration vault has funds!");
    console.log(`   SOL: ${(vaultInfo.solAmount / 1e9).toFixed(4)} SOL`);
    console.log(`   Tokens: ${(vaultInfo.tokenAmount / 1e6).toLocaleString()} tokens\n`);

    // Check if pool already exists
    const poolExists = await checkPoolExists(connection, mint);
    if (poolExists) {
      console.log("⏭️  Pool already exists for this token\n");
      processedMigrations.add(mintStr);
      saveProcessed();
      return { skipped: true, reason: "Pool exists" };
    }

    // Create the pool (complete automatic flow)
    console.log("🔧 Starting automatic pool creation...\n");
    const result = await createPoolFromMigration(connection, program, payer, mint, vaultInfo);

    if (result.success) {
      console.log(`\n✅ Complete automatic process finished!`);
      if (migrationResult.success) {
        console.log(`   ✅ Auto-migrated: YES (triggered automatically)`);
      }
      console.log(`   Pool ID: ${result.poolId}`);
      console.log(`   Pool TX: ${result.txId}`);
      console.log(`   Withdrawal TX: ${result.withdrawalTx}`);
      
      if (result.lpBurned) {
        console.log(`   🔥 LP Burn TX: ${result.lpBurnTx}`);
        console.log(`   🔒 Liquidity: PERMANENTLY LOCKED`);
      } else {
        console.log(`   ⚠️  LP Burn: FAILED (${result.warning})`);
        console.log(`   ⚠️  Liquidity: NOT LOCKED - Manual burn required`);
      }
      console.log();

      // Mark as processed
      processedMigrations.add(mintStr);
      saveProcessed();

      // Log success with verification steps
      console.log("📝 VERIFICATION:");
      console.log(`   1. View pool: https://raydium.io/liquidity/increase/?pool_id=${result.poolId}`);
      console.log(`   2. Trade on Jupiter: https://jup.ag/swap/SOL-${mintStr}`);
      console.log(`   3. Check DexScreener: https://dexscreener.com/solana/${mintStr}`);
      
      if (result.lpBurned) {
        console.log(`   4. Verify burn: https://explorer.solana.com/tx/${result.lpBurnTx}?cluster=${NETWORK}`);
      }
      console.log();

      return { 
        success: true, 
        poolId: result.poolId, 
        txId: result.txId,
        lpBurned: result.lpBurned,
        lpBurnTx: result.lpBurnTx,
        autoMigrated: migrationResult.success || false
      };
    } else {
      console.log(`❌ Pool creation failed: ${result.error}\n`);
      
      if (result.fundsWithdrawn) {
        console.log("⚠️  Funds were withdrawn but pool creation failed");
        console.log(`   SOL in wallet: ${(result.solAmount / 1e9).toFixed(4)}`);
        console.log(`   Tokens in wallet: ${(result.tokenAmount / 1e6).toLocaleString()}`);
        console.log("   You can manually create the pool with these funds\n");
      }
      
      return { error: result.error };
    }

  } catch (error) {
    console.error(`❌ Error processing migration:`, error.message);
    console.error(error.stack);
    return { error: error.message };
  }
}

/**
 * Scan for tokens ready for migration or already migrated
 */
async function scanForMigrations(connection, program, payer) {
  console.log("\n🔍 Scanning for tokens ready for migration/pooling...\n");

  try {
    // Get all bonding curve accounts
    const bondingCurves = await program.account.bondingCurve.all();
    
    console.log(`   Found ${bondingCurves.length} bonding curve accounts\n`);

    let autoMigrated = 0;
    let poolsCreated = 0;
    let skipped = 0;
    let errors = 0;

    for (const { publicKey, account } of bondingCurves) {
      try {
        const mint = account.mint;
        const mintStr = mint.toBase58();

        // Skip if already processed
        if (processedMigrations.has(mintStr)) {
          skipped++;
          continue;
        }

        console.log(`\n   Checking: ${mintStr.substring(0, 8)}...`);
        
        // Check if needs migration or pool creation
        const result = await processMigration(connection, program, payer, mint);

        if (result.success) {
          poolsCreated++;
          if (result.autoMigrated) autoMigrated++;
        } else if (result.skipped) {
          skipped++;
        } else if (result.error) {
          errors++;
        }

        // Small delay between processing
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        errors++;
        console.error(`   Error processing: ${error.message}`);
        continue;
      }
    }

    console.log(`\n📊 Scan complete:`);
    console.log(`   Auto-migrated: ${autoMigrated}`);
    console.log(`   Pools created: ${poolsCreated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}\n`);

  } catch (error) {
    console.error("❌ Error scanning:", error.message);
  }
}

/**
 * Listen for threshold reached and migration events (REAL-TIME)
 */
async function listenForMigrations(connection, program, payer) {
  console.log("👂 Listening for threshold & migration events (real-time)...\n");

  try {
    // Subscribe to program logs
    const subscriptionId = connection.onLogs(
      PROGRAM_ID,
      async (logs) => {
        try {
          const logString = logs.logs.join("\n");
          
          // Check if threshold was reached (INSTANT TRIGGER!)
          if (logString.includes("MigrationThresholdReached")) {
            console.log(`\n🚨 THRESHOLD REACHED DETECTED (REAL-TIME)!`);
            console.log(`   Transaction: ${logs.signature}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${logs.signature}?cluster=${NETWORK}`);
            console.log(`   ⚡ Triggering INSTANT migration...\n`);

            // Parse the transaction to get the mint address
            try {
              const tx = await connection.getTransaction(logs.signature, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0
              });
              
              if (tx && tx.meta) {
                // Extract mint from transaction accounts
                // Try to get mint from the accounts involved
                const accounts = tx.transaction.message.getAccountKeys();
                
                // Scan for bonding curve accounts to find the mint
                setTimeout(async () => {
                  console.log("   Scanning for the token that reached threshold...\n");
                  await scanForMigrations(connection, program, payer);
                }, 2000); // Just 2 seconds to let transaction finalize
              }
            } catch (error) {
              console.error("   Error parsing threshold event:", error.message);
              // Fallback: run a scan
              setTimeout(async () => {
                await scanForMigrations(connection, program, payer);
              }, 2000);
            }
          }
          
          // Also check if migration completed
          if (logString.includes("Migration complete") || logString.includes("migrate")) {
            console.log(`\n🎉 Migration completion detected!`);
            console.log(`   Transaction: ${logs.signature}`);
            console.log(`   Triggering pool creation...\n`);

            // Run a scan to create the pool
            setTimeout(async () => {
              await scanForMigrations(connection, program, payer);
            }, 3000); // 3 seconds for migration to finalize
          }

        } catch (error) {
          console.error("Error processing log:", error.message);
        }
      },
      "confirmed"
    );

    console.log(`✅ Subscribed to real-time events (ID: ${subscriptionId})`);
    console.log(`   • Threshold reached events → Instant migration`);
    console.log(`   • Migration complete events → Pool creation\n`);

  } catch (error) {
    console.error("❌ Error subscribing to logs:", error.message);
  }
}

/**
 * Main service loop
 */
async function startService() {
  console.log("\n" + "=".repeat(70));
  console.log("🤖 Raydium Pool Auto-Creation Service");
  console.log("=".repeat(70) + "\n");

  console.log("📡 Configuration:");
  console.log(`   Network: ${NETWORK}`);
  console.log(`   RPC: ${RPC_URL}`);
  console.log(`   Program: ${PROGRAM_ID.toBase58()}\n`);

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");

  // Load admin keypair
  let payer;
  try {
    const keypairData = JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, "utf-8"));
    payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    console.log(`👤 Admin Wallet: ${payer.publicKey.toBase58()}\n`);

    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

    if (balance < 0.5 * 1e9) {
      console.log("⚠️  WARNING: Low balance! Pool creation requires ~0.5 SOL each.");
      console.log("   Please add SOL to admin wallet.\n");
    }
  } catch (error) {
    console.error("❌ Error loading admin keypair:", error.message);
    process.exit(1);
  }

  // Load IDL for event parsing
  let program;
  try {
    const idlPath = path.join(__dirname, "../target/idl/fundly.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    const provider = new anchor.AnchorProvider(connection, { publicKey: payer.publicKey }, {});
    program = new anchor.Program(idl, provider);
    console.log("📝 Program IDL loaded\n");
  } catch (error) {
    console.log("⚠️  Could not load IDL - event parsing will be limited\n");
  }

  // Load previously processed migrations
  loadProcessed();

  console.log("=".repeat(70));
  console.log("🚀 Service Started!");
  console.log("=".repeat(70) + "\n");

  // Initial scan
  console.log("🔎 Running initial scan for existing migrations...\n");
  await scanForMigrations(connection, program, payer);

  // Start listening for new migrations
  await listenForMigrations(connection, program, payer);

  // Periodic re-scan every 2 minutes (more frequent to catch threshold reaches)
  setInterval(async () => {
    console.log("\n⏰ Periodic scan triggered...\n");
    await scanForMigrations(connection, program, payer);
  }, 2 * 60 * 1000); // 2 minutes

  console.log("✅ Service running! Press Ctrl+C to stop.\n");
  console.log("🤖 Automatic Migration: ENABLED");
  console.log("   • Detects when tokens reach 85 SOL threshold");
  console.log("   • Automatically triggers migration");
  console.log("   • Creates pool and burns LP tokens");
  console.log("   • Zero user interaction required!\n");
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down service...");
  saveProcessed();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n👋 Shutting down service...");
  saveProcessed();
  process.exit(0);
});

// Error handling
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection:", error);
});

// Start the service
startService().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

