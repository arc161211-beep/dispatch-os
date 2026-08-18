import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

/** Health check — never exposes secrets. */
http.route({
  path: "/api/health",
  method: "GET",
  handler: (async (_ctx: any, _request: any) => {
    return new Response(JSON.stringify({ ok: true, service: "dispatchos", time: Date.now() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as never,
});

/**
 * Webhook receipt architecture. No provider is configured by default, so
 * unverified payloads are stored as "unverified" rather than processed.
 * When a provider is configured later, signature verification (HMAC from
 * WEBHOOK_SECRET_<PROVIDER>) must be added here before processing.
 */
http.route({
  path: "/api/webhooks/:provider",
  method: "POST",
  handler: (async (ctx: any, request: any) => {
    const provider = request.params.provider;
    const body = await request.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = body ? JSON.parse(body.slice(0, 10000)) : null;
    } catch {
      // keep null — stored as unverified
    }
    // No provider secret configured yet → record as unverified (never trust).
    try {
      await ctx.runMutation(api.webhooks.logWebhook, {
        provider,
        eventType: parsed && typeof parsed === "object" && "event" in parsed ? String((parsed as { event: unknown }).event) : undefined,
        externalId:
          parsed && typeof parsed === "object" && "id" in parsed
            ? String((parsed as { id: unknown }).id)
            : undefined,
        payloadMeta: parsed && typeof parsed === "object" ? parsed : undefined,
      });
    } catch (e) {
      console.error("[webhooks] store failed:", e);
    }
    return new Response(JSON.stringify({ received: true, verified: false, reason: "No webhook secret configured for this provider." }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }) as never,
});

export default http;
