import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// ---------------------------------------------------------------------------
// Webhook HMAC verification using Web Crypto API (available in all runtimes).
// ---------------------------------------------------------------------------
async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Security headers for all responses. */
function securityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.convex.cloud https://*.convex.site; frame-ancestors 'none';",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-XSS-Protection": "1; mode=block",
  };
}

/** Health check — never exposes secrets. */
http.route({
  path: "/api/health",
  method: "GET",
  handler: (async (_ctx: any, _request: any) => {
    return new Response(JSON.stringify({ ok: true, service: "dispatchos", time: Date.now() }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...securityHeaders() },
    });
  }) as never,
});

/**
 * Webhook receipt with HMAC signature verification.
 * When WEBHOOK_SECRET_<PROVIDER> is set in env, the webhook must include
 * a valid HMAC-SHA256 signature in the X-Signature header.
 * Without a configured secret, webhooks are stored as "unverified".
 */
http.route({
  path: "/api/webhooks/:provider",
  method: "POST",
  handler: (async (ctx: any, request: any) => {
    const provider = request.params.provider;
    const body = await request.text().catch(() => "");
    const signature =
      request.headers?.get?.("x-signature") ??
      request.headers?.get?.("x-hub-signature-256") ??
      null;

    let parsed: unknown = null;
    try {
      parsed = body ? JSON.parse(body.slice(0, 10000)) : null;
    } catch {
      // keep null — stored as unverified
    }

    // Check for provider webhook secret
    const env = process.env as Record<string, string | undefined>;
    const secretKey = `WEBHOOK_SECRET_${provider.toUpperCase()}`;
    const secret = env[secretKey];

    let verified = false;
    if (secret && signature) {
      const expected = `sha256=${await hmacSha256Hex(secret, body)}`;
      try {
        verified = constantTimeCompare(signature, expected);
      } catch {
        verified = false;
      }
    }

    let duplicated = false;
    try {
      const result = await ctx.runMutation(api.webhooks.logWebhook, {
        provider,
        eventType:
          parsed && typeof parsed === "object" && "event" in parsed
            ? String((parsed as { event: unknown }).event)
            : undefined,
        externalId:
          parsed && typeof parsed === "object" && "id" in parsed
            ? String((parsed as { id: unknown }).id)
            : undefined,
        payloadMeta: parsed && typeof parsed === "object" ? parsed : undefined,
        verified,
      });
      duplicated = result?.duplicated ?? false;
    } catch (e) {
      console.error("[webhooks] store failed:", e);
    }

    return new Response(
      JSON.stringify({
        received: true,
        verified,
        duplicated,
        reason: verified
          ? "Signature verified."
          : !secret
            ? "No webhook secret configured for this provider — stored as unverified."
            : "Invalid or missing signature — stored as unverified.",
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json", ...securityHeaders() },
      },
    );
  }) as never,
});

export default http;
