// ---------------------------------------------------------------------------
// AI provider abstraction (default: NVIDIA Nemotron 3 Ultra, OpenAI-compatible
// chat completions). The core app never depends on AI: every action here
// returns { configured: false } when NVIDIA_API_KEY is not set, and the UI
// shows "AI Not Configured" instead of failing.
//
// SAFETY: AI may analyze/summarize/draft/classify/recommend and suggest
// low-risk actions. It never books loads, changes rates, or finalizes
// financial commitments — suggestions go through a human approval step in the
// UI (approve → real mutation; reject → discarded + audited).
// ---------------------------------------------------------------------------

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, mutation, query, ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { audit } from "./lib/audit";
import { requireWrite, Session } from "./lib/context";
import { filterLoadFinancials, filterInvoiceFinancials, getFinancialVisibility, requiresFinancialFiltering } from "./lib/visibility";

const SYSTEM_PROMPT = `You are the operations assistant inside DispatchOS, a freight dispatch management platform used by a solo dispatcher (or small dispatch agency). You help find loads, analyze rates, coordinate trucks/drivers/carriers/brokers, track documents, and manage follow-ups.

Rules:
- Only answer from the tools you have. NEVER invent database facts, load numbers, rates, or statuses.
- Financial figures from tools are already in dollars.
- If data is insufficient or uncertain, say so and recommend a next action instead of guessing.
- Load matching scores are operational recommendations, not legal or HOS certification.
- You may suggest creating a task or drafting a reply, but every such action requires human approval before execution. Do NOT claim an action was already taken when it is only a suggestion.
- Keep answers concise and actionable for a dispatcher.`;

interface ToolDef {
  name: string;
  description: string;
  params: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  { name: "getTrucks", description: "List trucks with availability, location, equipment type.", params: { type: "object", properties: { availability: { type: "string" } } } },
  { name: "getLoads", description: "List loads with status, lane, dates, gross rate, RPM.", params: { type: "object", properties: { status: { type: "string" } } } },
  { name: "getCarriers", description: "List carrier clients with status and fee config.", params: { type: "object", properties: {} } },
  { name: "getDrivers", description: "List drivers with availability and assigned truck.", params: { type: "object", properties: {} } },
  { name: "getBrokers", description: "List brokers with status and risk flag.", params: { type: "object", properties: {} } },
  { name: "getLeads", description: "List carrier leads with status and next follow-up.", params: { type: "object", properties: {} } },
  { name: "getMessages", description: "List messages needing attention (unread / needs reply / urgent).", params: { type: "object", properties: { status: { type: "string" } } } },
  { name: "getTasks", description: "List tasks by status (default: pending).", params: { type: "object", properties: { status: { type: "string" } } } },
  { name: "getInvoices", description: "List dispatcher invoices with outstanding amounts.", params: { type: "object", properties: { status: { type: "string" } } } },
  { name: "getSummary", description: "Current operational and financial summary from the dashboard.", params: { type: "object", properties: {} } },
  { name: "getDailySummary", description: "Plain-text daily operations summary built from real records.", params: { type: "object", properties: {} } },
  { name: "calculateLoad", description: "Calculate RPM, effective RPM, dispatcher fee and carrier amount for a load.", params: { type: "object", properties: { grossRateCents: { type: "number" }, loadedMiles: { type: "number" }, deadheadMiles: { type: "number" }, feeRatePercent: { type: "number" } } } },
  { name: "findMatchingTrucks", description: "Score all trucks against a load (0–100 operational match).", params: { type: "object", properties: { loadId: { type: "string" } }, required: ["loadId"] } },
  { name: "createTask", description: "SUGGEST creating a follow-up task. This is a suggestion only — it requires human approval and is not executed.", params: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, type: { type: "string" }, priority: { type: "string" }, entityType: { type: "string" }, entityId: { type: "string" }, dueAt: { type: "number" } }, required: ["title"] } },
  { name: "createDraftReply", description: "SUGGEST drafting a reply to a message. This is a suggestion only — requires human approval.", params: { type: "object", properties: { messageId: { type: "string" }, instruction: { type: "string" } }, required: ["messageId"] } },
];

