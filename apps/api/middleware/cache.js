/**
 * In-Memory Caching Middleware for DroneFood API
 *
 * Provides sub-millisecond responses for read-heavy public endpoints.
 * Includes LRU eviction (max 500 items) and prefix-based cache invalidation.
 */

const MAX_CACHE_ITEMS = 500;
const cacheStore = new Map();

/**
 * Cache middleware with TTL in seconds.
 *
 * @param {number} ttlSeconds - Time-To-Live in seconds (default: 30s)
 */
export const cacheMiddleware = (ttlSeconds = 30) => {
  const ttlMs = ttlSeconds * 1000;

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    // Skip cache if explicitly requested via headers (e.g., Cache-Control: no-cache)
    if (req.headers["cache-control"] === "no-cache") {
      res.setHeader("X-Cache", "BYPASS");
      return next();
    }

    const key = req.originalUrl || req.url;
    const now = Date.now();
    const cached = cacheStore.get(key);

    if (cached) {
      if (cached.expiresAt > now) {
        // Cache Hit: re-insert key to maintain LRU freshness
        cacheStore.delete(key);
        cacheStore.set(key, cached);

        res.setHeader("X-Cache", "HIT");
        return res.status(cached.status).json(cached.body);
      }
      // Expired: remove
      cacheStore.delete(key);
    }

    res.setHeader("X-Cache", "MISS");

    // Intercept res.json to capture response body
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful 200 responses
      if (res.statusCode === 200) {
        // LRU eviction if full
        if (cacheStore.size >= MAX_CACHE_ITEMS) {
          const oldestKey = cacheStore.keys().next().value;
          if (oldestKey) cacheStore.delete(oldestKey);
        }

        cacheStore.set(key, {
          status: res.statusCode,
          body,
          expiresAt: now + ttlMs,
        });
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Clear cached entries by URL prefix.
 *
 * @param {string} prefix - URL prefix to invalidate (e.g., "/api/food", "/api/restaurant")
 */
export const clearCache = (prefix) => {
  if (!prefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
};
