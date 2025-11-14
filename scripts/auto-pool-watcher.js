/**
 * Automatic Pool Creation Watcher Service
 * 
 * Monitors for MigrationComplete events and automatically creates Raydium pools
 * 
 * Usage: node scripts/auto-pool-watcher.js
 * 
 * Keep this running in the background (or as a systemd service, PM2, etc.)
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");
const CHECK_INTERVAL = 30000; // Check every 30 seconds

// Track processed migrations to avoid duplicates
const processedMigrationsFile = path.join(__dirname, ".processed-migrations.json");
let processedMigrations = new Set();

// Load processed migrations from file
function loadProcessedMigrations() {
  try {
    if (fs.existsSync(processedMigrationsFile)) {
      const data = JSON.parse(fs.readFileSync(processedMigrationsFile, "utf-8"));
      processedMigrations = new Set(data);
      console.log(`📋 Loaded ${processedMigrations.size} processed migrations`);
    }
  } catch (error) {
    console.log("⚠️  Could not load processed migrations file");
  }
}

// Save processed migrations to file
function saveProcessedMigrations() {
  try {
    fs.writeFileSync(
      processedMigrationsFile,
      JSON.stringify([...processedMigrations], null, 2)
    );
  } catch (error) {
    console.error("❌ Error saving processed migrations:", error);
  }
}

// Check for migrated tokens
async function checkForMigratedTokens(connection) {
  try {
    // Get all bonding curve accounts
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          dataSize: 200, // Approximate size of BondingCurve account
        },
      ],
    });

    console.log(`🔍 Found ${accounts.length} bonding curve accounts`);

    for (const account of accounts) {
      try {
        // Parse account data to check if migrated
        // In production, you'd use the IDL to deserialize properly
        const data = account.account.data;
        
        // Simple check: see if there's a migration vault with funds
        // This is a placeholder - in production you'd properly deserialize the account
        
        // Derive mint from account address (simplified)
        const accountPubkey = account.pubkey.toBase58();
        
        // Check if we've already processed this
        if (processedMigrations.has(accountPubkey)) {
          continue;
        }

        // For now, we'll rely on manual checking
        // In production, properly deserialize the account data
        console.log(`   Checking account: ${accountPubkey.slice(0, 8)}...`);
      } catch (error) {
        // Skip accounts we can't parse
        continue;
      }
    }
  } catch (error) {
    console.error("❌ Error checking for migrated tokens:", error.message);
  }
}

// Create pool for a migrated token
async function createPoolForToken(mintAddress) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Creating pool for ${mintAddress}...`);
    
    const child = spawn("npx", ["ts-node", "scripts/auto-create-pool-for-migration.ts", mintAddress], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Pool created successfully for ${mintAddress}`);
        processedMigrations.add(mintAddress);
        saveProcessedMigrations();
        resolve();
      } else {
        console.error(`❌ Pool creation failed for ${mintAddress}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

// Listen for migration events
async function listenForMigrations(connection) {
  console.log("👂 Listening for migration events...");
  
  // Subscribe to program logs
  const subscriptionId = connection.onLogs(
    PROGRAM_ID,
    async (logs) => {
      try {
        // Check if this is a migration transaction
        const logMessages = logs.logs.join("\n");
        
        if (logMessages.includes("Migration complete")) {
          console.log("\n🎉 Migration detected!");
          console.log(`   Transaction: ${logs.signature}`);
          
          // Extract mint address from logs (this is simplified)
          // In production, properly parse the event data
          
          // For now, log it
          console.log("   ℹ️  Check transaction for mint address");
          console.log(`   https://explorer.solana.com/tx/${logs.signature}?cluster=devnet\n`);
        }
      } catch (error) {
        console.error("Error processing log:", error);
      }
    },
    "confirmed"
  );

  console.log(`✅ Subscribed to program logs (ID: ${subscriptionId})`);
  return subscriptionId;
}

// Main watcher loop
async function startWatcher() {
  console.log("\n🤖 Raydium Pool Auto-Creation Service");
  console.log("=====================================\n");
  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`📝 Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`⏱️  Check Interval: ${CHECK_INTERVAL / 1000}s\n`);

  const connection = new Connection(RPC_URL, "confirmed");
  
  // Load previously processed migrations
  loadProcessedMigrations();

  // Listen for new migrations
  await listenForMigrations(connection);

  // Periodic check for missed migrations
  setInterval(async () => {
    console.log("\n🔄 Periodic check for migrated tokens...");
    await checkForMigratedTokens(connection);
  }, CHECK_INTERVAL);

  console.log("\n✅ Watcher service started!");
  console.log("   Press Ctrl+C to stop\n");
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down watcher service...");
  saveProcessedMigrations();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n👋 Shutting down watcher service...");
  saveProcessedMigrations();
  process.exit(0);
});

// Start the watcher
startWatcher().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

