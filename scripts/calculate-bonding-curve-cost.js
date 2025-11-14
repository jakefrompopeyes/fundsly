/**
 * Calculate Bonding Curve Cost Analysis
 * 
 * Shows how much SOL is needed to buy different amounts of tokens
 * based on the current global configuration
 */

const BN = require("bn.js");

// Current Configuration (as of Nov 13, 2025)
const VIRTUAL_SOL = 40;           // 40 SOL virtual reserves
const VIRTUAL_TOKENS = 150_000_000; // 150M virtual tokens
const REAL_TOKENS = 800_000_000;    // 800M tokens on bonding curve (80% of 1B)
const MIGRATION_THRESHOLD = 84;     // Migration happens at 84 SOL

// Constant product formula: (virtual_sol + real_sol) × (virtual_tokens + real_tokens) = k
const k = VIRTUAL_SOL * (VIRTUAL_TOKENS + REAL_TOKENS);

console.log("🔵 Bonding Curve Cost Analysis");
console.log("================================\n");

console.log("📊 Current Configuration:");
console.log(`   Virtual SOL Reserves:     ${VIRTUAL_SOL.toLocaleString()} SOL`);
console.log(`   Virtual Token Reserves:   ${VIRTUAL_TOKENS.toLocaleString()} tokens`);
console.log(`   Real Token Supply:        ${REAL_TOKENS.toLocaleString()} tokens`);
console.log(`   Migration Threshold:      ${MIGRATION_THRESHOLD} SOL`);
console.log(`   Constant (k):             ${k.toLocaleString()}\n`);

// Function to calculate SOL needed to buy X tokens
function calculateSolNeeded(tokensToBuy) {
  const initialRealTokens = REAL_TOKENS;
  const finalRealTokens = initialRealTokens - tokensToBuy;
  
  if (finalRealTokens < 0) {
    return null; // Can't buy more than available
  }
  
  // Initial: (virtual_sol + 0) × (virtual_tokens + real_tokens) = k
  // Final: (virtual_sol + sol_spent) × (virtual_tokens + remaining_tokens) = k
  // Solve for sol_spent:
  // sol_spent = k / (virtual_tokens + remaining_tokens) - virtual_sol
  
  const solNeeded = k / (VIRTUAL_TOKENS + finalRealTokens) - VIRTUAL_SOL;
  return solNeeded;
}

// Function to calculate tokens bought with X SOL
function calculateTokensBought(solSpent) {
  // (virtual_sol + sol_spent) × (virtual_tokens + remaining_tokens) = k
  // remaining_tokens = k / (virtual_sol + sol_spent) - virtual_tokens
  
  const remainingTokens = k / (VIRTUAL_SOL + solSpent) - VIRTUAL_TOKENS;
  const tokensBought = REAL_TOKENS - remainingTokens;
  return tokensBought;
}

// Calculate key scenarios
console.log("💰 Key Scenarios:\n");

// Scenario 1: Small buy (10M tokens)
const smallBuyTokens = 10_000_000;
const smallBuySol = calculateSolNeeded(smallBuyTokens);
console.log(`1️⃣  Small Buy: ${smallBuyTokens.toLocaleString()} tokens (${(smallBuyTokens/REAL_TOKENS*100).toFixed(2)}% of supply)`);
console.log(`   Cost: ${smallBuySol.toFixed(6)} SOL`);
console.log(`   Avg Price: ${(smallBuySol / smallBuyTokens * 1_000_000_000).toFixed(9)} SOL per million tokens\n`);

// Scenario 2: Medium buy (100M tokens)
const mediumBuyTokens = 100_000_000;
const mediumBuySol = calculateSolNeeded(mediumBuyTokens);
console.log(`2️⃣  Medium Buy: ${mediumBuyTokens.toLocaleString()} tokens (${(mediumBuyTokens/REAL_TOKENS*100).toFixed(2)}% of supply)`);
console.log(`   Cost: ${mediumBuySol.toFixed(6)} SOL`);
console.log(`   Avg Price: ${(mediumBuySol / mediumBuyTokens * 1_000_000_000).toFixed(9)} SOL per million tokens\n`);

