import "server-only";

// Best-effort in-memory limiter for read endpoints (per server instance).
// Writes are rate limited in the database, which holds across instances.
const buckets = new Map<string, { count: number; reset: number }>();

export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
