/**
 * Test Script: Verify Backend Setup
 * 
 * This script checks that all dependencies and configuration are correct
 * before running the pool creation service.
 */

const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function warning(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

async function testSetup() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 Testing Backend Service Setup");
  console.log("=".repeat(60) + "\n");

  let allPassed = true;

  // Test 1: Check Node version
  console.log("1️⃣  Checking Node.js version...");
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion >= 18) {
    success(`Node.js ${nodeVersion} (>= 18.0.0)`);
  } else {
    error(`Node.js ${nodeVersion} (requires >= 18.0.0)`);
    allPassed = false;
  }
  console.log();

  // Test 2: Check dependencies
  console.log("2️⃣  Checking dependencies...");
  const requiredPackages = [
    "@solana/web3.js",
    "@solana/spl-token",
    "@coral-xyz/anchor",
    "@raydium-io/raydium-sdk-v2",
  ];

  for (const pkg of requiredPackages) {
    try {
      require(pkg);
      success(`${pkg}`);
    } catch (e) {
      error(`${pkg} not installed`);
      allPassed = false;
    }
  }
  console.log();

  // Test 3: Check environment variables
  console.log("3️⃣  Checking environment configuration...");
  const network = process.env.SOLANA_NETWORK || "devnet";
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  
  info(`Network: ${network}`);
  info(`RPC URL: ${rpcUrl}`);
  console.log();

  // Test 4: Check RPC connection
  console.log("4️⃣  Testing RPC connection...");
  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const version = await connection.getVersion();
    success(`Connected to Solana ${network} (version ${version["solana-core"]})`);
  } catch (e) {
    error(`Cannot connect to RPC: ${e.message}`);
    allPassed = false;
  }
  console.log();

  // Test 5: Check admin keypair
  console.log("5️⃣  Checking admin keypair...");
  const keypairPath = process.env.ADMIN_KEYPAIR_PATH || path.join(
    process.env.HOME || process.env.USERPROFILE,
    ".config/solana/id.json"
  );
  
  try {
    if (fs.existsSync(keypairPath)) {
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
      const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
      success(`Admin keypair found: ${keypair.publicKey.toBase58()}`);
      
      // Check balance
      const connection = new Connection(rpcUrl, "confirmed");
      const balance = await connection.getBalance(keypair.publicKey);
      const solBalance = balance / 1e9;
      
      if (solBalance > 0.5) {
        success(`Balance: ${solBalance.toFixed(4)} SOL (sufficient)`);
      } else if (solBalance > 0) {
        warning(`Balance: ${solBalance.toFixed(4)} SOL (low - need ~0.5 SOL per pool)`);
      } else {
        error(`Balance: ${solBalance.toFixed(4)} SOL (insufficient)`);
        allPassed = false;
      }
    } else {
      error(`Keypair not found at: ${keypairPath}`);
      info("Set ADMIN_KEYPAIR_PATH in .env or create keypair:");
      info("  solana-keygen new --outfile ~/.config/solana/id.json");
      allPassed = false;
    }
  } catch (e) {
    error(`Error loading keypair: ${e.message}`);
    allPassed = false;
  }
  console.log();

  // Test 6: Check IDL file
  console.log("6️⃣  Checking program IDL...");
  const idlPath = path.join(__dirname, "../target/idl/fundly.json");
  try {
    if (fs.existsSync(idlPath)) {
      const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
      success(`IDL found for program: ${idl.address}`);
      
      // Check for required instructions
      const instructions = idl.instructions.map(i => i.name);
      const required = ["withdraw_migration_funds", "migrate_to_raydium"];
      
      let hasAll = true;
      for (const inst of required) {
        if (instructions.includes(inst)) {
          success(`  - ${inst} instruction found`);
        } else {
          error(`  - ${inst} instruction missing`);
          hasAll = false;
        }
      }
      
      if (!hasAll) {
        allPassed = false;
      }
    } else {
      error("IDL not found");
      info("Run: anchor build");
      allPassed = false;
    }
  } catch (e) {
    error(`Error loading IDL: ${e.message}`);
    allPassed = false;
  }
  console.log();

  // Test 7: Check Raydium SDK
  console.log("7️⃣  Checking Raydium SDK...");
  try {
    const { Raydium } = require("@raydium-io/raydium-sdk-v2");
    success("Raydium SDK v2 loaded");
    info("Ready to create CPMM pools");
  } catch (e) {
    error(`Raydium SDK error: ${e.message}`);
    info("Try: npm install @raydium-io/raydium-sdk-v2");
    allPassed = false;
  }
  console.log();

  // Final result
  console.log("=".repeat(60));
  if (allPassed) {
    success("All tests passed! Ready to start service.");
    console.log("\nTo start the service:");
    console.log("  npm start          # Development");
    console.log("  npm run pm2:start  # Production (with PM2)");
  } else {
    error("Some tests failed. Please fix the issues above.");
    console.log("\nCommon fixes:");
    console.log("  - Install dependencies: npm install");
    console.log("  - Build smart contract: anchor build");
    console.log("  - Create/fund admin wallet");
    console.log("  - Set environment variables in .env");
  }
  console.log("=".repeat(60) + "\n");

  process.exit(allPassed ? 0 : 1);
}

// Run tests
testSetup().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});

