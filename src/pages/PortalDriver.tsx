import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { AIAssistant } from "@/components/app/AIAssistant";
import { PageHeader, StatusBadge, SectionCard, EmptyState, errorMessage } from "@/components/app/shared";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/dates";
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
  Radio,
  RadioTower,
  CircleStop,
  Gauge,
  Clock,
  AlertTriangle,
  Shield,
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

// Stale thresholds
const LIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

type TrackingStatus = "live" | "stale" | "stopped" | "offline" | "unavailable";

export default function PortalDriver() {
  const { user } = useAuth();
  const tz = useTimezone();
  const loads = useQuery(api.loads.list, {});
  const setStatus = useMutation(api.loads.setStatus);
  const updateTruckLocation = useMutation(api.location.updateTruckLocation);
  const startTrackingMutation = useMutation(api.location.startTracking);
  const stopTrackingMutation = useMutation(api.location.stopTracking);
  const truckLocations = useQuery(api.location.getTruckLocations, {});
  const [updating, setUpdating] = useState<string | null>(null);

  // GPS tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<PermissionState | "unknown" | "unavailable">("unknown");
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const truckIdRef = useRef<string | null>(null);
  // L5: GPS throttle — minimum 5 seconds between Convex mutations
  const GPS_THROTTLE_MS = 5000;
  const lastSendTimeRef = useRef<number>(0);
  const pendingPositionRef = useRef<GeolocationPosition | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the driver record linked to this authenticated user
  const driversList = useQuery(api.drivers.list, {});
  const myDriverRecord = driversList?.find((d: any) => d.email?.toLowerCase() === user?.email?.toLowerCase());

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

  // Check GPS permission status on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsPermission("unavailable");
      return;
    }

    // Try to check Permission API
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setGpsPermission(result.state);
        result.onchange = () => setGpsPermission(result.state);
      }).catch(() => {
        setGpsPermission("unknown");
      });
    } else {
      setGpsPermission("unknown");
    }
  }, []);

  // Cleanup on unmount — stop watching and clear throttle timer
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // L5: Flush the pending position immediately (used on stop tracking)
  const flushPendingUpdate = useCallback(async () => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    const pending = pendingPositionRef.current;
    if (pending && activeLoad?.truckId) {
      pendingPositionRef.current = null;
      lastSendTimeRef.current = Date.now();
      try {
        await updateTruckLocation({
          truckId: activeLoad.truckId,
          lat: pending.coords.latitude,
          lon: pending.coords.longitude,
          source: "browser_geolocation",
          accuracy: pending.coords.accuracy,
          speed: pending.coords.speed ?? undefined,
          heading: pending.coords.heading ?? undefined,
        });
      } catch (e) {
        console.error("[tracking] Failed to send pending location:", e);
      }
    }
  }, [activeLoad?.truckId, updateTruckLocation]);

  // L5: Throttled GPS update — always updates UI instantly, but throttles
  // Convex mutation calls to at most once every GPS_THROTTLE_MS.
  // The latest position is always eventually sent.
  const sendLocationUpdate = useCallback((position: GeolocationPosition) => {
    if (!activeLoad?.truckId) return;

    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const acc = position.coords.accuracy;
    const spd = position.coords.speed ?? undefined;
    const hdg = position.coords.heading ?? undefined;

    // Always update UI state immediately
    setCoords({ lat, lon });
    setAccuracy(acc);
    setSpeed(spd ?? null);
    setLastUpdateAt(Date.now());
    setTrackingError(null);

    // Throttle the actual Convex mutation
    const now = Date.now();
    const elapsed = now - lastSendTimeRef.current;

    if (elapsed >= GPS_THROTTLE_MS) {
      // Enough time has passed — send immediately
      lastSendTimeRef.current = now;
      pendingPositionRef.current = null;
      updateTruckLocation({
        truckId: activeLoad.truckId,
        lat,
        lon,
        source: "browser_geolocation",
        accuracy: acc,
        speed: spd,
        heading: hdg,
      }).catch((e) => console.error("[tracking] Failed to send location:", e));
    } else {
      // Store as pending — will be sent after throttle window
      pendingPositionRef.current = position;
      if (!throttleTimerRef.current) {
        const delay = GPS_THROTTLE_MS - elapsed;
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null;
          flushPendingUpdate();
        }, delay);
      }
    }
  }, [activeLoad?.truckId, updateTruckLocation, flushPendingUpdate]);

  const handleStartTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser.");
      setTrackingError("Geolocation not supported");
      return;
    }

    if (!activeLoad?.truckId) {
      toast.error("No truck assigned. Contact your dispatcher.");
      return;
    }

    truckIdRef.current = activeLoad.truckId;
    setTrackingError(null);

    // Start watching position
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        sendLocationUpdate(position);
        setIsTracking(true);
      },
      (error) => {
        setIsTracking(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setTrackingError("Location permission denied. Please enable in browser settings.");
            setGpsPermission("denied");
            toast.error("Location permission denied. Enable in browser settings.");
            break;
          case error.POSITION_UNAVAILABLE:
            setTrackingError("Location information unavailable.");
            toast.error("Location unavailable. Check your device settings.");
            break;
          case error.TIMEOUT:
            setTrackingError("Location request timed out.");
            toast.error("Location request timed out. Retrying…");
            break;
          default:
            setTrackingError("Unable to get location.");
            toast.error("Unable to get location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 10000,
      },
    );

    watchIdRef.current = watchId;
    setIsTracking(true);

    // Also tell the backend we started tracking
    startTrackingMutation({ truckId: activeLoad.truckId }).catch((e) => {
      console.error("[tracking] Failed to start tracking:", e);
    });

    toast.success("Location sharing started");
  }, [activeLoad?.truckId, sendLocationUpdate, startTrackingMutation]);

  const handleStopTracking = useCallback(() => {
    // L5: Flush any pending GPS update before stopping
    flushPendingUpdate();

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(false);
    setTrackingError(null);

    if (truckIdRef.current) {
      stopTrackingMutation({ truckId: truckIdRef.current as any }).catch((e) => {
        console.error("[tracking] Failed to stop tracking:", e);
      });
    }

    toast.success("Location sharing stopped");
  }, [stopTrackingMutation, flushPendingUpdate]);

  // Auto-stop tracking when active load changes or becomes unavailable
  useEffect(() => {
    if (!activeLoad?.truckId && isTracking) {
      handleStopTracking();
    }
  }, [activeLoad?.truckId, isTracking, handleStopTracking]);

  // Determine tracking status
  const trackingStatus: TrackingStatus = (() => {
    if (!navigator.geolocation) return "unavailable";
    if (!activeLoad?.truckId) return "offline";
    if (!isTracking) return "stopped";
    if (!lastUpdateAt) return "stale";
    const age = Date.now() - lastUpdateAt;
    if (age < LIVE_THRESHOLD_MS) return "live";
    if (age < STALE_THRESHOLD_MS) return "stale";
    return "offline";
  })();

  // Human-readable tracking status with icon and color
  const trackingStatusDisplay = (() => {
    switch (trackingStatus) {
      case "live":
        return { label: "🟢 Sharing Live Location", color: "text-[#22C55E]", dotColor: "bg-[#22C55E] animate-pulse" };
      case "stale":
        return { label: "🟡 Waiting for GPS", color: "text-[#F5A623]", dotColor: "bg-[#F5A623] animate-pulse" };
      case "stopped":
        return { label: "⚪ Location Sharing Not Started", color: "text-muted-foreground", dotColor: "bg-muted-foreground" };
      case "offline":
        return { label: "🔴 Location Unavailable", color: "text-[#EF4444]", dotColor: "bg-[#EF4444]" };
      case "unavailable":
        return { label: "⚫ Browser Does Not Support Location", color: "text-muted-foreground", dotColor: "bg-muted-foreground" };
    }
  })();

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

      {/* ═══════════ LIVE TRACKING CONTROL ═══════════ */}
      {activeLoad?.truckId && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="bg-electric/5 border-b border-electric/10 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-electric">Live GPS Tracking</span>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "size-1.5 rounded-full",
                  trackingStatus === "live" ? "bg-[#22C55E] animate-pulse" :
                  trackingStatus === "stale" ? "bg-[#F5A623] animate-pulse" :
                  trackingStatus === "stopped" ? "bg-[#8F9AAA]" :
                  "bg-[#EF4444]"
                )} />
                <span className="text-[10px] font-medium capitalize text-muted-foreground">
                  {trackingStatus === "unavailable" ? "N/A" : trackingStatus}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Explicit tracking status */}
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full shrink-0", trackingStatusDisplay.dotColor)} />
                <span className={cn("text-xs font-medium", trackingStatusDisplay.color)}>{trackingStatusDisplay.label}</span>
              </div>

              {/* Permission status */}
              {gpsPermission === "denied" && (
                <div className="flex items-start gap-2 rounded-xl bg-[#EF4444]/5 border border-[#EF4444]/20 p-3 text-xs">
                  <AlertTriangle className="size-3.5 text-[#EF4444] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[#EF4444]">Location permission denied</p>
                    <p className="text-muted-foreground mt-0.5">To enable location sharing:</p>
                    <ol className="mt-1 space-y-0.5 text-muted-foreground list-decimal list-inside">
                      <li>Open your browser settings</li>
                      <li>Find &quot;Site Settings&quot; or &quot;Privacy&quot;</li>
                      <li>Allow location access for this site</li>
                      <li>Refresh the page</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Browser not supported */}
              {gpsPermission === "unavailable" && (
                <div className="flex items-start gap-2 rounded-xl bg-muted/30 border border-border/30 p-3 text-xs">
                  <AlertTriangle className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Browser does not support location</p>
                    <p className="text-muted-foreground mt-0.5">Your browser does not support GPS location sharing. Please use a modern browser like Chrome, Firefox, or Safari.</p>
                  </div>
                </div>
              )}

              {/* Tracking data display */}
              {isTracking && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-muted/50 p-2.5 text-center">
                    <Gauge className="size-3.5 mx-auto text-muted-foreground" />
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Accuracy</p>
                    <p className="text-sm font-bold">{accuracy !== null ? `±${Math.round(accuracy)}m` : "—"}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2.5 text-center">
                    <Navigation className="size-3.5 mx-auto text-muted-foreground" />
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Speed</p>
                    <p className="text-sm font-bold">{speed !== null ? `${Math.round(speed)} mph` : "—"}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2.5 text-center">
                    <Clock className="size-3.5 mx-auto text-muted-foreground" />
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Last Update</p>
                    <p className="text-sm font-bold">{lastUpdateAt ? fmtRelative(lastUpdateAt) : "—"}</p>
                  </div>
                </div>
              )}

              {/* Coordinates */}
              {coords && isTracking && (
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5 text-[11px]">
                  <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Position:</span>
                  <span className="font-medium font-mono">{coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}</span>
                </div>
              )}

              {/* Error */}
              {trackingError && (
                <div className="flex items-center gap-2 rounded-xl bg-[#F5A623]/5 border border-[#F5A623]/20 p-2.5 text-[11px]">
                  <AlertTriangle className="size-3.5 text-[#F5A623] shrink-0" />
                  <span className="text-muted-foreground">{trackingError}</span>
                </div>
              )}

              {/* Start/Stop buttons */}
              <div className="flex gap-2">
                {!isTracking ? (
                  <Button
                    onClick={handleStartTracking}
                    disabled={!activeLoad.truckId || gpsPermission === "denied"}
                    className="flex-1 gap-2 h-11 bg-[#22C55E] hover:bg-[#22C55E]/90 text-white shadow-sm shadow-[#22C55E]/20"
                  >
                    <RadioTower className="size-4" />
                    Start Sharing Location
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopTracking}
                    variant="outline"
                    className="flex-1 gap-2 h-11 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/5"
                  >
                    <CircleStop className="size-4" />
                    Stop Sharing
                  </Button>
                )}
              </div>

              {/* Privacy notice */}
              <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70">
                <Shield className="size-3 shrink-0 mt-0.5" />
                <p>Your location is shared only while tracking is active. Your dispatcher can see your position in real-time. Tap "Stop Sharing" at any time to stop.</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════ ACTIVE LOAD ═══════════ */}
      {activeLoad ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
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

              {/* Location from last update */}
              {driverTruckLocation ? (
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5 text-[11px]">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Last known:</span>
                  <span className="font-medium">{driverTruckLocation.location ?? `${driverTruckLocation.lat.toFixed(4)}, ${driverTruckLocation.lon.toFixed(4)}`}</span>
                </div>
              ) : !isTracking ? (
                <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-2.5 text-[11px]">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Location sharing has not started. Tap "Start Sharing Location" above.</span>
                </div>
              ) : null}

              {/* Missing truckId warning */}
              {activeLoad && !activeLoad.truckId && (
                <div className="flex items-start gap-2 rounded-xl bg-[#EF4444]/5 border border-[#EF4444]/20 p-3 text-[11px]">
                  <AlertTriangle className="size-3.5 text-[#EF4444] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-[#EF4444]">No truck assigned to this load</p>
                    <p className="text-muted-foreground mt-0.5">Location sharing requires a truck assignment. Contact your dispatcher to assign a truck to this load.</p>
                  </div>
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
