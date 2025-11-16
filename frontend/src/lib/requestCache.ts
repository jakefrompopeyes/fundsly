/**
 * Simple in-memory cache for RPC requests
 * Helps reduce duplicate requests and stay within free tier rate limits
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class RequestCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 30000; // 30 seconds default TTL

  /**
   * Get cached data if still valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    console.log(`✅ Cache HIT for key: ${key.substring(0, 50)}...`);
    return entry.data as T;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const timeToLive = ttl || this.DEFAULT_TTL;
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + timeToLive,
    });

    console.log(`💾 Cache SET for key: ${key.substring(0, 50)}... (TTL: ${timeToLive}ms)`);
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    
    return {
      totalEntries: this.cache.size,
      validEntries: entries.filter(e => now <= e.expiresAt).length,
      expiredEntries: entries.filter(e => now > e.expiresAt).length,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }
}

// Singleton instance
let cacheInstance: RequestCache | null = null;

export function getRequestCache(): RequestCache {
  if (!cacheInstance) {
    cacheInstance = new RequestCache();
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      cacheInstance?.cleanup();
    }, 5 * 60 * 1000);
  }
  return cacheInstance;
}

/**
 * Helper to create cache key for RPC requests
 */
export function createCacheKey(method: string, params: any[]): string {
  return `${method}:${JSON.stringify(params)}`;
}

/**
 * Wrapper for cached RPC calls
 */
export async function cachedRPCCall<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cache = getRequestCache();
  
  // Try to get from cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();
  
  // Store in cache
  cache.set(key, data, ttl);
  
  return data;
}


