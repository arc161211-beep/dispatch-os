import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, StatCard, SectionCard, StatusBadge, Money, LoadingState, EmptyState } from "@/components/app/shared";
import { Package, Truck, UserRound, Wallet, FileText } from "lucide-react";
import { fmtDate } from "@/lib/dates";
import { useTimezone } from "@/hooks/use-app";

export default function PortalCarrier() {
  const tz = useTimezone();
  const loads = useQuery(api.loads.list, {});
  const trucks = useQuery(api.trucks.list, {});
  const drivers = useQuery(api.drivers.list, {});
  const invoices = useQuery(api.invoices.list, {});

  const activeLoads = (loads ?? []).filter((l) => !["Completed", "Cancelled"].includes(l.status));
  const availableTrucks = (trucks ?? []).filter((t) => t.availability === "Available");
  const availableDrivers = (drivers ?? []).filter((d) => d.availability === "Available");
  const outstanding = (invoices ?? []).reduce((sum, i) => sum + i.outstandingCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Carrier Dashboard" description="Your operations at a glance" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active loads" value={activeLoads.length} icon={<Package className="size-4" />} />
        <StatCard label="Trucks available" value={availableTrucks.length} sub={`${trucks?.length ?? 0} total`} icon={<Truck className="size-4" />} />
        <StatCard label="Drivers available" value={availableDrivers.length} sub={`${drivers?.length ?? 0} total`} icon={<UserRound className="size-4" />} />
        <StatCard label="Outstanding" value={<Money cents={outstanding} />} tone={outstanding > 0 ? "warn" : "good"} icon={<Wallet className="size-4" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Your loads">
          {(loads ?? []).length === 0 ? <p className="text-sm text-muted-foreground py-2">No loads yet.</p> : (
            <div className="divide-y">
              {(loads ?? []).slice(0, 10).map((l) => (
                <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between py-2.5 hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{l.loadNumber}</p>
                    <p className="text-xs text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Your trucks">
          {(trucks ?? []).length === 0 ? <p className="text-sm text-muted-foreground py-2">No trucks registered.</p> : (
            <div className="divide-y">
              {(trucks ?? []).map((t) => (
                <div key={t._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{t.unitNumber}</p>
                    <p className="text-xs text-muted-foreground">{t.type ?? "—"} · {t.currentLocation ?? "No location"}</p>
                  </div>
                  <StatusBadge status={t.availability} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
