import { useEffect, useRef, useMemo } from "react";
import { MapPin } from "lucide-react";
import { fmtDateTime } from "@/lib/dates";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Leaflet lazy-load wrapper — only imports in browser, keeps bundle small
// ---------------------------------------------------------------------------

let L: typeof import("leaflet") | null = null;

async function loadLeaflet() {
  if (L) return L;

  await import("leaflet/dist/leaflet.css");
  L = await import("leaflet");
  return L;
}

// ---------------------------------------------------------------------------
// XSS-safe HTML escaping — never inject raw database values into popups
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TruckMarker {
  truckId: string;
  unitNumber: string;
  type?: string;
  carrierId?: string;
  carrierName?: string;
  driverName?: string;
  availability?: string;
  lat: number;
  lon: number;
  location?: string;
  at: number;
  source?: string;
  accuracy?: number;
}

export interface TruckMapProps {
  trucks: TruckMarker[];
  height?: string;
  className?: string;
  emptyState?: ReactNode;
  onTruckClick?: (truck: TruckMarker) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TruckMap({ trucks, height = "h-80", className, emptyState, onTruckClick }: TruckMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);

  const validTrucks = useMemo(
    () => trucks.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon)),
    [trucks],
  );

  useEffect(() => {
    if (!containerRef.current || validTrucks.length === 0) return;

    let cancelled = false;

    (async () => {
      const leaflet = await loadLeaflet();
      if (cancelled || !containerRef.current) return;

      // Clean up old map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = leaflet.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        })
        .addTo(map);

      const bounds = leaflet.latLngBounds([]);

      for (const truck of validTrucks) {
        const age = Date.now() - truck.at;
        const isLive = age < 15 * 60 * 1000; // 15 min
        const icon = isLive
          ? leaflet.divIcon({
              className: "",
              html: `<div style="width:28px;height:28px;border-radius:50%;background:#16a34a;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2.81A2 2 0 0 1 20 8v8a2 2 0 0 1-2 2h-2"/><line x1="23" y1="13" x2="23" y2="11"/><polyline points="11 6 7 12 13 12 9 18"/></svg>
              </div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })
          : leaflet.divIcon({
              className: "",
              html: `<div style="width:28px;height:28px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });

        const marker = leaflet.marker([truck.lat, truck.lon], { icon }).addTo(map);

        const statusLabel = truck.availability ?? "Unknown";
        const locationLabel = truck.location ?? `${truck.lat.toFixed(4)}, ${truck.lon.toFixed(4)}`;
        const timeLabel = isLive ? "Live" : `Last known — ${fmtDateTime(truck.at)}`;
        const sourceLabel = truck.source ? ` · ${truck.source.replace("_", " ")}` : "";

        marker.bindPopup(`
          <div style="min-width:200px;font-family:system-ui,sans-serif">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <strong style="font-size:14px">${escapeHtml(truck.unitNumber)}${truck.type ? ` (${escapeHtml(truck.type)})` : ""}</strong>
              <span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:${isLive ? "#dcfce7" : "#fef3c7"};color:${isLive ? "#166534" : "#92400e"}">${escapeHtml(statusLabel)}</span>
            </div>
            ${truck.driverName ? `<div style="font-size:12px;color:#6b7280;margin-bottom:4px">Driver: ${escapeHtml(truck.driverName)}</div>` : ""}
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">
              <span style="color:#6b7280">📍</span> ${escapeHtml(locationLabel)}
            </div>
            <div style="font-size:11px;color:#9ca3af;display:flex;align-items:center;gap:4px">
              <span>${isLive ? "🟢" : "🟡"}</span> ${escapeHtml(timeLabel)}${escapeHtml(sourceLabel)}
              ${truck.accuracy ? ` · \u00B1${Math.round(truck.accuracy)}m` : ""}
            </div>
            <div style="margin-top:8px">
              <a href="/trucks/${encodeURIComponent(truck.truckId)}" style="font-size:12px;color:#2563eb;text-decoration:underline">View truck details \u2192</a>
            </div>
          </div>
        `);

        if (onTruckClick) {
          marker.on("click", () => onTruckClick(truck));
        }

        bounds.extend([truck.lat, truck.lon]);
        markersRef.current.push(marker);
      }

      if (validTrucks.length === 1) {
        map.setView([validTrucks[0].lat, validTrucks[0].lon], 12);
      } else if (validTrucks.length > 1) {
        map.fitBounds(bounds.pad(0.15));
      }

      mapRef.current = map;

      // Fix map sizing after render
      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [validTrucks, onTruckClick]);

  // Empty state
  if (validTrucks.length === 0) {
    return (
      <div className={`relative rounded-lg border bg-muted/30 overflow-hidden ${height} ${className ?? ""}`}>
        {emptyState ?? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <MapPin className="size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No truck locations available</p>
            <p className="text-xs text-muted-foreground mt-1">Truck positions appear when drivers share GPS data</p>
          </div>
        )}
      </div>
    );
  }

  return <div ref={containerRef} className={`relative rounded-lg border overflow-hidden ${height} ${className ?? ""}`} />;
}
