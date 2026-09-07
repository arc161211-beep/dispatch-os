import { useQuery, useAction } from "convex/react";
import { useParams, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTimezone, useCanWrite } from "@/hooks/use-app";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/dates";
import { PageHeader, StatCard, StatusBadge, KV, LoadingState, EmptyState, SectionCard } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { TruckMap, type TruckMarker } from "@/components/app/TruckMap";
import { ArrowLeft, MapPin, Clock, Truck as TruckIcon, UserRound, Package, Navigation, Gauge, Radio, RadioTower, Cloud } from "lucide-react";
import { WeatherCard } from "@/components/app/WeatherCard";

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
  // Check if any driver is assigned to this truck (drivers have truckId, not the other way around)
  const driversList = useQuery(api.drivers.list, {});
  const assignedDriver = driversList?.find((d: any) => d.truckId === id);

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

      {/* Location & Live Tracking */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="space-y-4">
        <SectionCard
          title="Location & Live Tracking"
          actions={
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/truck-map")}>
              <MapPin className="size-3.5" /> View Full Live Map
            </Button>
          }
        >
          {/* Has GPS coordinates — show map */}
          {latestLocation ? (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${isLive ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#F5A623]/10 text-[#F5A623]"}`}>
                  <span className={`size-1.5 rounded-full ${isLive ? "bg-[#22C55E] animate-pulse" : "bg-[#F5A623]"}`} />
                  {isLive ? "🟢 Live" : "🟡 Last Known Location"}
                </div>
                <span className="text-xs text-muted-foreground">
                  Updated {fmtDateTime(latestLocation.at, tz)}
                </span>
              </div>

              {/* GPS details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <MapPin className="size-3.5 mx-auto text-muted-foreground" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Position</p>
                  <p className="text-xs font-medium font-mono">{latestLocation.lat.toFixed(4)}, {latestLocation.lon.toFixed(4)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <Gauge className="size-3.5 mx-auto text-muted-foreground" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Accuracy</p>
                  <p className="text-xs font-medium">{latestLocation.accuracy != null ? `±${Math.round(latestLocation.accuracy)}m` : "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <Navigation className="size-3.5 mx-auto text-muted-foreground" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Speed</p>
                  <p className="text-xs font-medium">{latestLocation.speed != null ? `${Math.round(latestLocation.speed)} mph` : "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <Clock className="size-3.5 mx-auto text-muted-foreground" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Source</p>
                  <p className="text-xs font-medium">{latestLocation.source?.replace(/_/g, " ") ?? "—"}</p>
                </div>
              </div>

              {/* Single-truck map */}
              <TruckMap
                trucks={[{
                  truckId: truck._id,
                  unitNumber: truck.unitNumber,
                  type: truck.type,
                  lat: latestLocation.lat,
                  lon: latestLocation.lon,
                  location: latestLocation.location,
                  at: latestLocation.at,
                  source: latestLocation.source,
                  accuracy: latestLocation.accuracy,
                  speed: latestLocation.speed,
                  trackingActive: isLive,
                }]}
                height="h-64"
              />
            </div>
          ) : (
            /* No GPS data — clear empty state */
            <div className="py-6">
              {assignedDriver ? (
                <div className="flex flex-col items-center text-center">
                  <div className="size-12 rounded-2xl bg-[#F5A623]/10 flex items-center justify-center mb-3">
                    <Radio className="size-6 text-[#F5A623]" />
                  </div>
                  <p className="text-sm font-semibold">Waiting for {assignedDriver?.name ?? "driver"} to start location sharing</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                    The assigned driver must log into the Driver Portal and select &quot;Start Sharing Location&quot;, then allow browser GPS permission.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                    <UserRound className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold">No driver assigned to this truck</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                    Assign a driver to this truck so they can share their GPS location during transit.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/drivers")}>
                    <UserRound className="size-3.5" /> Manage Drivers
                  </Button>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* Weather at truck location */}
      {latestLocation && (
        <motion.div {...fadeUp} transition={{ delay: 0.14 }}>
          <WeatherCard
            latitude={latestLocation.lat}
            longitude={latestLocation.lon}
            label="🌤️ Current Weather at Truck Location"
            className="max-w-lg"
          />
        </motion.div>
      )}

      {/* Details */}
      <motion.div {...fadeUp} transition={{ delay: 0.16 }} className="grid gap-6 lg:grid-cols-2">
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
