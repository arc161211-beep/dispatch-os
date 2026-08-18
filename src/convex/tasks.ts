import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "./constants";
import { audit } from "./lib/audit";
import { requireOrg, requireWrite } from "./lib/context";
import { optString, reqString, safeDate } from "./lib/validation";

const taskInput = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  type: v.union(...TASK_TYPES.map((t) => v.literal(t))),
  entityType: v.optional(v.string()),
  entityId: v.optional(v.string()),
  priority: v.optional(v.union(...TASK_PRIORITIES.map((p) => v.literal(p)))),
  dueAt: v.optional(v.number()),
  assignedTo: v.optional(v.id("users")),
});

export const list = query({
  args: {
    status: v.optional(v.union(...TASK_STATUSES.map((s) => v.literal(s)))),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    dueFrom: v.optional(v.number()),
    dueTo: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    let tasks = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", s.orgId)).collect();
    if (args.status) tasks = tasks.filter((t) => t.status === args.status);
    if (args.entityType && args.entityId) tasks = tasks.filter((t) => t.entityType === args.entityType && t.entityId === args.entityId);
    if (args.dueFrom !== undefined) tasks = tasks.filter((t) => (t.dueAt ?? 0) >= args.dueFrom!);
    if (args.dueTo !== undefined) tasks = tasks.filter((t) => (t.dueAt ?? 0) <= args.dueTo!);
    tasks.sort((a, b) => {
      const pa = a.status === "Pending" ? 0 : a.status === "In Progress" ? 1 : 2;
      const pb = b.status === "Pending" ? 0 : b.status === "In Progress" ? 1 : 2;
      return pa - pb || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity);
    });
    return tasks.slice(0, args.limit ?? 300);
  },
});

export const create = mutation({
  args: { input: taskInput },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const id = await ctx.db.insert("tasks", {
      orgId: s.orgId as never,
      title: reqString(args.input.title, "Title", 300),
      description: optString(args.input.description, 4000),
      type: args.input.type,
      entityType: args.input.entityType,
      entityId: args.input.entityId,
      status: "Pending",
      priority: args.input.priority ?? "Normal",
      dueAt: safeDate(args.input.dueAt),
      assignedTo: args.input.assignedTo,
      createdBy: s.userId as never,
    });
    await audit(ctx, s, { action: "task.created", entity: "task", entityId: id, metadata: { title: args.input.title, entityType: args.input.entityType } });
    return { id };
  },
});

export const update = mutation({
  args: { id: v.id("tasks"), input: taskInput.partial() },
  handler: async (ctx, args) => {
    const s = await requireWrite(ctx);
    const task = await ctx.db.get(args.id);
    if (!task || task.orgId !== s.orgId) throw new ConvexError("Task not found.");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(args.input)) {
      if (val !== undefined) patch[k] = val;
    }
    await ctx.db.patch(args.id, patch as never);
    await audit(ctx, s, { action: "task.updated", entity: "task", entityId: args.id, metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  },
});

export const setStatus = mutation({
  args: { id: v.id("tasks"), status: v.union(...TASK_STATUSES.map((t) => v.literal(t))) },
  handler: async (ctx, args) => {
    const s = await requireOrg(ctx);
    const task = await ctx.db.get(args.id);
    if (!task || task.orgId !== s.orgId) throw new ConvexError("Task not found.");
    await ctx.db.patch(args.id, {
      status: args.status,
      completedAt: args.status === "Completed" ? Date.now() : undefined,
    });
    await audit(ctx, s, { action: "task.status.changed", entity: "task", entityId: args.id, metadata: { to: args.status } });
    return { ok: true };
  },
});
