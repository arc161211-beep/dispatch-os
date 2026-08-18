import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, LoadingState, EmptyState, SectionCard } from "@/components/app/shared";
import { Badge } from "@/components/ui/badge";
import { Plug, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Integrations() {
  const integrations = useQuery(api.integrations.getAll);

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Configure external services" />
      {integrations === undefined ? <LoadingState /> : (
        integrations.length === 0 ? <EmptyState icon={<Plug className="size-6" />} title="No integrations" /> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {integrations.map((int) => (
              <SectionCard key={int.key} title={int.label}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {int.configured ? (
                      <><CheckCircle2 className="size-4 text-emerald-500" /><span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Configured</span></>
                    ) : (
                      <><XCircle className="size-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Not Configured</span></>
                    )}
                  </div>
                  {int.configured && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-transparent">Active</Badge>}
                </div>
                <div className="mt-3 space-y-1">
                  {int.envs.map((env) => (
                    <div key={env} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground">{env}</span>
                      <span className={cn("font-medium", int.configured ? "text-emerald-600" : "text-amber-600")}>{int.configured ? "Set" : "Missing"}</span>
                    </div>
                  ))}
                </div>
                {!int.configured && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Add the required environment variables in your project's Keys/API keys tab to enable this integration.
                  </p>
                )}
              </SectionCard>
            ))}
          </div>
        )
      )}
    </div>
  );
}
