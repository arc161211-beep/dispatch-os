import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search, MapPin, Truck, Clock, Weight, DollarSign, ArrowRight,
  Save, Loader2, AlertTriangle, Package, Map as MapIcon, ExternalLink,
  CheckCircle2, XCircle, SlidersHorizontal,
} from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { LoadBoardLoad } from "@/convex/loadBoard";

// ---------------------------------------------------------------------------
// Equipment types from TrukTek
// ---------------------------------------------------------------------------

const EQUIPMENT_TYPES = ["Van", "Reefer", "Flatbed", "Tanker", "Intermodal", "Auto"];

// ---------------------------------------------------------------------------
// State abbreviations for autocomplete
// ---------------------------------------------------------------------------

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatMiles(miles: number): string {
  return miles ? `${Math.round(miles)} mi` : "—";
}

function formatHours(hours: number): string {
  if (!hours) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------------------------------------------------------------------------
// LoadBoardPage Component
// ---------------------------------------------------------------------------

export default function LoadBoard() {
  // --- State ---
  const [originCity, setOriginCity] = useState("");
  const [originState, setOriginState] = useState("");
  const [destCity, setDestCity] = useState("");
  const [destState, setDestState] = useState("");
  const [equipment, setEquipment] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [minRpm, setMinRpm] = useState("");
  const [maxDeadhead, setMaxDeadhead] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<LoadBoardLoad[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoad, setSelectedLoad] = useState<LoadBoardLoad | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [saveDialogLoad, setSaveDialogLoad] = useState<LoadBoardLoad | null>(null);
  const [lastSearchTime, setLastSearchTime] = useState(0);

  // --- Actions ---
  const searchLoads = useAction(api.loadBoard.searchLoads);
  const saveLoad = useMutation(api.loadBoard.saveLoad);
  const mapRef = useRef<HTMLDivElement>(null);

  // --- Search ---
  const handleSearch = useCallback(async () => {
    // Rate-limit: at least 2 seconds between searches
    const now = Date.now();
    if (now - lastSearchTime < 2000) {
      toast.warning("Please wait a moment before searching again.");
      return;
    }
    setLastSearchTime(now);

    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedLoad(null);

    try {
      const result = await searchLoads({
        originCity: originCity || undefined,
        originState: originState || undefined,
        destCity: destCity || undefined,
        destState: destState || undefined,
        equipment: equipment || undefined,
        pickupDate: pickupDate || undefined,
        deliveryDate: deliveryDate || undefined,
        minRpm: minRpm ? Number(minRpm) : undefined,
        maxDeadhead: maxDeadhead ? Number(maxDeadhead) : undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setResults(result.loads);
      }
    } catch (e) {
      setError("Failed to search loads. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [originCity, originState, destCity, destState, equipment, pickupDate, deliveryDate, minRpm, maxDeadhead, lastSearchTime, searchLoads]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  // --- Save to DispatchOS ---
  const handleSave = useCallback(async (load: LoadBoardLoad) => {
    try {
      await saveLoad({
        externalId: load.loadId,
        origin: load.origin,
        destination: load.destination,
        equipment: load.equipment,
        grossRateCents: load.ratePay * 100,
        pickupDate: load.pickupDate ? new Date(load.pickupDate).getTime() : undefined,
        deliveryDate: load.deliveryDate ? new Date(load.deliveryDate).getTime() : undefined,
        loadedMiles: load.miles,
        deadheadMiles: load.deadheadMiles,
        weight: load.weight,
        shipperName: load.shipperNm,
      });
      toast.success("Load saved to DispatchOS!");
      setSaveDialogLoad(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save load.";
      toast.error(msg);
    }
  }, [saveLoad]);

  // --- Initialize Map when selected ---
  useEffect(() => {
    if (!showMap || !selectedLoad || !mapRef.current || selectedLoad.coordinates.length === 0) return;

    let map: any = null;

    import("maplibre-gl").then((mgl) => {
      if (!mapRef.current) return;

      // Clear previous
      mapRef.current.innerHTML = "";

      map = new mgl.Map({
        container: mapRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: selectedLoad.coordinates[0] ?? [-96.7970, 32.7767],
        zoom: 5,
      });

      map.addControl(new mgl.NavigationControl(), "top-right");

      // Add route line
      if (selectedLoad.coordinates.length > 1) {
        map.on("load", () => {
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: selectedLoad.coordinates,
              },
              properties: {},
            },
          });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#4F8CFF", "line-width": 3, "line-opacity": 0.8 },
          });

          // Origin marker
          const originEl = document.createElement("div");
          originEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#22C55E;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);";
          new mgl.Marker({ element: originEl })
            .setLngLat(selectedLoad.coordinates[0])
            .setPopup(new mgl.Popup().setHTML(`<div style="font-size:12px;padding:4px"><strong>Origin:</strong> ${selectedLoad.origin}</div>`))
            .addTo(map);

          // Destination marker
          const destEl = document.createElement("div");
          destEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#F5A623;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);";
          new mgl.Marker({ element: destEl })
            .setLngLat(selectedLoad.coordinates[selectedLoad.coordinates.length - 1])
            .setPopup(new mgl.Popup().setHTML(`<div style="font-size:12px;padding:4px"><strong>Dest:</strong> ${selectedLoad.destination}</div>`))
            .addTo(map);

          // Fit bounds
          const bounds = new mgl.LngLatBounds();
          selectedLoad.coordinates.forEach((c) => bounds.extend(c as [number, number]));
          map.fitBounds(bounds, { padding: 40 });
        });
      }
    });

    return () => {
      if (map) map.remove();
    };
  }, [showMap, selectedLoad]);

  // --- Has active filters ---
  const hasFilters = originCity || originState || destCity || destState || equipment || pickupDate || deliveryDate || minRpm || maxDeadhead;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Load Board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search public freight loads from TrukTek
        </p>
      </div>

      {/* Search Bar */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          {/* Primary search row */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Origin */}
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  value={originCity}
                  onChange={(e) => setOriginCity(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Origin city"
                  className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div className="relative">
                <input
                  value={originState}
                  onChange={(e) => setOriginState(e.target.value.toUpperCase().slice(0, 2))}
                  onKeyDown={handleKeyDown}
                  placeholder="ST"
                  maxLength={2}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              {/* Destination */}
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 size-4 text-muted-foreground text-amber-500" />
                <input
                  value={destCity}
                  onChange={(e) => setDestCity(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Destination city"
                  className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div className="relative">
                <input
                  value={destState}
                  onChange={(e) => setDestState(e.target.value.toUpperCase().slice(0, 2))}
                  onKeyDown={handleKeyDown}
                  placeholder="ST"
                  maxLength={2}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading} className="gap-1.5 shrink-0">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Search Loads
              </Button>
              <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)} className="shrink-0">
                <SlidersHorizontal className="size-4" />
              </Button>
            </div>
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-border/40"
            >
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Equipment</label>
                <select
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="">All types</option>
                  {EQUIPMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Pickup date</label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Delivery date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Min RPM ($)</label>
                <input
                  type="number"
                  value={minRpm}
                  onChange={(e) => setMinRpm(e.target.value)}
                  placeholder="e.g. 2.50"
                  step="0.1"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Max deadhead (mi)</label>
                <input
                  type="number"
                  value={maxDeadhead}
                  onChange={(e) => setMaxDeadhead(e.target.value)}
                  placeholder="e.g. 200"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300/50 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{results.length}</span> load{results.length !== 1 ? "s" : ""} found
            </p>
            {selectedLoad && (
              <Button variant="outline" size="sm" onClick={() => setShowMap(!showMap)} className="gap-1.5">
                <MapIcon className="size-3.5" />
                {showMap ? "Hide Map" : "Show Map"}
              </Button>
            )}
          </div>

          {/* Map */}
          {showMap && selectedLoad && selectedLoad.coordinates.length > 0 && (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div ref={mapRef} className="h-64 sm:h-80 w-full" />
            </div>
          )}

          {/* Load cards / table */}
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
              <Package className="size-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No loads found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((load) => (
                <LoadCard
                  key={load.loadId}
                  load={load}
                  isSelected={selectedLoad?.loadId === load.loadId}
                  onSelect={() => {
                    setSelectedLoad(load);
                    if (load.coordinates.length > 0) setShowMap(true);
                  }}
                  onSave={() => setSaveDialogLoad(load)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state (before search) */}
      {!results && !loading && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
          <Truck className="size-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-foreground">Search for loads</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Enter an origin, destination, or equipment type to search the TrukTek public load board
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="size-6 text-primary animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">Searching loads…</p>
        </div>
      )}

      {/* Save dialog */}
      {saveDialogLoad && (
        <SaveDialog
          load={saveDialogLoad}
          onSave={() => handleSave(saveDialogLoad)}
          onClose={() => setSaveDialogLoad(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadCard — individual load result
// ---------------------------------------------------------------------------

function LoadCard({
  load,
  isSelected,
  onSelect,
  onSave,
}: {
  load: LoadBoardLoad;
  isSelected: boolean;
  onSelect: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 sm:p-4 transition-all cursor-pointer ${
        isSelected
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border/60 bg-card hover:border-border hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Route */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="truncate">{load.origin}</span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{load.destination}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="size-3" />
              {load.equipment || "—"}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {formatMiles(load.miles)}
            </span>
            {load.hours > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatHours(load.hours)}
              </span>
            )}
            {load.weight > 0 && (
              <span className="flex items-center gap-1">
                <Weight className="size-3" />
                {load.weight.toLocaleString()} lbs
              </span>
            )}
          </div>
        </div>

        {/* Rate & RPM */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">
              {load.ratePay > 0 ? formatCurrency(load.ratePay) : "—"}
            </p>
            {load.grossRpm > 0 && (
              <p className="text-[11px] text-muted-foreground">
                ${load.grossRpm.toFixed(2)}/mi
              </p>
            )}
          </div>

          {/* Shipper */}
          <div className="hidden sm:block text-right max-w-[140px]">
            <p className="text-xs text-muted-foreground truncate" title={load.shipperNm}>
              {load.shipperNm || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(load.pickupDate)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            {load.coordinates.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                title="View on map"
              >
                <MapIcon className="size-3.5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={(e) => { e.stopPropagation(); onSave(); }}
            >
              <Save className="size-3" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaveDialog — confirm saving a load to DispatchOS
// ---------------------------------------------------------------------------

function SaveDialog({
  load,
  onSave,
  onClose,
}: {
  load: LoadBoardLoad;
  onSave: () => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-background p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Save className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Save to DispatchOS</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Add this load to your internal load management system.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 mb-4 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{load.origin}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="font-medium">{load.destination}</span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{load.equipment}</span>
            <span>{formatMiles(load.miles)}</span>
            <span>{load.ratePay > 0 ? formatCurrency(load.ratePay) : "Rate TBD"}</span>
          </div>
          {load.shipperNm && (
            <p className="text-xs text-muted-foreground">Shipper: {load.shipperNm}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          This will create a new load record in your DispatchOS workspace with status "Offered". You can then assign a truck, driver, and manage the full load lifecycle.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Load
          </Button>
        </div>
      </div>
    </div>
  );
}
