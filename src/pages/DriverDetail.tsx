import { useQuery } from "convex/react";
import { useParams, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTimezone } from "@/hooks/use-app";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/dates";
import { PageHeader, StatCard, StatusBadge, KV, LoadingState, EmptyState, SectionCard } from "@/components/app/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Clock, UserRound, Truck as TruckIcon, Calendar } from "lucide-react";

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
    <div className="space-y-6">
      <PageHeader
        title={driver.name}
        description={carrierName ? `Carrier: ${carrierName}` : undefined}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/drivers")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={driver.availability} icon={<UserRound className="h-4 w-4" />} tone={driver.availability === "Available" ? "good" : "default"} />
        <StatCard label="Phone" value={driver.phone ?? "Not on file"} />
        <StatCard label="Location" value={latestLocation?.location ?? driver.currentLocation ?? "Unknown"} icon={<MapPin className="h-4 w-4" />} />
        <StatCard label="Location Status" value={latestLocation ? (isLive ? "Live" : `Last known — ${fmtTime(latestLocation.at, tz)}`) : "Location unavailable"} icon={<Clock className="h-4 w-4" />} tone={isLive ? "good" : "warn"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
                <span className={licenseExpiring ? "text-amber-600 dark:text-amber-400" : ""}>
                  {fmtDate(driver.licenseExpiry, tz)}
                  {licenseExpiring && <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-600">Expiring</Badge>}
                </span>
              ) : "—"}
            </KV>
            <KV label="Medical Card Expiry">
              {driver.medicalCardExpiry ? (
                <span className={medicalExpiring ? "text-amber-600 dark:text-amber-400" : ""}>
                  {fmtDate(driver.medicalCardExpiry, tz)}
                  {medicalExpiring && <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-600">Expiring</Badge>}
                </span>
              ) : "—"}
            </KV>
          </div>
        </SectionCard>
      </div>

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

      {driver.notes && (
        <SectionCard title="Notes">
          <p className="text-sm whitespace-pre-wrap">{driver.notes}</p>
        </SectionCard>
      )}
    </div>
  );
}