async function aiConfig() {
  const env = process.env as Record<string, string | undefined>;
  const baseUrl = (env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  const model = env.NVIDIA_MODEL ?? "nvidia/nemotron-3-ultra";
  return { key: env.NVIDIA_API_KEY, baseUrl, model, configured: !!(env.NVIDIA_API_KEY && env.NVIDIA_BASE_URL && env.NVIDIA_MODEL) };
}

async function chatCompletion(opts: {
  baseUrl: string;
  model: string;
  key: string;
  messages: { role: "system" | "user" | "assistant" | "tool"; content: string; name?: string }[];
  tools?: { type: "function"; function: ToolDef }[];
}) {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.key}` },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      tools: opts.tools,
      tool_choice: opts.tools?.length ? "auto" : undefined,
      temperature: 0.2,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Model request failed (${res.status}).`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
  };
  return data.choices?.[0]?.message ?? { content: null, tool_calls: undefined };
}

async function getSessionForAction(ctx: ActionCtx): Promise<Session> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("You must be signed in.");
  const user = await ctx.runQuery(api.users.currentUser, {});
  if (!user?.orgId) throw new ConvexError("Workspace not ready.");
  return {
    userId,
    orgId: user.orgId,
    role: user.role ?? "read_only",
    name: user.name ?? undefined,
    email: user.email ?? undefined,
    disabled: !!user.disabled,
  };
}

// Compact, permission-scoped views of records for the model (minimum data).
const pick = (obj: Record<string, unknown>, keys: string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  return out;
};

async function runTool(ctx: any, name: string, args: Record<string, unknown>, session?: Session): Promise<{ ok: boolean; summary: string; suggestion?: unknown }> {
  const s = session ?? null;
  let visMode: "full" | "rate_only" | "fee_visible" | "none" | undefined;
  if (s && requiresFinancialFiltering(s.role)) {
    visMode = await getFinancialVisibility(ctx, s.orgId);
  }
  switch (name) {
    case "getTrucks": {
      const rows = await ctx.runQuery(api.trucks.list, { availability: (args.availability as string) || undefined });
      return { ok: true, summary: JSON.stringify(rows.map((t: any) => pick(t, ["unitNumber", "type", "availability", "currentLocation", "carrierId"]))) };
    }
    case "getLoads": {
      const rows = await ctx.runQuery(api.loads.list, { status: (args.status as string) || undefined, limit: 100 });
      return { ok: true, summary: JSON.stringify(rows.map((l: any) => {
        const filtered = s && requiresFinancialFiltering(s.role) && visMode ? filterLoadFinancials(l, visMode) : l;
        return pick(filtered, ["loadNumber", "status", "origin", "destination", "pickupDate", "deliveryDate", "grossRateCents", "rpm", "carrierId", "truckId"]);
      })) };
    }
    case "getCarriers": {
      const rows = await ctx.runQuery(api.carriers.list, {});
      return { ok: true, summary: JSON.stringify(rows.map((c: any) => pick(c, ["companyName", "status", "feeType", "feeRatePercent", "mcNumber"]))) };
    }
    case "getDrivers": {
      const rows = await ctx.runQuery(api.drivers.list, {});
      return { ok: true, summary: JSON.stringify(rows.map((d: any) => pick(d, ["name", "availability", "truckId", "carrierId"]))) };
    }
    case "getBrokers": {
      const rows = await ctx.runQuery(api.brokers.list, {});
      return { ok: true, summary: JSON.stringify(rows.map((b: any) => pick(b, ["company", "status", "riskFlag"]))) };
    }
    case "getLeads": {
      const rows = await ctx.runQuery(api.leads.list, {});
      return { ok: true, summary: JSON.stringify(rows.map((l: any) => pick(l, ["companyName", "status", "source", "nextFollowUpAt", "convertedToCarrierId"]))) };
    }
    case "getMessages": {
      const rows = await ctx.runQuery(api.messages.listConversations, {});
      return { ok: true, summary: JSON.stringify(rows.slice(0, 15).map((c: any) => pick(c, ["title", "entityType", "entityId", "unread", "urgent", "lastMessagePreview"]))) };
    }
    case "getTasks": {
      const rows = await ctx.runQuery(api.tasks.list, { status: (args.status as string) || undefined });
      return { ok: true, summary: JSON.stringify(rows.map((t: any) => pick(t, ["title", "type", "status", "priority", "dueAt", "entityType", "entityId"]))) };
    }
    case "getInvoices": {
      const rows = await ctx.runQuery(api.invoices.list, { status: (args.status as string) || undefined });
      return { ok: true, summary: JSON.stringify(rows.map((i: any) => {
        const filtered = s && requiresFinancialFiltering(s.role) && visMode ? filterInvoiceFinancials(i, visMode) : i;
        return pick(filtered, ["invoiceNumber", "status", "amountCents", "paidCents", "dueDate", "carrierName"]);
      })) };
    }
    case "getSummary": {
      const s = await ctx.runQuery(api.dashboard.summary, {});
      return { ok: true, summary: JSON.stringify({ ops: s.ops, finance: s.finance }) };
    }
    case "getDailySummary": {
      const s = await ctx.runQuery(api.dashboard.summary, {});
      return { ok: true, summary: s.dailySummaryText };
    }
    case "calculateLoad": {
      const r = await ctx.runQuery(api.loads.calculate, {
        grossRateCents: args.grossRateCents as number | undefined,
        loadedMiles: args.loadedMiles as number | undefined,
        deadheadMiles: args.deadheadMiles as number | undefined,
        feeRatePercent: args.feeRatePercent as number | undefined,
      });
      return { ok: true, summary: JSON.stringify(pick(r, ["grossRateCents", "feeCents", "carrierCents", "rpm", "effectiveRpm", "feeMethod"])) };
    }
    case "findMatchingTrucks": {
      const rows = await ctx.runQuery(api.matching.matchTrucks, { loadId: args.loadId as string });
      return { ok: true, summary: JSON.stringify(rows.slice(0, 10).map((r: any) => ({ unitNumber: r.unitNumber, score: r.match.score, tier: r.match.tier, reasons: r.match.reasons, concerns: r.match.concerns }))) };
    }
    case "createTask": {
      return {
        ok: true,
        summary: "Task creation requested — pending human approval.",
        suggestion: { type: "createTask", payload: args },
      };
    }
    case "createDraftReply": {
      return {
        ok: true,
        summary: "Reply drafting requested — pending human approval.",
        suggestion: { type: "draftReply", payload: args },
      };
    }
    default:
      return { ok: false, summary: `Unknown tool: ${name}` };
  }
}

