import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { PageHeader, StatusBadge, Money, SectionCard, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { useTimezone } from "@/hooks/use-app";
import { Package, Truck, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type LoadType = any;

export default function PortalDriver() {
  const { user } = useAuth();
  const tz = useTimezone();
  const loads = useQuery(api.loads.list, {});
  const setStatus = useMutation(api.loads.setStatus);
  const [updating, setUpdating] = useState<string | null>(null);

  const myLoads = (loads ?? []).filter((l) => l.status !== "Completed" && l.status !== "Cancelled");
  const activeLoad = myLoads.find((l) => ["In Transit", "At Delivery", "Loaded", "At Pickup", "Loading"].includes(l.status));
  const upcomingLoads = myLoads.filter((l) => l._id !== activeLoad?._id);

  const handleStatus = async (loadId: string, status: string) => {
    setUpdating(loadId);
    try { await setStatus({ id: loadId as any, status: status as any }); toast.success(`Status → ${status}`); } catch (e) { toast.error(errorMessage(e)); }
    setUpdating(null);
  };

  const operationalTransitions: Record<string, string[]> = {
    "At Pickup": ["Loading"],
    Loading: ["Loaded"],
    Loaded: ["In Transit"],
    "In Transit": ["At Delivery"],
    "At Delivery": ["Delivered"],
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user?.name ?? "Driver"}`} description="Your driver portal" />

      {activeLoad && (
        <SectionCard title="Current load" description="Active assignment">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Link to={`/loads/${activeLoad._id}`} className="text-lg font-semibold hover:underline">{activeLoad.loadNumber}</Link>
                <p className="text-sm text-muted-foreground">{activeLoad.origin ?? "?"} → {activeLoad.destination ?? "?"}</p>
              </div>
              <StatusBadge status={activeLoad.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Pickup:</span> {fmtDateTime(activeLoad.pickupDate, tz)}</div>
              <div><span className="text-muted-foreground">Delivery:</span> {fmtDateTime(activeLoad.deliveryDate, tz)}</div>
              <div><span className="text-muted-foreground">Equipment:</span> {activeLoad.equipment ?? "—"}</div>
              <div><span className="text-muted-foreground">Commodity:</span> {activeLoad.commodity ?? "—"}</div>
            </div>
            {operationalTransitions[activeLoad.status] && (
              <div className="flex gap-2 pt-2">
                {operationalTransitions[activeLoad.status].map((s) => (
                  <Button key={s} size="sm" onClick={() => handleStatus(activeLoad._id, s)} disabled={updating === activeLoad._id} className="gap-1.5">
                    <CheckCircle2 className="size-3.5" /> {s}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {!activeLoad && myLoads.length === 0 && (
        <EmptyState icon={<Package className="size-6" />} title="No active loads" description="You don't have any assigned loads right now." />
      )}

      {upcomingLoads.length > 0 && (
        <SectionCard title="Upcoming loads">
          <div className="divide-y">
            {upcomingLoads.map((l) => (
              <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between py-3 hover:bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{l.loadNumber}</p>
                  <p className="text-xs text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                  <p className="text-xs text-muted-foreground">Pickup: {fmtDate(l.pickupDate, tz)}</p>
                </div>
                <StatusBadge status={l.status} />
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
