/**
 * Multi-RPC Manager
 * Rotates between multiple RPC endpoints to avoid rate limits
 * Provides automatic fallback and load balancing
 */

export interface RPCEndpoint {
  name: string;
  url: string;
  priority: number; // Lower = higher priority
  maxRetries: number;
  lastError?: number; // Timestamp of last error
  errorCount: number;
}

class RPCManager {
  private endpoints: RPCEndpoint[] = [];
  private currentIndex: number = 0;
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private readonly COOLDOWN_PERIOD = 60000; // 1 minute cooldown after errors
  private readonly ERROR_THRESHOLD = 3; // Mark endpoint as problematic after 3 errors
  private readonly RATE_LIMIT_THRESHOLD = 10; // Switch endpoints after 10 requests per minute (ultra-conservative for free tiers)

  constructor() {
    this.initializeEndpoints();
  }

  private initializeEndpoints() {
    const endpoints: RPCEndpoint[] = [];

    // Helius (if configured)
    const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_ENDPOINT;
    if (heliusUrl) {
      endpoints.push({
        name: 'Helius',
        url: heliusUrl,
        priority: 1,
        maxRetries: 2,
        errorCount: 0,
      });
    }

    // Alchemy (if configured)
    const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_RPC_ENDPOINT;
    if (alchemyUrl) {
      endpoints.push({
        name: 'Alchemy',
        url: alchemyUrl,
        priority: 1,
        maxRetries: 2,
        errorCount: 0,
      });
    }

    // QuickNode (if configured)
    const quicknodeUrl = process.env.NEXT_PUBLIC_QUICKNODE_RPC_ENDPOINT;
    if (quicknodeUrl) {
      endpoints.push({
        name: 'QuickNode',
        url: quicknodeUrl,
        priority: 2,
        maxRetries: 2,
        errorCount: 0,
      });
    }

    // Fallback: Use primary RPC endpoint if no specific ones configured
    const primaryRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT;
    if (primaryRpc && !endpoints.some(e => e.url === primaryRpc)) {
      endpoints.push({
        name: 'Primary RPC',
        url: primaryRpc,
        priority: 1,
        maxRetries: 2,
        errorCount: 0,
      });
    }

    // Last resort: Public devnet/mainnet
    if (endpoints.length === 0) {
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
      const publicUrl = network === 'mainnet-beta' 
        ? 'https://api.mainnet-beta.solana.com'
        : 'https://api.devnet.solana.com';
      
      endpoints.push({
        name: 'Public RPC',
        url: publicUrl,
        priority: 10,
        maxRetries: 1,
        errorCount: 0,
      });
      
      console.warn('⚠️ No custom RPC endpoints configured. Using public RPC (rate limited)');
    }

    // Sort by priority
    this.endpoints = endpoints.sort((a, b) => a.priority - b.priority);
    
    console.log('🔗 RPC Manager initialized with endpoints:', 
      this.endpoints.map(e => `${e.name} (priority: ${e.priority})`));
  }

  /**
   * Get the current active endpoint
   */
  getCurrentEndpoint(): string {
    const availableEndpoints = this.getAvailableEndpoints();
    
    if (availableEndpoints.length === 0) {
      // All endpoints are in cooldown, reset and use least problematic
      console.warn('⚠️ All RPC endpoints in cooldown, resetting...');
      this.endpoints.forEach(e => {
        e.lastError = undefined;
        e.errorCount = Math.floor(e.errorCount / 2); // Halve error counts
      });
      return this.endpoints[0].url;
    }

    // Check if we should rotate (rate limit threshold reached)
    const elapsed = Date.now() - this.windowStart;
    if (elapsed < 60000 && this.requestCount >= this.RATE_LIMIT_THRESHOLD) {
      this.rotateEndpoint();
      this.requestCount = 0;
      this.windowStart = Date.now();
    } else if (elapsed >= 60000) {
      // Reset rate limit counter every minute
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
    
    const endpoint = availableEndpoints[this.currentIndex % availableEndpoints.length];
    return endpoint.url;
  }

  /**
   * Get all endpoints that are not in cooldown
   */
  private getAvailableEndpoints(): RPCEndpoint[] {
    const now = Date.now();
    return this.endpoints.filter(endpoint => {
      if (!endpoint.lastError) return true;
      if (endpoint.errorCount < this.ERROR_THRESHOLD) return true;
      return (now - endpoint.lastError) > this.COOLDOWN_PERIOD;
    });
  }

  /**
   * Rotate to the next endpoint
   */
  private rotateEndpoint() {
    const available = this.getAvailableEndpoints();
    if (available.length > 1) {
      this.currentIndex = (this.currentIndex + 1) % available.length;
      console.log(`🔄 Rotating to ${available[this.currentIndex].name}`);
    }
  }

  /**
   * Report an error for the current endpoint
   */
  reportError(error: any) {
    const availableEndpoints = this.getAvailableEndpoints();
    if (availableEndpoints.length === 0) return;

    const endpoint = availableEndpoints[this.currentIndex % availableEndpoints.length];
    endpoint.errorCount++;
    endpoint.lastError = Date.now();

    const is429 = error?.message?.includes('429') || error?.status === 429;
    
    if (is429) {
      console.warn(`⚠️ Rate limit (429) on ${endpoint.name}, rotating...`);
      this.rotateEndpoint();
    } else if (endpoint.errorCount >= this.ERROR_THRESHOLD) {
      console.error(`❌ ${endpoint.name} marked as problematic (${endpoint.errorCount} errors)`);
      this.rotateEndpoint();
    }
  }

  /**
   * Get all configured endpoints for display/debugging
   */
  getAllEndpoints(): RPCEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Get statistics about RPC usage
   */
  getStats() {
    const available = this.getAvailableEndpoints();
    const current = available[this.currentIndex % available.length];
    
    return {
      currentEndpoint: current?.name || 'None',
      totalEndpoints: this.endpoints.length,
      availableEndpoints: available.length,
      requestsThisMinute: this.requestCount,
      endpoints: this.endpoints.map(e => ({
        name: e.name,
        priority: e.priority,
        errorCount: e.errorCount,
        inCooldown: e.lastError && (Date.now() - e.lastError) < this.COOLDOWN_PERIOD,
      })),
    };
  }
}

// Singleton instance
let rpcManagerInstance: RPCManager | null = null;

export function getRPCManager(): RPCManager {
  if (!rpcManagerInstance) {
    rpcManagerInstance = new RPCManager();
  }
  return rpcManagerInstance;
}

// Export a function to get the current RPC endpoint
export function getCurrentRPCEndpoint(): string {
  return getRPCManager().getCurrentEndpoint();
}

// Export a function to report errors
export function reportRPCError(error: any) {
  getRPCManager().reportError(error);
}

// Export a function to get RPC stats
export function getRPCStats() {
  return getRPCManager().getStats();
}

