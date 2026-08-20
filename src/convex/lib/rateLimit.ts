// ---------------------------------------------------------------------------
// Application-level rate limiting for DispatchOS.
//
// SECURITY: This provides defense-in-depth against OTP spam, brute force,
// and abuse of sensitive mutations. It complements any rate limiting already
// present in the Convex Auth / Freebuff platform layer.
//
// Implementation: uses a lightweight in-memory store keyed by identifier.
// This is NOT a replacement for platform-level rate limiting — it's an
// additional safety net. Convex actions run in a stateless environment, so
// this rate limiter is per-instance and best-effort.
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

/** Cleanup old entries every 5 minutes to prevent memory leaks. */
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - 60 * 60 * 1000; // remove entries older than 1 hour
  for (const [key, entry] of store) {
    if (entry.windowStart < cutoff) store.delete(key);
  }
}

/**
 * Check and enforce a rate limit.
 *
 * @param key - Unique identifier (e.g., email address or IP)
 * @param maxAttempts - Maximum attempts allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, retryAfterMs: number } — if not allowed,
 *   retryAfterMs tells the caller when they can try again.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Get the current attempt count for a key (for diagnostics/logging).
 */
export function getAttemptCount(key: string): number {
  return store.get(key)?.count ?? 0;
}

/**
 * Reset the rate limit for a key (e.g., after successful verification).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

// ---------------------------------------------------------------------------
// Preset rate limit configurations for common scenarios
// ---------------------------------------------------------------------------

/** OTP send: max 5 requests per 10 minutes per email */
export const OTP_SEND_LIMIT = { maxAttempts: 5, windowMs: 10 * 60 * 1000 };

/** OTP verify: max 10 attempts per 15 minutes per email */
export const OTP_VERIFY_LIMIT = { maxAttempts: 10, windowMs: 15 * 60 * 1000 };

/** Provisioning: max 3 attempts per 5 minutes per IP/session */
export const PROVISION_LIMIT = { maxAttempts: 3, windowMs: 5 * 60 * 1000 };

/** Invitation creation: max 20 per hour per admin */
export const INVITE_LIMIT = { maxAttempts: 20, windowMs: 60 * 60 * 1000 };