export const config = query({
  args: {},
  handler: async () => {
    const c = await aiConfig();
    return { configured: c.configured, model: c.model };
  },
});

interface ToolCallSummary {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

interface ChatResult {
  configured: boolean;
  reply: string | null;
  toolCalls: ToolCallSummary[];
  suggestedAction: { type: string; payload: Record<string, unknown> } | null;
  conversationId: Id<"aiConversations"> | null;
  error?: boolean;
}

/** Chat with tools. Never executed suggestions — returns them for approval. */
export const chat = action({
  args: {
    conversationId: v.optional(v.id("aiConversations")),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<ChatResult> => {
    const s = await getSessionForAction(ctx);
    const cfg = await aiConfig();
    if (!cfg.configured) {
      return { configured: false, reply: null, toolCalls: [], suggestedAction: null, conversationId: args.conversationId ?? null };
    }
    const text = args.message.trim().slice(0, 8000);
    if (!text) throw new ConvexError("Message is required.");

    let convoId: Id<"aiConversations">;
    if (args.conversationId) {
      convoId = args.conversationId;
    } else {
      convoId = await ctx.runMutation(api.aiInternal.createConversation, { title: text.slice(0, 60) });
    }
    await ctx.runMutation(api.aiInternal.addMessage, { conversationId: convoId, role: "user", content: text });

    const history = await ctx.runQuery(api.aiInternal.getMessages, { conversationId: convoId });
    const messages: { role: "system" | "user" | "assistant" | "tool"; content: string; name?: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-24).map((m: any) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    const toolCalls: ToolCallSummary[] = [];
    let suggestedAction: { type: string; payload: Record<string, unknown> } | null = null;
    let finalContent = "";

    try {
      for (let i = 0; i < 6; i++) {
        const msg = await chatCompletion({
          baseUrl: cfg.baseUrl,
          model: cfg.model,
          key: cfg.key!,
          messages,
          tools: TOOLS.map((t) => ({ type: "function" as const, function: t })),
        });
        if (msg.tool_calls?.length) {
          for (const tc of msg.tool_calls) {
            let parsed: Record<string, unknown> = {};
            try {
              parsed = JSON.parse(tc.function.arguments || "{}");
            } catch {
              parsed = {};
            }
            const result = await runTool(ctx, tc.function.name, parsed, s);
            toolCalls.push({ name: tc.function.name, args: parsed, summary: result.summary.slice(0, 3000) });
            if (result.suggestion) suggestedAction = result.suggestion as { type: string; payload: Record<string, unknown> };
            messages.push({ role: "assistant", content: `[tool: ${tc.function.name}]` });
            messages.push({ role: "tool", content: result.summary.slice(0, 6000), name: tc.function.name });
          }
          continue;
        }
        finalContent = msg.content ?? "";
        break;
      }
    } catch (e) {
      console.error("[ai.chat] model error:", e);
      await ctx.runMutation(api.aiInternal.addMessage, {
        conversationId: convoId,
        role: "assistant",
        content: "AI request failed. Please try again, or use the app's manual tools while AI is unavailable.",
      });
      return { configured: true, reply: "AI request failed. Please try again.", toolCalls, suggestedAction, conversationId: convoId, error: true };
    }      const cleanReply = finalContent || "I don't have enough information to answer that yet. Try asking about trucks, loads, invoices, or tasks.";
    await ctx.runMutation(api.aiInternal.addMessage, {
      conversationId: convoId,
      role: "assistant",
      content: cleanReply,
      toolCalls,
      suggestedAction,
    });
    return { configured: true, reply: cleanReply, toolCalls, suggestedAction, conversationId: convoId };
  },
});

/** Classify an incoming message (category + extraction). Low confidence → human review. */
export const classifyMessage = action({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const s = await getSessionForAction(ctx);
    const cfg = await aiConfig();
    const msg = await ctx.runQuery(api.aiInternal.getMessage, { messageId: args.messageId });
    if (!msg) throw new ConvexError("Message not found.");
    if (!cfg.configured) {
      return { configured: false, category: null, confidence: null, extraction: null };
    }
    const prompt = `Classify this freight dispatch message. Respond ONLY with JSON: {"category": one of ["Load Offer","Rate Negotiation","Rate Confirmation","Pickup Update","Delivery Update","Detention","Layover","TONU","POD Request","Document Request","Schedule Change","Cancellation","General","Unknown"], "confidence": 0-1, "extraction": {"origin": string|null, "destination": string|null, "rateCents": number|null, "equipment": string|null, "weight": number|null, "pickup": ISO date|null, "delivery": ISO date|null, "reference": string|null}}. If unsure, use category "Unknown" with low confidence. Never invent values.\n\nSubject: ${msg.subject ?? ""}\nBody: ${msg.body.slice(0, 4000)}`;
    try {
      const res = await chatCompletion({
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        key: cfg.key!,
        messages: [{ role: "user", content: prompt }],
      });
      const raw = (res.content ?? "").replace(/```json|```/g, "").trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const parsed = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : null;
      const category = parsed?.category ?? "Unknown";
      const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence ?? 0)));
      const extraction = parsed?.extraction ?? null;
      const needsReview = confidence < 0.6 || category === "Unknown";
      await ctx.runMutation(api.aiInternal.saveClassification, {
        messageId: args.messageId,
        category,
        confidence,
        extraction,
        needsReview,
      });
      await ctx.runMutation(api.aiInternal.logAudit, {
        action: "ai.message.classified",
        entity: "message",
        entityId: args.messageId,
        metadata: { category, confidence, needsReview },
      });
      return { configured: true, category, confidence, extraction, needsReview };
    } catch (e) {
      console.error("[ai.classify] error:", e);
      return { configured: true, category: null, confidence: null, extraction: null, error: "Classification failed — please review manually." };
    }
  },
});

