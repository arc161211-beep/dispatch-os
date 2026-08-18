// Audit logging helper. Every sensitive operation must record an audit entry.
// Audit history is append-only: there is no mutation that deletes or edits
// auditLogs rows (enforced by the absence of such a function).

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Session } from "./context";

export interface AuditArgs {
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  /** Override org scope (e.g., during provisioning when org was just created). */
  orgId?: string;
  actorId?: Id<"users">;
  actorName?: string;
}

export async function audit(ctx: MutationCtx, s: Session | null, args: AuditArgs) {
  await ctx.db.insert("auditLogs", {
    orgId: (args.orgId ?? s?.orgId ?? "") as never,
    actorId: args.actorId ?? s?.userId ?? undefined,
    actorName: args.actorName ?? s?.name ?? undefined,
    action: args.action,
    entity: args.entity,
    entityId: args.entityId ?? undefined,
    metadata: args.metadata ?? undefined,
    at: Date.now(),
  });
}
