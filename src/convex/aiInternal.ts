import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { requireOrg } from "./lib/context";

export const createConversation = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    return ctx.db.insert("aiConversations", {
      orgId: s.orgId as never,
      userId: s.userId as never,
      title: args.title?.slice(0, 120),
      createdAt: Date.now(),
    });
  },
});

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    const rows = await ctx.db.query("aiConversations").withIndex("by_org_user_recent", (q) => q.eq("orgId", s.orgId).eq("userId", s.userId)).order("desc").take(50);
    // Count messages per conversation using bounded per-conversation queries
    const enriched = await Promise.all(rows.map(async (c) => {
      const msgs = await ctx.db.query("aiMessages").withIndex("by_conversation", (q) => q.eq("conversationId", c._id)).take(200);
      return { ...c, messageCount: msgs.length };
    }));
    return enriched;
  },
});

export const getMessages = query({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const convo = await ctx.db.get(args.conversationId);
    if (!convo || convo.orgId !== s.orgId) throw new ConvexError("Conversation not found.");
    return ctx.db.query("aiMessages").withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId)).order("asc").take(200);
  },
});

export const addMessage = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.object({ name: v.string(), args: v.optional(v.any()), summary: v.optional(v.string()) }))),
    suggestedAction: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const convo = await ctx.db.get(args.conversationId);
    if (!convo || convo.orgId !== s.orgId) throw new ConvexError("Conversation not found.");
    return ctx.db.insert("aiMessages", {
      orgId: s.orgId as never,
      conversationId: args.conversationId,
      role: args.role,
      content: args.content.slice(0, 20000),
      toolCalls: args.toolCalls,
      suggestedAction: args.suggestedAction,
      suggestedStatus: args.suggestedAction ? "pending" : undefined,
      createdAt: Date.now(),
    });
  },
});

export const getMessage = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.orgId !== s.orgId) throw new ConvexError("Message not found.");
    return msg;
  },
});

export const saveClassification = mutation({
  args: {
    messageId: v.id("messages"),
    category: v.string(),
    confidence: v.number(),
    extraction: v.optional(v.any()),
    needsReview: v.boolean(),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.orgId !== s.orgId) throw new ConvexError("Message not found.");
    await ctx.db.patch(args.messageId, {
      aiCategory: args.category as never,
      aiCategoryConfidence: args.confidence,
      aiExtraction: args.extraction,
      needsReview: args.needsReview,
    });
    return { ok: true };
  },
});

export const saveDraft = mutation({
  args: { messageId: v.id("messages"), draft: v.string() },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.orgId !== s.orgId) throw new ConvexError("Message not found.");
    await ctx.db.patch(args.messageId, { draftReply: args.draft.slice(0, 20000) });
    return { ok: true };
  },
});

/** Audit logging for AI actions (called from actions via runMutation). */
export const logAudit = mutation({
  args: {
    action: v.string(),
    entity: v.string(),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    await audit(ctx, s, {
      action: args.action,
      entity: args.entity,
      entityId: args.entityId,
      metadata: args.metadata ?? undefined,
    });
    return { ok: true };
  },
});
