import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { CONVERSATION_TYPES, MESSAGE_PRIORITIES, MESSAGE_STATUSES } from "./constants";
import { audit } from "./lib/audit";
import { loadScope, requireOrg, requireWrite } from "./lib/context";
import { reqString } from "./lib/validation";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const listConversations = query({
  args: { status: v.optional(v.union(v.literal("active"), v.literal("archived"))), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    let convos = await ctx.db.query("conversations").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).take(200);
    if (scope.carrierId) convos = convos.filter((c) => !(c.entityType === "carrier" && c.entityId !== scope.carrierId) && c.entityType !== "driver");
    if (scope.driverId) convos = convos.filter((c) => c.entityType === "driver" && c.entityId === scope.driverId);
    if (args.status) convos = convos.filter((c) => c.status === args.status);

    // Per-conversation: fetch only recent messages (bounded) for unread/last message
    const enriched = await Promise.all(convos.map(async (c) => {
      const recentMsgs = await ctx.db.query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .order("desc")
        .take(20); // Only need recent messages for unread count + last message
      const last = recentMsgs[0];
      const unread = recentMsgs.filter((m) => m.status === "unread" || m.status === "needs_reply").length;
      const urgent = recentMsgs.filter((m) => m.priority === "urgent" && (m.status === "unread" || m.status === "needs_reply")).length;
      return {
        ...c,
        lastMessageAt: last?._creationTime ?? c.lastMessageAt ?? c._creationTime,
        lastMessagePreview: last?.body ?? c.lastMessagePreview ?? "",
        lastMessageStatus: last?.status ?? null,
        unread,
        urgent,
        messageCount: recentMsgs.length,
      };
    }));
    enriched.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
    return enriched.slice(0, args.limit ?? 200);
  },
});

export const getConversation = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const scope = loadScope(s);
    const convo = await ctx.db.get(args.id);
    if (!convo || convo.orgId !== s.orgId) throw new ConvexError("Conversation not found.");
    if (scope.driverId && convo.entityId !== scope.driverId) throw new ConvexError("Conversation not found.");
    const messages = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", args.id)).order("asc").take(500);
    return { conversation: convo, messages };
  },
});

export const unreadStats = query({
  args: {},
  handler: async (ctx) => {
    const s = await requireOrg(ctx);
    // Use indexed queries for each status — bounded to prevent unbounded scans
    const unread = await ctx.db.query("messages").withIndex("by_org_status", (q) => q.eq("orgId", s.orgId).eq("status", "unread")).take(200);
    const needsReply = await ctx.db.query("messages").withIndex("by_org_status", (q) => q.eq("orgId", s.orgId).eq("status", "needs_reply")).take(200);
    const allUnread = [...unread, ...needsReply];
    return {
      unread: allUnread.length,
      urgent: allUnread.filter((m) => m.priority === "urgent").length,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const createConversation = mutation({
  args: {
    entityType: v.union(...CONVERSATION_TYPES.map((t) => v.literal(t))),
    entityId: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const label =
      args.title ??
      (args.entityType === "broker"
        ? "Broker conversation"
        : args.entityType === "carrier"
          ? "Carrier conversation"
          : args.entityType === "driver"
            ? "Driver conversation"
            : args.entityType === "lead"
              ? "Lead conversation"
              : "Internal notes");
    const id = await ctx.db.insert("conversations", {
      orgId: s.orgId as never,
      title: label,
      entityType: args.entityType,
      entityId: args.entityId,
      status: "active",
    });
    await audit(ctx, s, { action: "conversation.created", entity: "conversation", entityId: id, metadata: { entityType: args.entityType, entityId: args.entityId } });
    return { id };
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
    direction: v.union(v.literal("in"), v.literal("out")),
    channel: v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms"), v.literal("internal"), v.literal("phone")),
    subject: v.optional(v.string()),
    priority: v.optional(v.union(...MESSAGE_PRIORITIES.map((p) => v.literal(p)))),
    messageRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const convo = await ctx.db.get(args.conversationId);
    if (!convo || convo.orgId !== s.orgId) throw new ConvexError("Conversation not found.");
    const body = reqString(args.body, "Message", 20000);
    const status = args.direction === "in" ? "needs_reply" : "read";
    const id = await ctx.db.insert("messages", {
      orgId: s.orgId as never,
      conversationId: args.conversationId,
      senderId: s.userId as never,
      senderName: s.name,
      direction: args.direction,
      channel: args.channel,
      subject: args.subject,
      body,
      status,
      priority: args.priority ?? "normal",
      messageRef: args.messageRef,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview: body.slice(0, 140),
      status: "active",
    });
    await audit(ctx, s, { action: "message.sent", entity: "message", entityId: id, metadata: { conversationId: args.conversationId, direction: args.direction, channel: args.channel } });
    return { id };
  },
});

export const markRead = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.orgId !== s.orgId) throw new ConvexError("Message not found.");
    if (msg.status === "unread") await ctx.db.patch(args.messageId, { status: "read" });
    return { ok: true };
  },
});