// Scenario 3: Large buy (400M tokens - half the supply)
const largeBuyTokens = 400_000_000;
const largeBuySol = calculateSolNeeded(largeBuyTokens);
console.log(`3️⃣  Large Buy: ${largeBuyTokens.toLocaleString()} tokens (${(largeBuyTokens/REAL_TOKENS*100).toFixed(2)}% of supply)`);
console.log(`   Cost: ${largeBuySol.toFixed(6)} SOL`);
console.log(`   Avg Price: ${(largeBuySol / largeBuyTokens * 1_000_000_000).toFixed(9)} SOL per million tokens\n`);

// Scenario 4: At migration threshold (84 SOL)
const tokensBoughtAtMigration = calculateTokensBought(MIGRATION_THRESHOLD);
console.log(`4️⃣  At Migration Threshold: ${MIGRATION_THRESHOLD} SOL invested`);
console.log(`   Tokens Bought: ${tokensBoughtAtMigration.toLocaleString()} tokens`);
console.log(`   Percentage: ${(tokensBoughtAtMigration/REAL_TOKENS*100).toFixed(2)}% of supply`);
console.log(`   Remaining on Curve: ${(REAL_TOKENS - tokensBoughtAtMigration).toLocaleString()} tokens`);
console.log(`   ⚠️  MIGRATION TO RAYDIUM DEX TRIGGERS HERE\n`);

// Scenario 5: Buying all tokens (theoretical - won't happen due to migration)
const allTokensSol = calculateSolNeeded(REAL_TOKENS);
console.log(`5️⃣  Buy ALL Supply (Theoretical): ${REAL_TOKENS.toLocaleString()} tokens (100%)`);
console.log(`   Cost: ${allTokensSol.toFixed(6)} SOL`);
console.log(`   ❌ NOTE: This is theoretical - migration happens at ${MIGRATION_THRESHOLD} SOL\n`);

// Price progression table
console.log("📈 Price Progression Table:\n");
console.log("SOL Invested | Tokens Bought | % of Supply | Remaining Tokens | Current Price (SOL/token)");
console.log("-".repeat(100));

const solSteps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 84, 90, 100, 150, 200, allTokensSol];

for (const sol of solSteps) {
  if (sol > allTokensSol) continue;
  
  const tokensBought = calculateTokensBought(sol);
  const percentBought = (tokensBought / REAL_TOKENS * 100).toFixed(2);
  const remaining = REAL_TOKENS - tokensBought;
  
  // Current price = (virtual_sol + real_sol) / (virtual_tokens + real_tokens)
  const currentPrice = (VIRTUAL_SOL + sol) / (VIRTUAL_TOKENS + remaining);
  
  const migrationFlag = sol >= MIGRATION_THRESHOLD ? " 🚀 MIGRATION" : "";
  const exactFlag = sol === allTokensSol ? " 🎯 ALL SOLD" : "";
  
  console.log(
    `${sol.toFixed(2).padStart(12)} | ` +
    `${tokensBought.toLocaleString().padStart(13)} | ` +
    `${percentBought.padStart(11)}% | ` +
    `${remaining.toLocaleString().padStart(16)} | ` +
    `${currentPrice.toExponential(6)}${migrationFlag}${exactFlag}`
  );
}

console.log("\n" + "=".repeat(100));
console.log("\n💡 Key Insights:\n");
console.log(`   • To reach migration (84 SOL): ~${tokensBoughtAtMigration.toLocaleString()} tokens sold (${(tokensBoughtAtMigration/REAL_TOKENS*100).toFixed(1)}%)`);
console.log(`   • To buy all supply: ${allTokensSol.toFixed(2)} SOL (but migration prevents this)`);
console.log(`   • Migration leaves ~${(REAL_TOKENS - tokensBoughtAtMigration).toLocaleString()} tokens on the curve`);
console.log(`   • Those remaining tokens migrate to Raydium DEX as liquidity`);
console.log(`   • Price starts low and increases exponentially as supply decreases\n`);

console.log("🎯 Practical Takeaways:\n");
console.log(`   1. Early buyers get the best price (starts at ~${(VIRTUAL_SOL / (VIRTUAL_TOKENS + REAL_TOKENS)).toExponential(6)} SOL/token)`);
console.log(`   2. Price accelerates rapidly after 50% supply is sold`);
console.log(`   3. Migration at 84 SOL ensures liquidity moves to Raydium DEX`);
console.log(`   4. Remaining tokens become part of the DEX liquidity pool`);
console.log(`   5. With new config (40 SOL / 150M virtual), prices are ${((40/30)*(350/150)).toFixed(2)}x higher than old config\n`);

