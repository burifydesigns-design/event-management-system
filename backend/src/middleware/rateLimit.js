const localBuckets = new Map();

function localLimit(key, limit, windowSeconds) {
  const now = Date.now();
  const current = localBuckets.get(key);
  if (!current || current.resetAt <= now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { count: 1, resetAt: now + windowSeconds * 1000 };
  }
  current.count += 1;
  return current;
}

async function distributedLimit(key, windowSeconds) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  const response = await fetch(`${base.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, windowSeconds, 'NX'],
      ['TTL', key],
    ]),
  });
  if (!response.ok) throw new Error(`Rate-limit store returned HTTP ${response.status}`);
  const results = await response.json();
  const count = Number(results?.[0]?.result);
  const ttl = Number(results?.[2]?.result);
  if (!Number.isFinite(count) || count < 1) throw new Error('Rate-limit store returned an invalid counter');
  return { count, resetAt: Date.now() + Math.max(1, ttl) * 1000 };
}

function createRateLimit({ name, limit, windowSeconds }) {
  return async (req, res, next) => {
    const identity = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `event-api:rl:${name}:${identity}`;
    try {
      let bucket = await distributedLimit(key, windowSeconds);
      if (!bucket) {
        if (process.env.NODE_ENV === 'production') {
          return res.status(503).json({ message: 'Rate limiting is not configured. Contact the administrator.' });
        }
        bucket = localLimit(key, limit, windowSeconds);
      }
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
      res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
      if (bucket.count > limit) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))));
        return res.status(429).json({ message: 'Too many requests. Please try again shortly.' });
      }
      return next();
    } catch (error) {
      // Fail closed for authentication and checkout rather than silently disabling protection.
      console.error('Rate-limit store unavailable:', error.message);
      return res.status(503).json({ message: 'Request protection is temporarily unavailable. Please retry shortly.' });
    }
  };
}

module.exports = {
  authRateLimit: createRateLimit({ name: 'auth', limit: 20, windowSeconds: 60 }),
  checkoutRateLimit: createRateLimit({ name: 'checkout', limit: 10, windowSeconds: 60 }),
};
