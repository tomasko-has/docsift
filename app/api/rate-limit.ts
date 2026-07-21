// Simple in-memory rate limiter.
// Tracks request timestamps per IP and rejects requests that exceed the limit.
// Resets on server restart — fine for a small app. For production at scale
// you'd use Redis or a similar external store.

const MAX_REQUESTS = 10; // max requests per window
const WINDOW_MS = 60_000; // 1-minute window

// Map of IP address → array of request timestamps (within the current window)
const hits = new Map<string, number[]>();

/**
 * Check whether a request should be allowed.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
 */
export function checkRateLimit(request: Request): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get existing timestamps and drop any that are outside the window
  const timestamps = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
    // Oldest timestamp in the window tells us when the window will free a slot
    const retryAfterMs = timestamps[0] + WINDOW_MS - now;
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  hits.set(ip, timestamps);
  return { allowed: true };
}

/** Build a standard 429 response. */
export function rateLimitResponse(retryAfterMs: number) {
  return Response.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    }
  );
}
