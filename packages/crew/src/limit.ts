/**
 * A per-visitor speed bump for the public demo, so one tab can't drain the model credits.
 * In-memory per function instance: it slows abuse, it is not a security boundary.
 */
export interface Limiter { allow(key: string, now?: number): boolean }

export function rateLimit(max: number, windowMs: number): Limiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) hits.delete(hits.keys().next().value!);
      return true;
    },
  };
}

export function visitor(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}
