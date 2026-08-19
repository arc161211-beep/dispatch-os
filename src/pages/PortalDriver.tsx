import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AIAssistant } from "@/components/app/AIAssistant";
import { PageHeader, StatusBadge, SectionCard, EmptyState, errorMessage } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { useTimezone } from "@/hooks/use-app";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Package,
  MapPin,
  CheckCircle2,
  Truck,
  FileText,
  Navigation,
  Clock,
  Phone,
  ChevronRight,
  Upload,
  Share2,
  Loader2,
} from "lucide-react";

type LoadType = any;

const OPERATIONAL_TRANSITIONS: Record<string, { status: string; label: string; icon: typeof Package; color: string }[]> = {
  "Booked": [{ status: "Driver Notified", label: "Notified", icon: CheckCircle2, color: "bg-blue-600 hover:bg-blue-700" }],
  "Driver Notified": [{ status: "At Pickup", label: "Arrived Pickup", icon: MapPin, color: "bg-amber-600 hover:bg-amber-700" }],
  "At Pickup": [{ status: "Loading", label: "Loading", icon: Package, color: "bg-indigo-600 hover:bg-indigo-700" }],
  "Loading": [{ status: "Loaded", label: "Loaded", icon: CheckCircle2, color: "bg-emerald-600 hover:bg-emerald-700" }],
  "Loaded": [{ status: "In Transit", label: "In Transit", icon: Navigation, color: "bg-violet-600 hover:bg-violet-700" }],
  "In Transit": [{ status: "At Delivery", label: "Arrived Delivery", icon: MapPin, color: "bg-amber-600 hover:bg-amber-700" }],
  "At Delivery": [{ status: "Delivered", label: "Delivered", icon: CheckCircle2, color: "bg-emerald-600 hover:bg-emerald-700" }],
};

export default function PortalDriver() {
  const { user } = useAuth();
  const tz = useTimezone();
  const loads = useQuery(api.loads.list, {});
  const setStatus = useMutation(api.loads.setStatus);
  const updateTruckLocation = useMutation(api.location.updateTruckLocation);
  const truckLocations = useQuery(api.location.getTruckLocations, {});
  const [updating, setUpdating] = useState<string | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);

  const myLoads = (loads ?? []).filter(
    (l: LoadType) => !["Completed", "Cancelled"].includes(l.status),
  );
  const activeLoad = myLoads.find((l: LoadType) =>
    ["In Transit", "At Delivery", "Loaded", "At Pickup", "Loading", "Booked", "Driver Notified"].includes(l.status),
  );
  const upcomingLoads = myLoads.filter((l: LoadType) => l._id !== activeLoad?._id);

  const handleStatus = async (loadId: string, status: string) => {
    setUpdating(loadId);
    try {
      await setStatus({ id: loadId as any, status: status as any });
      toast.success(`Status updated → ${status}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setUpdating(null);
  };

  const handleShareLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser.");
      return;
    }
    setSharingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Find the truck assigned to this driver's active load
          if (activeLoad?.truckId) {
            await updateTruckLocation({
              truckId: activeLoad.truckId,
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              source: "driver_mobile",
              accuracy: position.coords.accuracy,
            });
            toast.success("Location shared successfully");
          } else {
            toast.info("No truck assigned to share location for.");
          }
        } catch (e) {
          toast.error(errorMessage(e));
        }
        setSharingLocation(false);
      },
      (error) => {
        setSharingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied. Please enable location access in your browser settings.");
        } else {
          toast.error("Unable to get location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [activeLoad, updateTruckLocation]);

  // Get driver's truck location for "last known" display
  const driverTruckLocation = activeLoad?.truckId
    ? truckLocations?.find((t: any) => t.truckId === activeLoad.truckId)
    : null;

  return (
    <div className="space-y-4 pb-8">
      {/* Mobile-first header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome, {user?.name ?? "Driver"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Active Load - Hero card */}
      {activeLoad && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Load</p>
                <Link to={`/loads/${activeLoad._id}`} className="text-lg font-semibold hover:underline">
                  {activeLoad.loadNumber}
                </Link>
              </div>
              <StatusBadge status={activeLoad.status} />
            </div>

            {/* Route */}
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium mt-0.5">{activeLoad.origin ?? "TBD"}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(activeLoad.pickupDate, tz)}</p>
              </div>
              <div className="shrink-0 text-muted-foreground">→</div>
              <div className="flex-1 rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Delivery</p>
                <p className="text-sm font-medium mt-0.5">{activeLoad.destination ?? "TBD"}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(activeLoad.deliveryDate, tz)}</p>
              </div>
            </div>

            {/* Load details grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {activeLoad.equipment && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Package className="size-3" /> {activeLoad.equipment}
                </div>
              )}
              {activeLoad.pickupRef && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="size-3" /> Ref: {activeLoad.pickupRef}
                </div>
              )}
              {activeLoad.commodity && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Package className="size-3" /> {activeLoad.commodity}
                </div>
              )}
            </div>

            {/* Location info */}
            {driverTruckLocation && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 text-xs">
                <MapPin className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Last known:</span>
                <span className="font-medium">{driverTruckLocation.location ?? `${driverTruckLocation.lat.toFixed(4)}, ${driverTruckLocation.lon.toFixed(4)}`}</span>
              </div>
            )}

            {/* Next Action - Big buttons */}
            {OPERATIONAL_TRANSITIONS[activeLoad.status] && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Next Action</p>
                {OPERATIONAL_TRANSITIONS[activeLoad.status].map((t) => (
                  <Button
                    key={t.status}
                    onClick={() => handleStatus(activeLoad._id, t.status)}
                    disabled={updating === activeLoad._id}
                    className={cn("w-full h-14 text-base font-semibold gap-2.5", t.color)}
                    size="lg"
                  >
                    {updating === activeLoad._id ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <t.icon className="size-5" />
                    )}
                    {t.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Location share button */}
            <Button
              variant="outline"
              onClick={handleShareLocation}
              disabled={sharingLocation || !activeLoad.truckId}
              className="w-full gap-2"
            >
              {sharingLocation ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Share2 className="size-4" />
              )}
              Share My Location
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No active load */}
      {!activeLoad && myLoads.length === 0 && (
        <EmptyState
          icon={<Package className="size-6" />}
          title="No active loads"
          description="You don't have any assigned loads right now."
        />
      )}

      {/* AI Assistant */}
      <SectionCard title="Driver Assistant" description="Ask about your current load and next actions">
        <AIAssistant
          title="Driver Assistant"
          description="Ask about your current load"
          suggestedQuestions={["Where is my pickup?", "Where is delivery?", "What is my next action?", "What documents are required?"]}
        />
      </SectionCard>

      {/* Upcoming loads */}
      {upcomingLoads.length > 0 && (
        <SectionCard title="Upcoming Loads">
          <div className="divide-y">
            {upcomingLoads.map((l: LoadType) => (
              <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between py-3 hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{l.loadNumber}</p>
                  <p className="text-xs text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                  <p className="text-xs text-muted-foreground">Pickup: {fmtDate(l.pickupDate, tz)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={l.status} />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
