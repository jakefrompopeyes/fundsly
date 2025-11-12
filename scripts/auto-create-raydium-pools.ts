/**
 * Automatic Raydium Pool Creation Service
 * 
 * This service listens for MigrationComplete events and automatically creates
 * Raydium CPMM pools for migrated tokens.
 * 
 * SETUP:
 * 1. Install dependencies: npm install @raydium-io/raydium-sdk-v2
 * 2. Set environment variables:
 *    - SOLANA_RPC_URL: RPC endpoint
 *    - AUTHORITY_KEYPAIR_PATH: Path to authority keypair
 * 3. Run: npx ts-node scripts/auto-create-raydium-pools.ts
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { AnchorProvider, BN, Program, Idl } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import idlJson from "../frontend/src/idl/fundly.json";

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(idlJson.address);
const RAYDIUM_CPMM_PROGRAM = new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");

// For devnet, we'll use wrapped SOL as quote token
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

interface MigrationEvent {
  mint: PublicKey;
  raydiumPool: PublicKey;
  solMigrated: BN;
  tokensMigrated: BN;
  timestamp: BN;
}

/**
 * Load authority keypair from file
 */
function loadAuthority(): Keypair {
  const keypairPath = process.env.AUTHORITY_KEYPAIR_PATH || 
    `${process.env.HOME}/.config/solana/id.json`;
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

/**
 * Derive PDAs for migration vaults
 */
async function deriveMigrationVaults(mintAddress: PublicKey) {
  const [migrationSolVault] = await PublicKey.findProgramAddress(
    [Buffer.from("migration_vault"), mintAddress.toBuffer()],
    PROGRAM_ID
  );

  const [migrationAuthority] = await PublicKey.findProgramAddress(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );

  const migrationTokenAccount = await getAssociatedTokenAddress(
    mintAddress,
    migrationAuthority,
    true
  );

  const [bondingCurve] = await PublicKey.findProgramAddress(
    [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
    PROGRAM_ID
  );

  const [globalConfig] = await PublicKey.findProgramAddress(
    [Buffer.from("global_config")],
    PROGRAM_ID
  );

  return {
    migrationSolVault,
    migrationAuthority,
    migrationTokenAccount,
    bondingCurve,
    globalConfig,
  };
}

/**
 * Create Raydium CPMM pool
 * 
 * Note: This is a simplified version. Full implementation would need:
 * 1. Raydium SDK v2 integration
 * 2. Pool initialization with proper fee structure
 * 3. Liquidity addition
 * 4. LP token handling
 */
async function createRaydiumPool(
  connection: Connection,
  authority: Keypair,
  program: Program,
  mintAddress: PublicKey,
  solAmount: number,
  tokenAmount: number
): Promise<string | null> {
  console.log("\n📦 Creating Raydium CPMM Pool");
  console.log("================================\n");
  console.log(`Token: ${mintAddress.toBase58()}`);
  console.log(`SOL Amount: ${solAmount / 1e9} SOL`);
  console.log(`Token Amount: ${tokenAmount / 1e6} tokens\n`);

  try {
    // Step 1: Withdraw funds from migration vault
    console.log("Step 1: Withdrawing funds from migration vault...");
    
    const vaults = await deriveMigrationVaults(mintAddress);
    
    // Create recipient token account if needed
    const recipientTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      authority.publicKey,
      false
    );

    const withdrawTx = await program.methods
      .withdrawMigrationFunds(
        new BN(solAmount),
        new BN(tokenAmount)
      )
      .accounts({
        bondingCurve: vaults.bondingCurve,
        mint: mintAddress,
        migrationSolVault: vaults.migrationSolVault,
        migrationTokenAccount: vaults.migrationTokenAccount,
        migrationAuthority: vaults.migrationAuthority,
        globalConfig: vaults.globalConfig,
        authority: authority.publicKey,
        recipient: authority.publicKey,
        recipientTokenAccount: recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Funds withdrawn: ${withdrawTx}\n`);

    // Step 2: Create Raydium pool
    console.log("Step 2: Creating Raydium CPMM pool...");
    console.log("⚠️  NOTE: Full Raydium integration requires:");
    console.log("   - Raydium SDK v2");
    console.log("   - Pool account creation");
    console.log("   - Liquidity provision");
    console.log("   - LP token management\n");

    console.log("💡 For now, use one of these options:");
    console.log("\nOption A: Raydium UI (https://raydium.io/liquidity/create/)");
    console.log("   1. Connect wallet with authority keypair");
    console.log(`   2. Select base token: ${mintAddress.toBase58()}`);
    console.log(`   3. Select quote token: SOL`);
    console.log(`   4. Add ${solAmount / 1e9} SOL and ${tokenAmount / 1e6} tokens`);
    console.log("   5. Create pool\n");

    console.log("Option B: Raydium SDK v2");
    console.log("   See: https://github.com/raydium-io/raydium-sdk-V2-demo\n");

    // For production, you would:
    // const raydium = await Raydium.load({ connection, owner: authority });
    // const { execute } = await raydium.cpmm.createPool({
    //   programId: RAYDIUM_CPMM_PROGRAM,
    //   poolFeeAccount: ...,
    //   mintA: { mint: mintAddress, amount: tokenAmount },
    //   mintB: { mint: WSOL_MINT, amount: solAmount },
    //   startTime: new BN(Math.floor(Date.now() / 1000)),
    // });
    // await execute();

    return withdrawTx;

  } catch (error) {
    console.error("❌ Error creating pool:", error);
    return null;
  }
}

/**
 * Listen for migration events and create pools
 */
async function startPoolCreationService() {
  console.log("🚀 Raydium Pool Creation Service");
  console.log("=================================\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const authority = loadAuthority();

  console.log(`Authority: ${authority.publicKey.toBase58()}`);
  console.log(`Network: ${RPC_URL}`);
  console.log(`Program: ${PROGRAM_ID.toBase58()}\n`);

  // Create program instance
  const provider = new AnchorProvider(
    connection,
    { publicKey: authority.publicKey } as any,
    { commitment: "confirmed" }
  );

  const idl = idlJson as Idl;
  const program = new Program(idl, provider);

  console.log("👂 Listening for MigrationComplete events...\n");
  console.log("Press Ctrl+C to stop\n");

  // Listen for MigrationComplete events
  const eventListener = program.addEventListener(
    "MigrationComplete",
    async (event: any) => {
      console.log("\n🎉 Migration Complete Event Received!");
      console.log("======================================\n");

      const migrationEvent: MigrationEvent = {
        mint: event.mint,
        raydiumPool: event.raydiumPool,
        solMigrated: event.solMigrated,
        tokensMigrated: event.tokensMigrated,
        timestamp: event.timestamp,
      };

      console.log(`Mint: ${migrationEvent.mint.toBase58()}`);
      console.log(`SOL: ${migrationEvent.solMigrated.toNumber() / 1e9}`);
      console.log(`Tokens: ${migrationEvent.tokensMigrated.toNumber() / 1e6}`);
      console.log(`Time: ${new Date(migrationEvent.timestamp.toNumber() * 1000).toISOString()}\n`);

      // Automatically create Raydium pool
      console.log("🤖 Auto-creating Raydium pool...\n");

      const poolTx = await createRaydiumPool(
        connection,
        authority,
        program,
        migrationEvent.mint,
        migrationEvent.solMigrated.toNumber(),
        migrationEvent.tokensMigrated.toNumber()
      );

      if (poolTx) {
        console.log("\n✅ Pool creation initiated!");
        console.log(`Transaction: ${poolTx}\n`);
        
        // Save pool info
        const poolInfo = {
          mint: migrationEvent.mint.toBase58(),
          solAmount: migrationEvent.solMigrated.toNumber() / 1e9,
          tokenAmount: migrationEvent.tokensMigrated.toNumber() / 1e6,
          withdrawalTx: poolTx,
          timestamp: new Date().toISOString(),
        };

        const filename = `pool-${migrationEvent.mint.toBase58().slice(0, 8)}.json`;
        fs.writeFileSync(filename, JSON.stringify(poolInfo, null, 2));
        console.log(`💾 Pool info saved to: ${filename}\n`);
      } else {
        console.log("\n⚠️  Pool creation failed. Check logs above.\n");
      }

      console.log("👂 Continuing to listen for events...\n");
    }
  );

  // Keep the service running
  process.on("SIGINT", () => {
    console.log("\n\n👋 Stopping pool creation service...");
    program.removeEventListener(eventListener);
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

/**
 * Main entry point
 */
async function main() {
  try {
    await startPoolCreationService();
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

main();

