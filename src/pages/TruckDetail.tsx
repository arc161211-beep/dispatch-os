import { useQuery } from "convex/react";
import { useParams, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTimezone, useCanWrite } from "@/hooks/use-app";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/dates";
import { PageHeader, StatCard, StatusBadge, KV, LoadingState, EmptyState, SectionCard } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Clock, Truck as TruckIcon, UserRound, Package } from "lucide-react";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

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
    <div className="space-y-6 pb-8">
      {/* Back nav */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/trucks")} className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">Trucks</span>
      </div>

      {/* Hero */}
      <motion.div {...fadeUp} className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/80">
        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4F8CFF]">Truck</span>
                <StatusBadge status={truck.availability} />
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">
                Unit {truck.unitNumber}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {carrierName && <span className="rounded-full bg-[#4F8CFF]/10 px-2 py-0.5 text-[#4F8CFF] font-medium">{carrierName}</span>}
                {truck.type && <span className="rounded-full bg-muted px-2 py-0.5">{truck.type}</span>}
                {truck.year && truck.make && <span className="rounded-full bg-muted px-2 py-0.5">{truck.year} {truck.make} {truck.model ?? ""}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${isLive ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#F5A623]/10 text-[#F5A623]"}`}>
                <span className={`size-1.5 rounded-full ${isLive ? "bg-[#22C55E] animate-pulse" : "bg-[#F5A623]"}`} />
                {isLive ? "Live" : "Stale"}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div {...fadeUp} transition={{ delay: 0.08 }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={truck.availability} icon={<TruckIcon className="size-4" />} tone={truck.availability === "Available" ? "good" : truck.availability === "In Transit" ? "accent" : "default"} />
        <StatCard label="Type" value={truck.type ?? "Not specified"} />
        <StatCard label="Location" value={latestLocation?.location ?? truck.currentLocation ?? "Not set"} icon={<MapPin className="size-4" />} />
        <StatCard label="Location Status" value={latestLocation ? (isLive ? "Live" : `Last known — ${fmtTime(latestLocation.at, tz)}`) : truck.lat != null ? "Location set (no GPS history)" : "Location sharing not started"} icon={<Clock className="size-4" />} tone={latestLocation ? (isLive ? "good" : "warn") : "default"} />
      </motion.div>

      {/* Details */}
      <motion.div {...fadeUp} transition={{ delay: 0.12 }} className="grid gap-6 lg:grid-cols-2">
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
              {locationHistory.map((h) => (
                <div key={h._id} className="flex items-start gap-3">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-[#4F8CFF]" />
                  <div>
                    <p className="text-sm">{h.location ?? `${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}`}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(h.at, tz)} · {h.source ?? "unknown"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<MapPin className="size-5" />} title="No location history" description="Location data will appear when GPS is shared." />
          )}
        </SectionCard>
      </motion.div>
    </div>
  );
}