/** Draft a reply to a message. Drafts require human approval before sending. */
export const draftReply = action({
  args: { messageId: v.id("messages"), instruction: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const s = await getSessionForAction(ctx);
    const cfg = await aiConfig();
    const msg = await ctx.runQuery(api.aiInternal.getMessage, { messageId: args.messageId });
    if (!msg) throw new ConvexError("Message not found.");
    if (!cfg.configured) return { configured: false, draft: null };

    const prompt = `You are a freight dispatch assistant drafting an OUTBOUND reply on behalf of a dispatcher. The incoming message may be from a broker, carrier, or driver. Write a professional, concise reply. If financial terms appear (rates, detention, TONU), state them clearly but do not invent numbers — only repeat values from the message. If anything is unclear, ask a clarifying question.\n\nIncoming (${msg.direction}):\nSubject: ${msg.subject ?? ""}\n${msg.body.slice(0, 4000)}\n\nInstructions: ${args.instruction ?? "Reply appropriately."}`;
    try {
      const res = await chatCompletion({
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        key: cfg.key!,
        messages: [{ role: "user", content: prompt }],
      });
      const draft = (res.content ?? "").trim();
      await ctx.runMutation(api.aiInternal.saveDraft, { messageId: args.messageId, draft });
      await ctx.runMutation(api.aiInternal.logAudit, { action: "ai.reply.drafted", entity: "message", entityId: args.messageId });
      return { configured: true, draft };
    } catch (e) {
      console.error("[ai.draftReply] error:", e);
      return { configured: true, draft: null, error: "Drafting failed — please write the reply manually." };
    }
  },
});

