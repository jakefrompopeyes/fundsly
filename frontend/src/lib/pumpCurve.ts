/**
 * Plain-language overview:
 * This file provides a simplified bonding-curve model similar in spirit to pump.fun.
 * It uses a constant-product market maker (CPMM) with "virtual" reserves to shape
 * the early price path. This is for preview/UI calculations only — not authoritative.
 */

export type CurveParams = {
  virtualSol: number; // virtual SOL reserve (not actually in the pool)
  virtualTokens: number; // virtual token reserve (affects initial price)
  feeBps: number; // platform fee in basis points (0-1000 = 0%..10%)
};

export type PoolState = {
  solReserves: number; // real SOL in pool (for preview we start from 0)
  tokenReserves: number; // real tokens in pool (start from 0)
};

/**
 * Compute current spot price (SOL per token) using virtual + real reserves.
 */
export function getSpotPriceSOLPerToken(
  state: PoolState,
  params: CurveParams,
): number {
  const rSol = params.virtualSol + state.solReserves;
  const rTok = params.virtualTokens + state.tokenReserves;
  return rSol / rTok;
}

/**
 * Given an input amount of SOL, estimate tokens out after fee using CPMM math.
 * This ignores slippage protections and is meant for UI only.
 */
export function quoteBuyTokens(
  state: PoolState,
  params: CurveParams,
  solIn: number,
): { tokensOut: number; effectivePrice: number; solAfterFee: number } {
  const fee = (solIn * params.feeBps) / 10_000;
  const solAfterFee = Math.max(solIn - fee, 0);

  const rSol = params.virtualSol + state.solReserves;
  const rTok = params.virtualTokens + state.tokenReserves;
  const k = rSol * rTok;

  const newSol = rSol + solAfterFee;
  const newTok = k / newSol;
  const tokensOut = Math.max(rTok - newTok, 0);
  const effectivePrice = solIn / (tokensOut || 1);

  return { tokensOut, effectivePrice, solAfterFee };
}

/**
 * Given an input amount of tokens, estimate SOL out after fee using CPMM math.
 * This ignores slippage protections and is meant for UI only.
 */
export function quoteSellTokens(
  state: PoolState,
  params: CurveParams,
  tokensIn: number,
): { solOut: number; effectivePrice: number; solBeforeFee: number } {
  const rSol = params.virtualSol + state.solReserves;
  const rTok = params.virtualTokens + state.tokenReserves;
  const k = rSol * rTok;

  const newTok = rTok + tokensIn;
  const newSol = k / newTok;
  const solOutBeforeFee = Math.max(rSol - newSol, 0);

  const fee = (solOutBeforeFee * params.feeBps) / 10_000;
  const solOut = Math.max(solOutBeforeFee - fee, 0);
  const effectivePrice = solOut / (tokensIn || 1);

  return { solOut, effectivePrice, solBeforeFee: solOutBeforeFee };
}

/**
 * Simulate a buy by updating real reserves. For UI preview only.
 */
export function applyBuy(
  state: PoolState,
  params: CurveParams,
  solIn: number,
): PoolState {
  const { tokensOut, solAfterFee } = quoteBuyTokens(state, params, solIn);
  return {
    solReserves: state.solReserves + solAfterFee,
    tokenReserves: Math.max(state.tokenReserves - tokensOut, 0),
  };
}

/**
 * Simulate a sell by updating real reserves. For UI preview only.
 */
export function applySell(
  state: PoolState,
  params: CurveParams,
  tokensIn: number,
): PoolState {
  const { solBeforeFee } = quoteSellTokens(state, params, tokensIn);
  return {
    solReserves: Math.max(state.solReserves - solBeforeFee, 0),
    tokenReserves: state.tokenReserves + tokensIn,
  };
}

/**
 * Calculate market cap based on current price and circulating supply.
 * Market cap = spot price × circulating supply
 */
export function getMarketCap(
  state: PoolState,
  params: CurveParams,
  circulatingSupply: number,
): number {
  const spotPrice = getSpotPriceSOLPerToken(state, params);
  return spotPrice * circulatingSupply;
}

/**
 * Calculate the price impact of a buy in percentage.
 */
export function calculateBuyPriceImpact(
  state: PoolState,
  params: CurveParams,
  solIn: number,
): number {
  const spotPriceBefore = getSpotPriceSOLPerToken(state, params);
  const { effectivePrice } = quoteBuyTokens(state, params, solIn);
  return ((effectivePrice - spotPriceBefore) / spotPriceBefore) * 100;
}

