import { useEffect, useRef, useMemo, useCallback } from "react";
import { MapPin } from "lucide-react";
import { fmtDateTime } from "@/lib/dates";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// MapLibre GL lazy-load — only imports in browser, keeps bundle small
// ---------------------------------------------------------------------------

let maplibregl: typeof import("maplibre-gl") | null = null;

async function loadMapLibre() {
  if (maplibregl) return maplibregl;
  await import("maplibre-gl/dist/maplibre-gl.css");
  maplibregl = await import("maplibre-gl");
  return maplibregl;
}

// ---------------------------------------------------------------------------
// OpenFreeMap style — no API key required
// ---------------------------------------------------------------------------

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

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
  speed?: number;
  trackingActive?: boolean;
}

export interface TruckMapProps {
  trucks: TruckMarker[];
  height?: string;
  className?: string;
  emptyState?: ReactNode;
  onTruckClick?: (truck: TruckMarker) => void;
  /** Optional driving route coordinates [lng, lat] for route line overlay */
  routeCoordinates?: [number, number][];
  /** Route line color (default: electric blue) */
  routeColor?: string;
}

// ---------------------------------------------------------------------------
// Helper: SVG markup for truck marker (used as MapLibre HTML element)
// ---------------------------------------------------------------------------

function truckMarkerSvg(color: string): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2.81A2 2 0 0 1 20 8v8a2 2 0 0 1-2 2h-2"/><line x1="23" y1="13" x2="23" y2="11"/><polyline points="11 6 7 12 13 12 9 18"/></svg>`;
}