/** Daily summary via AI; the dashboard falls back to a real-data text summary. */
export const generateDailySummary = action({
  args: {},
  handler: async (ctx) => {
    const s = await getSessionForAction(ctx);
    const cfg = await aiConfig();
    const summary: any = await ctx.runQuery(api.dashboard.summary, {});
    if (!cfg.configured) return { configured: false, text: null };
    try {
      const res = await chatCompletion({
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        key: cfg.key!,
        messages: [
          { role: "system", content: "You write a short, dispatcher-friendly daily summary from real data. 3–6 sentences. No invented numbers." },
          { role: "user", content: `Today's data: ${summary.dailySummaryText}\n\nUpcoming pickups: ${JSON.stringify(summary.upcoming.pickups.slice(0, 5).map((l: any) => ({ loadNumber: l.loadNumber, origin: l.origin, pickupDate: l.pickupDate })))}\n\nWrite the summary.` },
        ],
      });
      return { configured: true, text: res.content ?? null };
    } catch (e) {
      console.error("[ai.generateDailySummary] error:", e);
      return { configured: true, text: null, error: true };
    }
  },
});

/** Human decision on an AI-suggested action. Approve executes; reject discards. */
export const resolveSuggestedAction = mutation({
  args: {
    aiMessageId: v.id("aiMessages"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    edits: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const aiMsg = await ctx.db.get(args.aiMessageId);
    if (!aiMsg || aiMsg.orgId !== s.orgId) throw new ConvexError("AI message not found.");
    if (aiMsg.suggestedStatus === "approved" || aiMsg.suggestedStatus === "rejected") {
      throw new ConvexError("This suggestion has already been decided.");
    }
    const action = aiMsg.suggestedAction as { type?: string; payload?: Record<string, unknown> } | null;
    let executed: Record<string, unknown> = {};
    if (args.decision === "approve" && action?.type === "createTask" && action.payload) {
      const p = action.payload as { title?: string; description?: string; type?: string; priority?: string; entityType?: string; entityId?: string; dueAt?: number };
      const id = await ctx.db.insert("tasks", {
        orgId: s.orgId as never,
        title: String(p.title ?? "AI suggested task").slice(0, 300),
        description: p.description ? String(p.description).slice(0, 4000) : undefined,
        type: "General",
        entityType: p.entityType ? String(p.entityType) : undefined,
        entityId: p.entityId ? String(p.entityId) : undefined,
        status: "Pending",
        priority: p.priority === "Urgent" || p.priority === "High" ? p.priority : "Normal",
        dueAt: typeof p.dueAt === "number" ? p.dueAt : undefined,
        createdBy: s.userId as never,
      });
      executed = { taskId: id };
    }
    await ctx.db.patch(args.aiMessageId, {
      suggestedStatus: args.decision === "approve" ? ("approved" as const) : ("rejected" as const),
      approvedBy: args.decision === "approve" ? (s.userId as never) : undefined,
    });
    await audit(ctx, s, {
      action: args.decision === "approve" ? "ai.action.approved" : "ai.action.rejected",
      entity: "aiMessage",
      entityId: args.aiMessageId,
      metadata: { suggestedAction: action?.type, executed },
    });
    return { ok: true, executed };
  },
});
