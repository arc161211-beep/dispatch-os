import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { AIAssistant } from "@/components/app/AIAssistant";
import { PageHeader, StatusBadge, SectionCard, EmptyState, errorMessage } from "@/components/app/shared";
import { Logo } from "@/components/brand/Logo";
import heroTruckImg from "/hero-truck.png";
import { Button } from "@/components/ui/button";
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
  Phone,
  ChevronRight,
  Share2,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

type LoadType = any;

const OPERATIONAL_TRANSITIONS: Record<string, { status: string; label: string; icon: typeof Package; color: string }[]> = {
  "Booked": [{ status: "Driver Notified", label: "Notified", icon: CheckCircle2, color: "bg-electric hover:bg-electric/90 shadow-lg shadow-electric/20" }],
  "Driver Notified": [{ status: "At Pickup", label: "Arrived at Pickup", icon: MapPin, color: "bg-[#F5A623] hover:bg-[#F5A623]/90 shadow-lg shadow-[#F5A623]/20" }],
  "At Pickup": [{ status: "Loading", label: "Loading", icon: Package, color: "bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 shadow-lg shadow-[#8B5CF6]/20" }],
  "Loading": [{ status: "Loaded", label: "Loaded", icon: CheckCircle2, color: "bg-[#22C55E] hover:bg-[#22C55E]/90 shadow-lg shadow-[#22C55E]/20" }],
  "Loaded": [{ status: "In Transit", label: "Start Transit", icon: Navigation, color: "bg-electric hover:bg-electric/90 shadow-lg shadow-electric/20" }],
  "In Transit": [{ status: "At Delivery", label: "Arrived at Delivery", icon: MapPin, color: "bg-[#F5A623] hover:bg-[#F5A623]/90 shadow-lg shadow-[#F5A623]/20" }],
  "At Delivery": [{ status: "Delivered", label: "Delivered", icon: CheckCircle2, color: "bg-[#22C55E] hover:bg-[#22C55E]/90 shadow-lg shadow-[#22C55E]/20" }],
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
          if (activeLoad?.truckId) {
            await updateTruckLocation({
              truckId: activeLoad.truckId,
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              source: "driver_mobile",
              accuracy: position.coords.accuracy,
            });
            toast.success("Location shared");
          } else {
            toast.info("No truck assigned.");
          }
        } catch (e) {
          toast.error(errorMessage(e));
        }
        setSharingLocation(false);
      },
      (error) => {
        setSharingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied. Enable in browser settings.");
        } else {
          toast.error("Unable to get location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [activeLoad, updateTruckLocation]);

  const driverTruckLocation = activeLoad?.truckId
    ? truckLocations?.find((t: any) => t.truckId === activeLoad.truckId)
    : null;

  return (
    <div className="space-y-4 pb-8 max-w-lg mx-auto">
      {/* ═══════════ HEADER ═══════════ */}
      <div className="text-center pt-2">
        <div className="flex justify-center mb-2">
          <Logo size="md" variant="full" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">
          Welcome, {user?.name ?? "Driver"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* ═══════════ ACTIVE LOAD ═══════════ */}
      {activeLoad ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            {/* Status bar */}
            <div className="bg-electric/5 border-b border-electric/10 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-electric">Current Load</span>
              <StatusBadge status={activeLoad.status} />
            </div>

            <div className="p-4 space-y-4">
              {/* Load number + route */}
              <div>
                <Link to={`/loads/${activeLoad._id}`} className="text-xl font-extrabold tracking-tight hover:text-primary">
                  {activeLoad.loadNumber}
                </Link>
              </div>

              {/* Route visualization */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Pickup</p>
                  <p className="text-sm font-bold mt-0.5">{activeLoad.origin ?? "TBD"}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDate(activeLoad.pickupDate, tz)}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground/40 shrink-0" />
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Delivery</p>
                  <p className="text-sm font-bold mt-0.5">{activeLoad.destination ?? "TBD"}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtDate(activeLoad.deliveryDate, tz)}</p>
                </div>
              </div>

              {/* Load details */}
              <div className="flex flex-wrap gap-2 text-[11px]">
                {activeLoad.equipment && (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    <Truck className="size-3" /> {activeLoad.equipment}
                  </span>
                )}
                {activeLoad.pickupRef && (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    <FileText className="size-3" /> Ref: {activeLoad.pickupRef}
                  </span>
                )}
                {activeLoad.commodity && (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    <Package className="size-3" /> {activeLoad.commodity}
                  </span>
                )}
              </div>

              {/* Location */}
              {driverTruckLocation && (
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5 text-[11px]">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Last known:</span>
                  <span className="font-medium">{driverTruckLocation.location ?? `${driverTruckLocation.lat.toFixed(4)}, ${driverTruckLocation.lon.toFixed(4)}`}</span>
                </div>
              )}

              {/* NEXT ACTION — Premium CTA */}
              {OPERATIONAL_TRANSITIONS[activeLoad.status] && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Next Action</p>
                  {OPERATIONAL_TRANSITIONS[activeLoad.status].map((t) => (
                    <Button
                      key={t.status}
                      onClick={() => handleStatus(activeLoad._id, t.status)}
                      disabled={updating === activeLoad._id}
                      className={cn("w-full h-14 text-base font-bold gap-2.5 rounded-xl", t.color)}
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

              {/* Location share */}
              <Button
                variant="outline"
                onClick={handleShareLocation}
                disabled={sharingLocation || !activeLoad.truckId}
                className="w-full gap-2 h-11"
              >
                {sharingLocation ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Share2 className="size-4" />
                )}
                Share My Location
              </Button>
            </div>
          </div>
        </motion.div>
      ) : myLoads.length === 0 ? (
        <EmptyState
          icon={<Package className="size-5" />}
          title="No active loads"
          description="You don't have any assigned loads right now."
        />
      ) : null}

      {/* ═══════════ AI ═══════════ */}
      <SectionCard title="Driver Assistant" description="Ask about your current load">
        <AIAssistant
          title="Driver Assistant"
          description="Ask about your current load"
          suggestedQuestions={["Where is my pickup?", "Where is delivery?", "What is my next action?", "What documents are required?"]}
        />
      </SectionCard>

      {/* ═══════════ UPCOMING ═══════════ */}
      {upcomingLoads.length > 0 && (
        <SectionCard title="Upcoming Loads">
          <div className="space-y-1.5">
            {upcomingLoads.map((l: LoadType) => (
              <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{l.loadNumber}</p>
                  <p className="text-[11px] text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                  <p className="text-[11px] text-muted-foreground">Pickup: {fmtDate(l.pickupDate, tz)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={l.status} />
                  <ChevronRight className="size-3.5 text-muted-foreground/40" />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