function makeMarkerHtml(color: string): string {
  return `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">${truckMarkerSvg(color)}</div>`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TruckMap({ trucks, height = "h-80", className, emptyState, onTruckClick, routeCoordinates, routeColor = "#4F8CFF" }: TruckMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const routeSourceId = "truck-map-route";
  const routeLayerId = "truck-map-route-layer";

  const validTrucks = useMemo(
    () => trucks.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon)),
    [trucks],
  );

  // Clean up existing markers without destroying the map
  const clearMarkers = useCallback(() => {
    for (const m of markersRef.current) {
      m.remove();
    }
    markersRef.current = [];
  }, []);

  useEffect(() => {
    if (!containerRef.current || validTrucks.length === 0) return;

    let cancelled = false;

    (async () => {
      const mgl = await loadMapLibre();
      if (cancelled || !containerRef.current) return;

      // If map already exists, just update markers
      if (mapRef.current) {
        clearMarkers();
        const map = mapRef.current;

        const bounds = new mgl.LngLatBounds();
        for (const truck of validTrucks) {
          const age = Date.now() - truck.at;
          const isLive = age < 15 * 60 * 1000;
          const isStale = age >= 15 * 60 * 1000 && age < 60 * 60 * 1000;
          const markerColor = isLive ? "#16a34a" : isStale ? "#f59e0b" : "#6b7280";

          const el = document.createElement("div");
          el.innerHTML = makeMarkerHtml(markerColor);
          el.style.cursor = "pointer";

          const marker = new mgl.Marker({ element: el })
            .setLngLat([truck.lon, truck.lat])
            .addTo(map);

          // Popup
          const age2 = Date.now() - truck.at;
          const live = age2 < 15 * 60 * 1000;
          const stale = age2 >= 15 * 60 * 1000 && age2 < 60 * 60 * 1000;
          const stopped = !truck.trackingActive && age2 >= 15 * 60 * 1000;
          const statusLabel = live ? "Live" : stale ? "Stale" : stopped ? "Stopped" : (truck.availability ?? "Unknown");
          const locationLabel = truck.location ?? `${truck.lat.toFixed(4)}, ${truck.lon.toFixed(4)}`;
          const timeLabel = live ? "Live" : `Last known — ${fmtDateTime(truck.at)}`;
          const sourceLabel = truck.source ? ` · ${truck.source.replace("_", " ")}` : "";

          marker.setPopup(
            new mgl.Popup({ offset: 16, closeButton: false }).setHTML(`
              <div style="min-width:200px;font-family:system-ui,sans-serif">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <strong style="font-size:14px">${escapeHtml(truck.unitNumber)}${truck.type ? ` (${escapeHtml(truck.type)})` : ""}</strong>
                  <span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:${live ? "#dcfce7" : "#fef3c7"};color:${live ? "#166534" : "#92400e"}">${escapeHtml(statusLabel)}</span>
                </div>
                ${truck.driverName ? `<div style="font-size:12px;color:#6b7280;margin-bottom:4px">Driver: ${escapeHtml(truck.driverName)}</div>` : ""}
                <div style="font-size:12px;color:#6b7280;margin-bottom:4px">
                  📍 ${escapeHtml(locationLabel)}
                </div>
                <div style="font-size:11px;color:#9ca3af;display:flex;align-items:center;gap:4px">
                  <span>${live ? "🟢" : "🟡"}</span> ${escapeHtml(timeLabel)}${escapeHtml(sourceLabel)}
                  ${truck.accuracy ? ` · ±${Math.round(truck.accuracy)}m` : ""}
                </div>
                <div style="margin-top:8px">
                  <a href="/trucks/${encodeURIComponent(truck.truckId)}" style="font-size:12px;color:#2563eb;text-decoration:underline">View truck details →</a>
                </div>
              </div>
            `)
          );

          if (onTruckClick) {
            el.addEventListener("click", () => onTruckClick(truck));
          }

          bounds.extend([truck.lon, truck.lat]);
          markersRef.current.push(marker);
        }

        if (validTrucks.length === 1) {
          map.setCenter([validTrucks[0].lon, validTrucks[0].lat]);
          map.setZoom(12);
        } else if (validTrucks.length > 1) {
          map.fitBounds(bounds, { padding: 60 });
        }
        return;
      }

      // First mount — create the map
      const center: [number, number] = validTrucks.length === 1
        ? [validTrucks[0].lon, validTrucks[0].lat]
        : [-98.5, 39.8]; // center of US

      const map = new mgl.Map({
        container: containerRef.current,
        style: OPENFREEMAP_STYLE,
        center,
        zoom: validTrucks.length === 1 ? 12 : 4,
        attributionControl: { compact: true },
        scrollZoom: true,
      });

      map.addControl(new mgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;

        const bounds2 = new mgl.LngLatBounds();
        for (const truck of validTrucks) {
          const age = Date.now() - truck.at;
          const isLive = age < 15 * 60 * 1000;
          const isStale = age >= 15 * 60 * 1000 && age < 60 * 60 * 1000;
          const markerColor = isLive ? "#16a34a" : isStale ? "#f59e0b" : "#6b7280";

          const el = document.createElement("div");
          el.innerHTML = makeMarkerHtml(markerColor);
          el.style.cursor = "pointer";

          const marker = new mgl.Marker({ element: el })
            .setLngLat([truck.lon, truck.lat])
            .addTo(map);

          const age2 = Date.now() - truck.at;
          const live = age2 < 15 * 60 * 1000;
          const stale = age2 >= 15 * 60 * 1000 && age2 < 60 * 60 * 1000;
          const stopped = !truck.trackingActive && age2 >= 15 * 60 * 1000;
          const statusLabel = live ? "Live" : stale ? "Stale" : stopped ? "Stopped" : (truck.availability ?? "Unknown");
          const locationLabel = truck.location ?? `${truck.lat.toFixed(4)}, ${truck.lon.toFixed(4)}`;
          const timeLabel = live ? "Live" : `Last known — ${fmtDateTime(truck.at)}`;
          const sourceLabel = truck.source ? ` · ${truck.source.replace("_", " ")}` : "";

          marker.setPopup(
            new mgl.Popup({ offset: 16, closeButton: false }).setHTML(`
              <div style="min-width:200px;font-family:system-ui,sans-serif">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <strong style="font-size:14px">${escapeHtml(truck.unitNumber)}${truck.type ? ` (${escapeHtml(truck.type)})` : ""}</strong>
                  <span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:${live ? "#dcfce7" : "#fef3c7"};color:${live ? "#166534" : "#92400e"}">${escapeHtml(statusLabel)}</span>
                </div>
                ${truck.driverName ? `<div style="font-size:12px;color:#6b7280;margin-bottom:4px">Driver: ${escapeHtml(truck.driverName)}</div>` : ""}
                <div style="font-size:12px;color:#6b7280;margin-bottom:4px">
                  📍 ${escapeHtml(locationLabel)}
                </div>
                <div style="font-size:11px;color:#9ca3af;display:flex;align-items:center;gap:4px">
                  <span>${live ? "🟢" : "🟡"}</span> ${escapeHtml(timeLabel)}${escapeHtml(sourceLabel)}
                  ${truck.accuracy ? ` · ±${Math.round(truck.accuracy)}m` : ""}
                </div>
                <div style="margin-top:8px">
                  <a href="/trucks/${encodeURIComponent(truck.truckId)}" style="font-size:12px;color:#2563eb;text-decoration:underline">View truck details →</a>
                </div>
              </div>
            `)
          );

          if (onTruckClick) {
            el.addEventListener("click", () => onTruckClick(truck));
          }

          bounds2.extend([truck.lon, truck.lat]);
          markersRef.current.push(marker);
        }

        if (validTrucks.length > 1) {
          map.fitBounds(bounds2, { padding: 60 });
        }
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      clearMarkers();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [validTrucks, onTruckClick, clearMarkers]);

  // Route line overlay — draws driving route on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeCoordinates || routeCoordinates.length < 2) return;

    const drawRoute = () => {
      // Remove previous route source/layer if they exist
      if (map.getLayer(routeLayerId)) {
        map.removeLayer(routeLayerId);
      }
      if (map.getSource(routeSourceId)) {
        map.removeSource(routeSourceId);
      }

      map.addSource(routeSourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: routeCoordinates,
          },
        },
      });

      map.addLayer({
        id: routeLayerId,
        type: "line",
        source: routeSourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": routeColor,
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });

      // Fit map to include route
      try {
        const mgl = maplibregl;
        if (mgl) {
          const bounds = new mgl.LngLatBounds();
          for (const coord of routeCoordinates) {
            bounds.extend(coord);
          }
          map.fitBounds(bounds, { padding: 60 });
        }
      } catch {
        // Ignore bounds fitting errors
      }
    };

    if (map.isStyleLoaded()) {
      drawRoute();
    } else {
      map.on("load", drawRoute);
    }

    return () => {
      if (map.getLayer(routeLayerId)) {
        map.removeLayer(routeLayerId);
      }
      if (map.getSource(routeSourceId)) {
        map.removeSource(routeSourceId);
      }
    };
  }, [routeCoordinates, routeColor, routeSourceId, routeLayerId]);

  // Empty state
  if (validTrucks.length === 0) {
    return (
      <div className={`relative rounded-lg border border-border/50 bg-muted/20 overflow-hidden ${height} ${className ?? ""}`}>
        {emptyState ?? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <MapPin className="size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No truck locations available</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Truck positions appear when drivers share GPS data</p>
          </div>
        )}
      </div>
    );
  }

  return <div ref={containerRef} className={`relative rounded-lg border border-border/50 overflow-hidden ${height} ${className ?? ""}`} />;
}

// ---------------------------------------------------------------------------
// XSS-safe HTML escaping
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
