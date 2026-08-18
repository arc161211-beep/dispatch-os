import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, LoadingState, EmptyState } from "@/components/app/shared";
import { SelectInput } from "@/components/app/forms";
import { ScrollText } from "lucide-react";
import { fmtDateTime } from "@/lib/dates";
import { useTimezone } from "@/hooks/use-app";

type LogEntry = NonNullable<ReturnType<typeof useQuery<typeof api.auditlog.list>>[number]>;

export default function AuditLog() {
  const tz = useTimezone();
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const logs = useQuery(api.auditlog.list, { action: actionFilter || undefined, entity: entityFilter || undefined, limit: 200 }) as any[] | undefined;

  const uniqueActions = [...new Set((logs ?? []).map((l: any) => l.action))].sort();
  const uniqueEntities = [...new Set((logs ?? []).map((l: any) => l.entity))].sort();

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="System activity trail (admin only)" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SelectInput value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-full sm:w-56">
          <option value="">All actions</option>            {uniqueActions.map((a: string) => <option key={a} value={a}>{a}</option>)}
        </SelectInput>
        <SelectInput value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="w-full sm:w-48">
          <option value="">All entities</option>            {uniqueEntities.map((ent: string) => <option key={ent} value={ent}>{ent}</option>)}
        </SelectInput>
      </div>
      {logs === undefined ? <LoadingState /> : (
        logs.length === 0 ? <EmptyState icon={<ScrollText className="size-6" />} title="No audit entries" description="Actions will appear here as you operate the system." /> : (
          <div className="space-y-0">
            {logs.map((log) => (
              <div key={log._id} className="flex items-start gap-3 border-b py-3">
                <div className="size-2 mt-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-muted-foreground mx-1.5">·</span>
                    <span className="text-muted-foreground">{log.entity}</span>
                    {log.entityId && <span className="text-muted-foreground text-xs ml-1">({log.entityId.slice(0, 8)}…)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.actorName ?? "System"} · {fmtDateTime(log.at, tz)}
                  </p>
                  {log.metadata && (
                    <pre className="mt-1 text-[10px] text-muted-foreground/70 max-w-lg overflow-hidden text-ellipsis">{JSON.stringify(log.metadata)}</pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
