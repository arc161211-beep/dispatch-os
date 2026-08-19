import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useParams, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTimezone } from "@/hooks/use-app";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/dates";
import { statusClass } from "@/lib/status";
import { PageHeader, StatCard, StatusBadge, KV, LoadingState, EmptyState, SectionCard } from "@/components/app/shared";
import { useCanWrite } from "@/hooks/use-app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Clock, Truck as TruckIcon, UserRound, Package, History } from "lucide-react";

export default function TruckDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tz = useTimezone();
  const canWrite = useCanWrite();

  const truckData = useQuery(api.trucks.get, id ? { id: id as Id<"trucks"> } : "skip");
  const locationHistory = useQuery(
    api.location.getHistory,
    id ? { entityType: "truck", entityId: id, limit: 20 } : "skip",
  );
  const latestLocation = useQuery(
    api.location.getLatest,
    id ? { entityType: "truck", entityId: id } : "skip",
  );

  if (!id) return <LoadingState />;
  if (truckData === undefined) return <LoadingState />;

  const truck = truckData?.truck;
  if (!truck) return <EmptyState title="Truck not found" />;

  const carrierName = truckData.carrierName;
  const locationAge = latestLocation ? Date.now() - latestLocation.at : Infinity;
  const isLive = locationAge < 15 * 60 * 1000;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Truck ${truck.unitNumber}`}
        description={carrierName ? `Carrier: ${carrierName}` : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/trucks")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={truck.availability} icon={<TruckIcon className="h-4 w-4" />} tone={truck.availability === "Available" ? "good" : truck.availability === "In Transit" ? "accent" : "default"} />
        <StatCard label="Type" value={truck.type ?? "Not specified"} />
        <StatCard label="Location" value={latestLocation?.location ?? truck.currentLocation ?? "Unknown"} icon={<MapPin className="h-4 w-4" />} />
        <StatCard label="Location Status" value={latestLocation ? (isLive ? "Live" : `Last known — ${fmtTime(latestLocation.at, tz)}`) : "Location unavailable"} icon={<Clock className="h-4 w-4" />} tone={isLive ? "good" : "warn"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Truck Details">
          <div className="space-y-0.5">
            <KV label="Unit Number">{truck.unitNumber}</KV>
            <KV label="Type">{truck.type ?? "—"}</KV>
            <KV label="Make">{truck.make ?? "—"}</KV>
            <KV label="Model">{truck.model ?? "—"}</KV>
            <KV label="Year">{truck.year ?? "—"}</KV>
            <KV label="VIN">{truck.vin ?? "—"}</KV>
            <KV label="Plate">{truck.plate ? `${truck.plate}${truck.plateState ? ` (${truck.plateState})` : ""}` : "—"}</KV>
            <KV label="Trailer">{truck.trailer ?? "—"}</KV>
            <KV label="Max Weight">{truck.maxWeight ? `${truck.maxWeight.toLocaleString()} lbs` : "—"}</KV>
            <KV label="Notes">{truck.notes ?? "—"}</KV>
          </div>
        </SectionCard>

        <SectionCard title="Location History">
          {locationHistory && locationHistory.length > 0 ? (
            <div className="space-y-3">
              {locationHistory.map((loc) => (
                <div key={loc._id} className="flex items-start gap-3 rounded-lg border p-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{loc.location ?? `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(loc.at, tz)}
                      {loc.source ? ` · ${loc.source}` : ""}
                      {loc.accuracy ? ` · ±${loc.accuracy}m` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No location history recorded.</p>
          )}
        </SectionCard>
      </div>

      {truck.notes && (
        <SectionCard title="Notes">
          <p className="text-sm whitespace-pre-wrap">{truck.notes}</p>
        </SectionCard>
      )}
    </div>
  );
}