/**
 * Calculate the price impact of a sell in percentage.
 */
export function calculateSellPriceImpact(
  state: PoolState,
  params: CurveParams,
  tokensIn: number,
): number {
  const spotPriceBefore = getSpotPriceSOLPerToken(state, params);
  const { effectivePrice } = quoteSellTokens(state, params, tokensIn);
  return ((effectivePrice - spotPriceBefore) / spotPriceBefore) * 100;
}

/**
 * Check if the bonding curve is complete (all tokens sold).
 */
export function isCurveComplete(state: PoolState): boolean {
  return state.tokenReserves <= 0;
}

/**
 * Calculate the percentage of tokens sold from the bonding curve.
 */
export function getProgressPercentage(
  state: PoolState,
  initialTokenSupply: number,
): number {
  const tokensSold = initialTokenSupply - state.tokenReserves;
  return (tokensSold / initialTokenSupply) * 100;
}

/**
 * Get current price chart data points for visualization.
 * Returns an array of {solIn, price} for plotting a price curve.
 */
export function getPriceChartData(
  state: PoolState,
  params: CurveParams,
  numPoints: number = 50,
  maxSolRange: number = 10, // max SOL to show on chart
): Array<{ solIn: number; price: number }> {
  const points: Array<{ solIn: number; price: number }> = [];
  const step = maxSolRange / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const solIn = i * step;
    const simulatedState = applyBuy(state, params, solIn);
    const price = getSpotPriceSOLPerToken(simulatedState, params);
    points.push({ solIn, price });
  }

  return points;
}

/**
 * Estimate how much SOL is needed to buy a specific amount of tokens.
 */
export function estimateSOLForTokens(
  state: PoolState,
  params: CurveParams,
  desiredTokens: number,
  maxIterations: number = 20,
): number {
  // Binary search to find the SOL amount needed
  let low = 0;
  let high = 100; // Start with 100 SOL as upper bound
  let mid = 0;

  for (let i = 0; i < maxIterations; i++) {
    mid = (low + high) / 2;
    const { tokensOut } = quoteBuyTokens(state, params, mid);

    if (Math.abs(tokensOut - desiredTokens) < 0.0001) {
      return mid;
    }

    if (tokensOut < desiredTokens) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return mid;
}

/**
 * Estimate how many tokens are needed to sell for a specific amount of SOL.
 */
export function estimateTokensForSOL(
  state: PoolState,
  params: CurveParams,
  desiredSOL: number,
  maxIterations: number = 20,
): number {
  // Binary search to find the token amount needed
  let low = 0;
  let high = state.tokenReserves; // Can't sell more than what's in reserves
  let mid = 0;

  for (let i = 0; i < maxIterations; i++) {
    mid = (low + high) / 2;
    const { solOut } = quoteSellTokens(state, params, mid);

    if (Math.abs(solOut - desiredSOL) < 0.0001) {
      return mid;
    }

    if (solOut < desiredSOL) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return mid;
}

/**
 * Calculate progress toward migration threshold.
 * Returns a percentage (0-100) of how close the bonding curve is to migrating.
 */
export function getMigrationProgress(
  state: PoolState,
  migrationThresholdSol: number,
): number {
  const progress = (state.solReserves / migrationThresholdSol) * 100;
  return Math.min(progress, 100);
}

/**
 * Check if migration threshold has been reached.
 */
export function shouldMigrate(
  state: PoolState,
  migrationThresholdSol: number,
): boolean {
  return state.solReserves >= migrationThresholdSol;
}

/**
 * Calculate how much more SOL is needed to reach migration threshold.
 */
export function solUntilMigration(
  state: PoolState,
  migrationThresholdSol: number,
): number {
  const remaining = migrationThresholdSol - state.solReserves;
  return Math.max(remaining, 0);
}

/**
 * Get a formatted string describing migration status.
 */
export function getMigrationStatusText(
  state: PoolState,
  migrationThresholdSol: number,
): string {
  if (shouldMigrate(state, migrationThresholdSol)) {
    return "Ready for migration to DEX!";
  }
  
  const remaining = solUntilMigration(state, migrationThresholdSol);
  const progress = getMigrationProgress(state, migrationThresholdSol);
  
  return `${remaining.toFixed(2)} SOL until DEX migration (${progress.toFixed(1)}%)`;
}


