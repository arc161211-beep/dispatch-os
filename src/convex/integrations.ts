import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { INTEGRATION_PROVIDERS } from "./constants";
import { audit } from "./lib/audit";
import { requireAdmin, requireOrg } from "./lib/context";

/**
 * Reports which providers are configured based on server-side environment
 * variables. Only booleans + model names are exposed — never secrets.
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const stored = await ctx.db.query("integrations").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    const env = process.env as Record<string, string | undefined>;
    return INTEGRATION_PROVIDERS.map((p) => {
      const configured = p.envs.some((e: string) => !!env[e]);
      const record = stored.find((i) => i.provider === p.key);
      return {
        key: p.key,
        label: p.label,
        envs: p.envs,
        configured,
        config: record?.config ?? null,
        updatedAt: record?.updatedAt ?? null,
      };
    });
  },
});

export const getAiConfig = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const env = process.env as Record<string, string | undefined>;
    const configured = !!(env.NVIDIA_API_KEY && env.NVIDIA_BASE_URL && env.NVIDIA_MODEL);
    return {
      configured,
      model: env.NVIDIA_MODEL ?? "nvidia/nemotron-3-ultra",
      baseUrl: env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    };
  },
});

/** Store non-secret provider configuration (display name, from address, etc.). */
export const updateConfig = mutation({
  args: {
    provider: v.string(),
    config: v.optional(v.any()),
    status: v.optional(v.union(v.literal("not_configured"), v.literal("configured"), v.literal("error"))),
  },
  handler: async (ctx, args) => {
    const s = await requireAdmin(ctx);
    const existing = await ctx.db.query("integrations").withIndex("by_org_provider", (q) =>
      q.eq("orgId", s.orgId).eq("provider", args.provider),
    ).first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        config: args.config ?? existing.config,
        status: args.status ?? existing.status,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("integrations", {
        orgId: s.orgId as never,
        provider: args.provider,
        name: args.provider,
        status: args.status ?? "not_configured",
        config: args.config,
        updatedAt: Date.now(),
      });
    }
    await audit(ctx, s, { action: "integration.config.updated", entity: "integration", metadata: { provider: args.provider } });
    return { ok: true };
  },
});
