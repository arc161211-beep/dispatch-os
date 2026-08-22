import { useQuery } from "convex/react";
import { useParams, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTimezone } from "@/hooks/use-app";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/dates";
import { PageHeader, StatCard, StatusBadge, KV, LoadingState, EmptyState, SectionCard } from "@/components/app/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Clock, UserRound, Truck as TruckIcon, Calendar } from "lucide-react";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tz = useTimezone();

  const driverData = useQuery(api.drivers.get, id ? { id: id as Id<"drivers"> } : "skip");
  const locationHistory = useQuery(
    api.location.getHistory,
    id ? { entityType: "driver", entityId: id, limit: 20 } : "skip",
  );
  const latestLocation = useQuery(
    api.location.getLatest,
    id ? { entityType: "driver", entityId: id } : "skip",
  );

  if (!id) return <LoadingState />;
  if (driverData === undefined) return <LoadingState />;

  const driver = driverData?.driver;
  if (!driver) return <EmptyState title="Driver not found" />;

  const carrierName = driverData.carrierName;
  const locationAge = latestLocation ? Date.now() - latestLocation.at : Infinity;
  const isLive = locationAge < 15 * 60 * 1000;

  const today = Date.now();
  const licenseExpiring = driver.licenseExpiry && driver.licenseExpiry < today + 30 * 86_400_000;
  const medicalExpiring = driver.medicalCardExpiry && driver.medicalCardExpiry < today + 30 * 86_400_000;

  return (
    <div className="space-y-6 pb-8">
      {/* Back nav */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/drivers")} className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">Drivers</span>
      </div>

      {/* Hero */}
      <motion.div {...fadeUp} className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/80">
        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4F8CFF]">Driver</span>
                <StatusBadge status={driver.availability} />
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">{driver.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {carrierName && <span className="rounded-full bg-[#4F8CFF]/10 px-2 py-0.5 text-[#4F8CFF] font-medium">{carrierName}</span>}
                {driver.phone && <span className="rounded-full bg-muted px-2 py-0.5">{driver.phone}</span>}
                {driver.email && <span className="rounded-full bg-muted px-2 py-0.5">{driver.email}</span>}
                {driver.homeLocation && <span className="rounded-full bg-muted px-2 py-0.5">Home: {driver.homeLocation}</span>}
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
        <StatCard label="Status" value={driver.availability} icon={<UserRound className="size-4" />} tone={driver.availability === "Available" ? "good" : "default"} />
        <StatCard label="Phone" value={driver.phone ?? "Not on file"} />
        <StatCard label="Location" value={latestLocation?.location ?? driver.currentLocation ?? "Unknown"} icon={<MapPin className="size-4" />} />
        <StatCard label="Location Status" value={latestLocation ? (isLive ? "Live" : `Last known — ${fmtTime(latestLocation.at, tz)}`) : "Location unavailable"} icon={<Clock className="size-4" />} tone={isLive ? "good" : "warn"} />
      </motion.div>

      {/* Details */}
      <motion.div {...fadeUp} transition={{ delay: 0.12 }} className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Driver Details">
          <div className="space-y-0.5">
            <KV label="Name">{driver.name}</KV>
            <KV label="Phone">{driver.phone ?? "—"}</KV>
            <KV label="Email">{driver.email ?? "—"}</KV>
            <KV label="Home Location">{driver.homeLocation ?? "—"}</KV>
            <KV label="Current Location">{driver.currentLocation ?? "—"}</KV>
          </div>
        </SectionCard>

        <SectionCard title="Credentials">
          <div className="space-y-0.5">
            <KV label="License Expiry">
              {driver.licenseExpiry ? (
                <span className={licenseExpiring ? "text-[#F5A623]" : ""}>
                  {fmtDate(driver.licenseExpiry, tz)}
                  {licenseExpiring && <Badge variant="outline" className="ml-2 bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20 text-[10px]">Expiring</Badge>}
                </span>
              ) : "—"}
            </KV>
            <KV label="Medical Card Expiry">
              {driver.medicalCardExpiry ? (
                <span className={medicalExpiring ? "text-[#F5A623]" : ""}>
                  {fmtDate(driver.medicalCardExpiry, tz)}
                  {medicalExpiring && <Badge variant="outline" className="ml-2 bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20 text-[10px]">Expiring</Badge>}
                </span>
              ) : "—"}
            </KV>
          </div>
        </SectionCard>
      </motion.div>

      {/* Location History */}
      <motion.div {...fadeUp} transition={{ delay: 0.16 }}>
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
