import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { TruckMap, type TruckMarker } from "@/components/app/TruckMap";
import { PageHeader } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Radio } from "lucide-react";

const LIVE_THRESHOLD = 15 * 60 * 1000;

export default function TruckMapPage() {
  const navigate = useNavigate();
  const truckLocations = useQuery(api.location.getTruckLocations, {});

  const markers: TruckMarker[] = (truckLocations ?? []).map((t: any) => ({
    truckId: t.truckId,
    unitNumber: t.unitNumber,
    type: t.type,
    driverName: t.driverName,
    availability: t.availability,
    lat: t.lat,
    lon: t.lon,
    location: t.location,
    at: t.at,
    source: t.source,
    accuracy: t.accuracy,
    speed: t.speed,
    trackingActive: t.trackingActive,
  }));

  const liveCount = markers.filter((m) => Date.now() - m.at < LIVE_THRESHOLD).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/trucks")} className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">Trucks</span>
      </div>

      <PageHeader
        title="Live Truck Map"
        description={`${markers.length} truck${markers.length !== 1 ? "s" : ""} with GPS · ${liveCount} live`}
      />

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <TruckMap
          trucks={markers}
          height="h-[calc(100vh-180px)]"
          emptyState={
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <Radio className="size-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No truck locations available yet</p>
              <p className="mt-1.5 text-xs text-muted-foreground/70 max-w-sm">
                Truck positions appear here when drivers log into the Driver Portal, select
                &quot;Start Sharing Location&quot;, and allow browser GPS permission.
              </p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => navigate("/trucks")}>
                View All Trucks
              </Button>
            </div>
          }
          onTruckClick={(truck) => navigate(`/trucks/${truck.truckId}`)}
        />
      </div>
    </div>
  );
}
