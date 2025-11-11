/**
 * Market Cap Calculator for Bonding Curves
 * Calculates virtual reserve parameters based on desired initial market cap
 */

export interface MarketCapConfig {
  marketCapUSD: number;
  solPriceUSD: number;
  totalSupply: number;
  decimals: number;
}

export interface VirtualReserves {
  virtualSol: number;        // in SOL (not lamports)
  virtualTokens: number;     // in raw token units
  initialPriceSol: number;   // SOL per token
  marketCapSol: number;      // in SOL
  marketCapUSD: number;      // in USD
}

/**
 * Calculate virtual reserves needed to achieve a specific initial market cap
 * 
 * Formula:
 * market_cap = total_supply × initial_price
 * initial_price = virtual_sol / (virtual_token + real_token)
 * 
 * At launch: real_token = total_supply, real_sol = 0
 * So: initial_price = virtual_sol / (virtual_token + total_supply)
 * 
 * Rearranging:
 * virtual_token = (virtual_sol × total_supply / initial_price) - total_supply
 */
export function calculateVirtualReserves(
  targetMarketCapUSD: number,
  solPriceUSD: number,
  totalSupply: number,
  virtualSolAmount: number = 30  // Default virtual SOL (pump.fun standard)
): VirtualReserves {
  // Convert market cap to SOL
  const marketCapSol = targetMarketCapUSD / solPriceUSD;
  
  // Calculate required initial price per token
  const initialPriceSol = marketCapSol / totalSupply;
  
  // Calculate required virtual tokens
  // initial_price = virtual_sol / (virtual_token + total_supply)
  // virtual_token = (virtual_sol / initial_price) - total_supply
  const virtualTokens = Math.floor((virtualSolAmount / initialPriceSol) - totalSupply);
  
  return {
    virtualSol: virtualSolAmount,
    virtualTokens: Math.max(0, virtualTokens), // Ensure non-negative
    initialPriceSol,
    marketCapSol,
    marketCapUSD: targetMarketCapUSD,
  };
}

/**
 * Preset market cap configurations
 */
export interface MarketCapPreset {
  name: string;
  marketCapUSD: number;
  description: string;
  useCase: string;
}

export const MARKET_CAP_PRESETS: MarketCapPreset[] = [
  {
    name: "Micro Launch",
    marketCapUSD: 4_600,
    description: "Very accessible, community-focused",
    useCase: "Meme coins, small communities",
  },
  {
    name: "Small Launch",
    marketCapUSD: 10_000,
    description: "Balanced accessibility and seriousness",
    useCase: "Small projects, experimental tokens",
  },
  {
    name: "Medium Launch",
    marketCapUSD: 25_000,
    description: "Established credibility",
    useCase: "Serious projects with working products",
  },
  {
    name: "Large Launch",
    marketCapUSD: 50_000,
    description: "High-quality projects",
    useCase: "Established teams, proven concepts",
  },
  {
    name: "Premium Launch",
    marketCapUSD: 100_000,
    description: "Maximum quality signal",
    useCase: "Major projects, institutional interest",
  },
];

/**
 * Calculate buy costs for a given configuration
 */
export function calculateBuyCosts(virtualSol: number, virtualTokens: number, totalSupply: number) {
  const calculateSolForTokens = (tokensAmount: number) => {
    const k = virtualSol * (virtualTokens + totalSupply);
    const remaining = totalSupply - tokensAmount;
    const newSol = k / (virtualTokens + remaining);
    return newSol - virtualSol;
  };

  return {
    buy10Percent: calculateSolForTokens(totalSupply * 0.10),
    buy25Percent: calculateSolForTokens(totalSupply * 0.25),
    buy50Percent: calculateSolForTokens(totalSupply * 0.50),
    buy75Percent: calculateSolForTokens(totalSupply * 0.75),
    buy90Percent: calculateSolForTokens(totalSupply * 0.90),
  };
}

/**
 * Estimate SOL price from real-time data (placeholder - implement actual API call)
 */
export async function getCurrentSolPrice(): Promise<number> {
  // TODO: Implement actual API call to get SOL price
  // For now, return a default value
  return 200; // $200 per SOL
}

/**
 * Validate virtual reserves
 */
export function validateVirtualReserves(
  virtualSol: number,
  virtualTokens: number,
  totalSupply: number
): { valid: boolean; error?: string } {
  if (virtualSol <= 0) {
    return { valid: false, error: "Virtual SOL must be positive" };
  }
  
  if (virtualTokens < 0) {
    return { valid: false, error: "Virtual tokens cannot be negative" };
  }
  
  if (virtualTokens > totalSupply * 100) {
    return { 
      valid: false, 
      error: "Virtual tokens too high - would create extremely low initial price" 
    };
  }
  
  return { valid: true };
}

/**
 * Format large numbers for display
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

/**
 * Get recommended configuration based on market cap
 */
export function getRecommendedConfig(
  targetMarketCapUSD: number,
  solPriceUSD: number = 200
): VirtualReserves & { 
  costs: ReturnType<typeof calculateBuyCosts>;
  warning?: string;
} {
  const totalSupply = 1_000_000_000 * 1_000_000; // 1B with 6 decimals
  
  // Use virtual SOL = 30 as base (pump.fun standard)
  let virtualSol = 30;
  
  const reserves = calculateVirtualReserves(
    targetMarketCapUSD,
    solPriceUSD,
    totalSupply,
    virtualSol
  );
  
  // Validate the configuration
  const validation = validateVirtualReserves(reserves.virtualSol, reserves.virtualTokens, totalSupply);
  
  const costs = calculateBuyCosts(reserves.virtualSol, reserves.virtualTokens, totalSupply);
  
  return {
    ...reserves,
    costs,
    warning: validation.valid ? undefined : validation.error,
  };
}

/**
 * Compare different market cap options
 */
export function compareMarketCapOptions(
  marketCaps: number[],
  solPriceUSD: number = 200
): Array<VirtualReserves & { costs: ReturnType<typeof calculateBuyCosts> }> {
  return marketCaps.map(marketCap => getRecommendedConfig(marketCap, solPriceUSD));
}