export const setMessageStatus = mutation({
  args: { messageId: v.id("messages"), status: v.union(...MESSAGE_STATUSES.map((m) => v.literal(m))) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.orgId !== s.orgId) throw new ConvexError("Message not found.");
    await ctx.db.patch(args.messageId, { status: args.status });
    await audit(ctx, s, { action: "message.status.changed", entity: "message", entityId: args.messageId, metadata: { to: args.status } });
    return { ok: true };
  },
});

export const setPriority = mutation({
  args: { messageId: v.id("messages"), priority: v.union(...MESSAGE_PRIORITIES.map((p) => v.literal(p))) },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.orgId !== s.orgId) throw new ConvexError("Message not found.");
    await ctx.db.patch(args.messageId, { priority: args.priority });
    return { ok: true };
  },
});

export const markConversationRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const convo = await ctx.db.get(args.conversationId);
    if (!convo || convo.orgId !== s.orgId) throw new ConvexError("Conversation not found.");
    const msgs = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId)).take(500);
    for (const m of msgs) {
      if (m.status === "unread") await ctx.db.patch(m._id, { status: "read" });
    }
    return { ok: true };
  },
});

/** Human approval gate for an AI-drafted reply. Writes a real outbound message. */
export const approveDraftReply = mutation({
  args: { messageId: v.id("messages"), body: v.string(), edited: v.boolean() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const original = await ctx.db.get(args.messageId);
    if (!original || original.orgId !== s.orgId) throw new ConvexError("Message not found.");
    const convo = await ctx.db.get(original.conversationId);
    if (!convo) throw new ConvexError("Conversation not found.");
    const body = reqString(args.body, "Reply", 20000);
    const replyId = await ctx.db.insert("messages", {
      orgId: s.orgId as never,
      conversationId: original.conversationId,
      senderId: s.userId as never,
      senderName: s.name,
      direction: "out",
      channel: convo.entityType === "broker" ? "email" : "internal",
      body,
      status: "read",
      priority: original.priority ?? "normal",
    });
    await ctx.db.patch(original._id, { draftReply: undefined, status: "resolved" });
    await ctx.db.patch(convo._id, { lastMessageAt: Date.now(), lastMessagePreview: body.slice(0, 140) });
    await audit(ctx, s, {
      action: "ai.reply.approved",
      entity: "message",
      entityId: replyId,
      metadata: { originalMessageId: args.messageId, edited: args.edited },
    });
    return { id: replyId };
  },
});

export const archiveConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const convo = await ctx.db.get(args.conversationId);
    if (!convo || convo.orgId !== s.orgId) throw new ConvexError("Conversation not found.");
    await ctx.db.patch(args.conversationId, { status: convo.status === "archived" ? "active" : "archived" });
    return { ok: true };
  },
});
