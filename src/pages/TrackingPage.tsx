import { useEffect, useRef } from "react";
import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Logo } from "@/components/brand/Logo";
import { fmtDate, fmtRelative } from "@/lib/dates";
import { MapPin, Radio, AlertTriangle } from "lucide-react";

// MapLibre GL lazy-load
let maplibregl: typeof import("maplibre-gl") | null = null;
async function loadMapLibre() {
  if (maplibregl) return maplibregl;
  await import("maplibre-gl/dist/maplibre-gl.css");
  maplibregl = await import("maplibre-gl");
  return maplibregl;
}

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const colorMap: Record<string, string> = {
    "Booked": "text-[#4F8CFF] bg-[#4F8CFF]/10",
    "In Transit": "text-[#4F8CFF] bg-[#4F8CFF]/10",
    "Delivered": "text-[#22C55E] bg-[#22C55E]/10",
    "Completed": "text-[#22C55E] bg-[#22C55E]/10",
    "At Pickup": "text-[#F5A623] bg-[#F5A623]/10",
    "At Delivery": "text-[#F5A623] bg-[#F5A623]/10",
    "Cancelled": "text-[#EF4444] bg-[#EF4444]/10",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", colorMap[status] ?? "text-muted-foreground bg-muted")}>
      {status}
    </span>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function TrackingPage() {
  const { token } = useParams<{ token: string }>();
  const tracking = useQuery(
    api.location.getPublicTracking,
    token ? { token } : "skip",
  );
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRef = useRef<import("maplibre-gl").Marker | null>(null);

  // Initialize and update map when location data is available
  useEffect(() => {
    if (!tracking?.valid || !tracking.location || !mapContainerRef.current) return;

    const loc = tracking.location;
    const loadName = tracking.load?.loadNumber ?? "";
    const isLive = loc.isLive;

    let cancelled = false;

    (async () => {
      const mgl = await loadMapLibre();
      if (cancelled || !mapContainerRef.current) return;

      // Clean up old map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;

      const map = new mgl.Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_STYLE,
        center: [loc.lon, loc.lat],
        zoom: 12,
        attributionControl: { compact: true },
        scrollZoom: false,
      });

      map.addControl(new mgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;

        const markerColor = isLive ? "#22C55E" : "#f59e0b";
        const el = document.createElement("div");
        el.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:${markerColor};border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2.81A2 2 0 0 1 20 8v8a2 2 0 0 1-2 2h-2"/><line x1="23" y1="13" x2="23" y2="11"/><polyline points="11 6 7 12 13 12 9 18"/></svg>
        </div>`;

        const marker = new mgl.Marker({ element: el })
          .setLngLat([loc.lon, loc.lat])
          .addTo(map);

        marker.setPopup(
          new mgl.Popup({ offset: 16, closeButton: false }).setHTML(`
            <div style="min-width:160px;font-family:system-ui,sans-serif">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px">${escapeHtml(loadName)}</div>
              <div style="font-size:11px;color:#6b7280">
                ${isLive ? "🟢 Live" : "🟡 Last known"} · ${fmtRelative(loc.at)}
              </div>
              ${loc.speed != null ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">Speed: ${Math.round(loc.speed)} mph</div>` : ""}
            </div>
          `)
        );
        marker.togglePopup();

        mapInstanceRef.current = map;
        markerRef.current = marker;
      });
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [tracking?.valid, tracking?.location?.lat, tracking?.location?.lon]);

  // Loading state
  if (tracking === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080B0F]">
        <div className="size-8 rounded-full border-2 border-[#4F8CFF]/20 border-t-[#4F8CFF] animate-spin" />
        <p className="mt-3 text-xs text-muted-foreground">Loading tracking data…</p>
      </div>
    );
  }

  // Invalid token
  if (!tracking.valid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080B0F] p-6">
        <div className="max-w-md text-center">
          <Logo size="lg" variant="full" />
          <div className="mt-6 rounded-2xl border border-border/50 bg-card p-8">
            <AlertTriangle className="size-10 text-[#F5A623] mx-auto mb-4" />
            <h1 className="text-lg font-bold">Tracking Unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{tracking.error}</p>
            <p className="mt-3 text-xs text-muted-foreground/70">Please contact your shipper for an updated tracking link.</p>
          </div>
        </div>
      </div>
    );
  }

  const loc = tracking.location;
  const load = tracking.load;
  const isLive = loc?.isLive ?? false;

  return (
    <div className="min-h-screen bg-[#080B0F] flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0D1218]/80 backdrop-blur-xl border-b border-border/30 px-4 py-3"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Logo size="sm" variant="full" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Load Tracking</span>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Map */}
        <div className="flex-1 min-h-[50vh] lg:min-h-0">
          {loc ? (
            <div ref={mapContainerRef} className="w-full h-full min-h-[50vh]" />
          ) : (
            <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center bg-muted/10">
              <Radio className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No live location available</p>
              <p className="text-xs text-muted-foreground/70 mt-1">The driver has not started sharing their location yet.</p>
            </div>
          )}
        </div>

        {/* Info panel */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:w-80 bg-card border-t lg:border-t-0 lg:border-l border-border/30 p-5 space-y-5"
        >
          {/* Load info */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Load Information</p>
            <h2 className="text-lg font-bold">{load?.loadNumber ?? "—"}</h2>
            <StatusBadge status={load?.status} />
          </div>

          {/* Route */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-7 rounded-lg bg-[#22C55E]/10 flex items-center justify-center shrink-0">
                <MapPin className="size-3.5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickup</p>
                <p className="text-sm font-semibold">{load?.origin ?? "TBD"}</p>
                {load?.pickupDate && <p className="text-xs text-muted-foreground">{fmtDate(load.pickupDate)}</p>}
              </div>
            </div>
            <div className="ml-3.5 border-l-2 border-dashed border-border/40 h-3" />
            <div className="flex items-start gap-3">
              <div className="size-7 rounded-lg bg-[#EF4444]/10 flex items-center justify-center shrink-0">
                <MapPin className="size-3.5 text-[#EF4444]" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery</p>
                <p className="text-sm font-semibold">{load?.destination ?? "TBD"}</p>
                {load?.deliveryDate && <p className="text-xs text-muted-foreground">{fmtDate(load.deliveryDate)}</p>}
              </div>
            </div>
          </div>

          {/* Tracking status */}
          <div className="rounded-xl bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", isLive ? "bg-[#22C55E]" : "bg-[#F5A623]")} />
                <span className="font-medium">{isLive ? "Live Tracking" : "Last Known Position"}</span>
              </span>
            </div>
            {loc && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">{fmtRelative(loc.at)}</span>
                </div>
                {loc.speed != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Speed</span>
                    <span className="font-medium">{Math.round(loc.speed)} mph</span>
                  </div>
                )}
                {loc.accuracy != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Accuracy</span>
                    <span className="font-medium">±{Math.round(loc.accuracy)}m</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="text-[10px] text-muted-foreground/50 text-center pt-3 border-t border-border/30">
            Powered by DispatchOS
          </div>
        </motion.div>
      </div>
    </div>
  );
}
