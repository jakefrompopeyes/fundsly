/**
 * Simple in-memory cache for RPC responses
 * Reduces redundant calls when navigating between pages
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class RPCCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 30000; // 30 seconds default
  
  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string, ttl: number = this.DEFAULT_TTL): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    if (age > ttl) {
      // Expired, remove from cache
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Store data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Clear a specific key or all cache
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(ttl: number = this.DEFAULT_TTL): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > ttl) {
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
let cacheInstance: RPCCache | null = null;

export function getRPCCache(): RPCCache {
  if (!cacheInstance) {
    cacheInstance = new RPCCache();
    
    // Run cleanup every 5 minutes
    if (typeof window !== 'undefined') {
      setInterval(() => {
        cacheInstance?.cleanup();
      }, 5 * 60 * 1000);
    }
  }
  return cacheInstance;
}

/**
 * Helper function to wrap RPC calls with caching
 * Usage: const data = await withCache('key', ttl, () => fetchData())
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cache = getRPCCache();
  
  // Try to get from cache first
  const cached = cache.get<T>(key, ttl);
  if (cached !== null) {
    console.log(`✅ Cache hit: ${key}`);
    return cached;
  }
  
  // Fetch fresh data
  console.log(`🔄 Cache miss: ${key}`);
  const data = await fetcher();
  
  // Store in cache
  cache.set(key, data);
  
  return data;
}

