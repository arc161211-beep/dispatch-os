import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useMutation, useQuery, useAction } from "convex/react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { LOAD_STATUSES, LOAD_TRANSITIONS, DOCUMENT_TYPES } from "@/convex/constants";
import { useCanWrite, useTimezone } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, Money, SectionCard, LoadingState, KV, errorMessage, ConfirmButton } from "@/components/app/shared";
import { Field, Grid, SelectInput, TextInput, TextArea } from "@/components/app/forms";
import { UploadDocumentButton } from "@/components/app/UploadDocument";
import { RequestSignatureButton } from "@/components/app/RequestSignature";
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/dates";
import { ArrowLeft, FileText, Package, Truck, UserRound, Clock, Route, Wallet, MapPin, ChevronRight, Globe, Loader2, ExternalLink } from "lucide-react";
import { WeatherCard, RouteWeather } from "@/components/app/WeatherCard";
import type { Id } from "@/convex/_generated/dataModel";
import { Timer, CheckCircle2, AlertTriangle } from "lucide-react";

const STATUS_INDEX = LOAD_STATUSES.reduce((acc, s, i) => ({ ...acc, [s]: i }), {} as Record<string, number>);

/** View / Download link for a stored document. */
function DocumentLinkButton({ storageId, fileName, mimeType }: { storageId?: string | null; fileName: string; mimeType?: string | null }) {
  const url = useQuery(api.documents.getUrl, storageId ? { storageId } : "skip");
  if (!url) return null;
  const isImage = mimeType?.startsWith("image/");
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors" title="View">
        <ExternalLink className="size-4 text-muted-foreground" />
      </a>
    );
  }
  return (
    <a href={url} download={fileName} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors" title="Download">
      <ExternalLink className="size-4 text-muted-foreground" />
    </a>
  );
}

export default function LoadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tz = useTimezone();
  const canWrite = useCanWrite();
  const load = useQuery(api.loads.get, { id: id as Id<"loads"> });
  const matches = useQuery(api.matching.matchTrucks, { loadId: id as Id<"loads"> });
  const carriers = useQuery(api.carriers.list, {});
  const trucks = useQuery(api.trucks.list, {});
  const drivers = useQuery(api.drivers.list, {});
  const checklist = useQuery(api.documents.checklist, { loadId: id as Id<"loads"> });
  const sigRequests = useQuery(api.signatures.getByLoad, { loadId: id as Id<"loads"> });
  const setStatus = useMutation(api.loads.setStatus);
  const assignResources = useMutation(api.loads.assignResources);
  const remove = useMutation(api.loads.remove);
  const geocodeLoad = useAction(api.geocoding.geocodeLoad);
  const liveTrip = useQuery(api.loads.getLoadLiveTrip, { loadId: id as Id<"loads"> });
  const calculateETA = useMutation(api.loads.calculateETA);
  const [geocoding, setGeocoding] = useState(false);

  const [statusDialog, setStatusDialog] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [note, setNote] = useState("");

  if (!load) return <LoadingState label="Loading load…" />;

  const { load: l, broker, shipper, carrier, truck, driver, statusHistory, rateHistory, documents, invoices } = load;
  const transitions = LOAD_TRANSITIONS[l.status as keyof typeof LOAD_TRANSITIONS] ?? [];

  const handleStatus = async (newStatus: string) => {
    try {
      await setStatus({ id: l._id as any, status: newStatus as never, note: note || undefined });
      toast.success(`Status → ${newStatus}`);
      setStatusDialog(null); setNote("");
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await assignResources({
        id: l._id as any,
        carrierId: (String(fd.get("carrierId") || "") || undefined) as any,
        truckId: (String(fd.get("truckId") || "") || undefined) as any,
        driverId: (String(fd.get("driverId") || "") || undefined) as any,
      });
      toast.success("Resources updated."); setAssignDialog(false);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleDelete = async () => {
    try { await remove({ id: l._id as any }); toast.success("Load deleted."); navigate("/loads"); } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleCalculateETA = async () => {
    try {
      await calculateETA({ loadId: l._id as any });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const handleGeocode = async () => {
    setGeocoding(true);
    try {
      const result = await geocodeLoad({ loadId: l._id as any });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setGeocoding(false);
    }
  };

  const hasOriginCoords = l.originLat != null && l.originLng != null;
  const hasDestCoords = l.destinationLat != null && l.destinationLng != null;
  const hasAllCoords = hasOriginCoords && hasDestCoords;

  const currentIndex = STATUS_INDEX[l.status] ?? 0;
  const progress = ((currentIndex) / (LOAD_STATUSES.length - 1)) * 100;

  return (
    <div className="space-y-6 pb-8">
      {/* Back nav */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/loads")} className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">Loads</span>
        <ChevronRight className="size-3 text-muted-foreground/40" />
        <span className="text-xs font-medium">{l.loadNumber}</span>
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/80"
      >
        <div className="relative z-10 p-6">
          {/* Top row: load number + status */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4F8CFF]">Load #{l.loadNumber}</span>
                <StatusBadge status={l.status} />
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">
                {l.origin ?? "?"}
                <span className="mx-2 text-muted-foreground/40">→</span>
                {l.destination ?? "?"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Truck className="size-3" /> {l.equipment ?? "Any"}</span>
                {l.weight && <span className="flex items-center gap-1"><Package className="size-3" /> {l.weight.toLocaleString()} lbs</span>}
                <span className="flex items-center gap-1"><Clock className="size-3" /> Pickup {fmtDate(l.pickupDate, tz)}</span>
                <span className="flex items-center gap-1"><MapPin className="size-3" /> Delivery {fmtDate(l.deliveryDate, tz)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold tabular-nums"><Money cents={l.grossRateCents} /></p>
              <p className="text-xs text-muted-foreground mt-0.5">Gross rate</p>
            </div>
          </div>

          {/* Parties row */}
          <div className="mt-4 flex flex-wrap gap-2">
            {carrier?.companyName && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#4F8CFF]/10 px-2.5 py-1 text-[11px] font-medium text-[#4F8CFF]">
                <Truck className="size-3" /> {carrier.companyName}
              </span>
            )}
            {driver?.name && (
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <UserRound className="size-3" /> {driver.name}
              </span>
            )}
            {broker?.company && (
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                Broker: {broker.company}
              </span>
            )}
          </div>

          {/* Status progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              <span>Status Progress</span>
              <span>{l.status}</span>
            </div>
            <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#4F8CFF] to-[#4F8CFF]/80"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(progress, 2)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            {/* Milestones */}
            <div className="mt-2 flex justify-between text-[9px] text-muted-foreground/60">
              <span>Draft</span>
              <span>Booked</span>
              <span>Pickup</span>
              <span>Transit</span>
              <span>Delivered</span>
              <span>Done</span>
            </div>
          </div>

          {/* Action buttons */}
          {canWrite && (
            <div className="mt-5 flex flex-wrap gap-2">
              {transitions.length > 0 && (
                <Button size="sm" className="gap-1.5 bg-[#4F8CFF] hover:bg-[#4F8CFF]/90 shadow-lg shadow-[#4F8CFF]/20" onClick={() => setStatusDialog(transitions[0])}>
                  <Route className="size-3.5" /> Advance to {transitions[0]}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setAssignDialog(true)} className="gap-1.5">
                <Truck className="size-3.5" /> Assign
              </Button>
              {l.status === "Draft" && (
                <ConfirmButton trigger={<Button size="sm" variant="destructive">Delete</Button>} title="Delete load?" description="This action cannot be undone." onConfirm={handleDelete} confirmLabel="Delete" />
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══════════ LIVE TRIP SECTION ═══════════ */}
      {liveTrip && liveTrip.truck && ["In Transit", "At Pickup", "Loaded", "At Delivery"].includes(l.status) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-border/50 bg-card overflow-hidden"
        >
          <div className="bg-electric/5 border-b border-electric/10 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-electric">Live Trip</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleCalculateETA}>
              <Timer className="size-3 mr-1" /> Refresh ETA
            </Button>
          </div>
          <div className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Driver</p>
                <p className="text-sm font-semibold">{liveTrip.driver?.name ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">Truck: {liveTrip.truck.unitNumber}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Current Location</p>
                {liveTrip.latestLocation ? (
                  <>
                    <p className="text-sm font-semibold">{liveTrip.latestLocation.lat.toFixed(4)}, {liveTrip.latestLocation.lon.toFixed(4)}</p>
                    <p className="text-[10px] text-muted-foreground">Updated {fmtRelative(liveTrip.latestLocation.at)}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No GPS data</p>
                )}
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">ETA</p>
                {liveTrip.load.eta ? (
                  <>
                    <p className="text-sm font-semibold">
                      {new Date(liveTrip.load.eta).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {liveTrip.load.etaDistanceMiles ?? "—"} mi · {liveTrip.load.etaDurationSeconds ? `${Math.floor(liveTrip.load.etaDurationSeconds / 3600)}h ${Math.round((liveTrip.load.etaDurationSeconds % 3600) / 60)}m` : "—"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                {liveTrip.load.deliveryRisk === "delayed" ? (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-[#EF4444]" />
                    <span className="text-sm font-semibold text-[#EF4444]">DELAYED</span>
                  </div>
                ) : liveTrip.load.deliveryRisk === "at_risk" ? (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-[#F5A623]" />
                    <span className="text-sm font-semibold text-[#F5A623]">AT RISK</span>
                  </div>
                ) : liveTrip.load.deliveryRisk === "on_time" ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-[#22C55E]" />
                    <span className="text-sm font-semibold text-[#22C55E]">ON TIME</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Unknown</p>
                )}
                {liveTrip.load.delayMinutes != null && liveTrip.load.delayMinutes > 0 && (
                  <p className="text-[10px] text-[#EF4444]">{liveTrip.load.delayMinutes} min late</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="signatures">Signatures ({sigRequests?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="matching">Load match</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Route Weather — show when coordinates are available */}
          {hasAllCoords && (
            <RouteWeather
              originLabel={l.origin ?? "Origin"}
              originLat={l.originLat!}
              originLng={l.originLng!}
              destLabel={l.destination ?? "Destination"}
              destLat={l.destinationLat!}
              destLng={l.destinationLng!}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SectionCard title="Route & schedule">
              <KV label="Origin">{l.origin ?? "—"}</KV>
              {hasOriginCoords && (
                <KV label="Origin Coords">
                  <span className="flex items-center gap-1 font-mono text-xs">
                    <MapPin className="size-3 text-[#22C55E]" />
                    {l.originLat!.toFixed(4)}, {l.originLng!.toFixed(4)}
                  </span>
                </KV>
              )}
              <KV label="Destination">{l.destination ?? "—"}</KV>
              {hasDestCoords && (
                <KV label="Dest Coords">
                  <span className="flex items-center gap-1 font-mono text-xs">
                    <MapPin className="size-3 text-[#F5A623]" />
                    {l.destinationLat!.toFixed(4)}, {l.destinationLng!.toFixed(4)}
                  </span>
                </KV>
              )}
              <KV label="Pickup">{fmtDateTime(l.pickupDate, tz)}</KV>
              <KV label="Delivery">{fmtDateTime(l.deliveryDate, tz)}</KV>
              <KV label="Loaded miles">{l.loadedMiles ?? "—"}</KV>
              <KV label="Deadhead">{l.deadheadMiles ?? "—"}</KV>
              {!hasAllCoords && (
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleGeocode}
                    disabled={geocoding}
                  >
                    {geocoding ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />}
                    {geocoding ? "Resolving…" : "Resolve Location"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Location coordinates unavailable — click to resolve
                  </p>
                </div>
              )}
            </SectionCard>
            <SectionCard title="Load details">
              <KV label="Equipment">{l.equipment ?? "—"}</KV>
              <KV label="Commodity">{l.commodity ?? "—"}</KV>
              <KV label="Weight">{l.weight ? `${l.weight.toLocaleString()} lbs` : "—"}</KV>
              <KV label="Priority">{l.priority ?? "Normal"}</KV>
              <KV label="Source">{l.source ?? "manual"}</KV>
            </SectionCard>
            <SectionCard title="Parties">
              <KV label="Broker">{broker?.company ?? "—"}</KV>
              <KV label="Broker contact">{broker?.contactName ?? "—"}</KV>
              <KV label="Shipper">{shipper?.company ?? "—"}</KV>
              <KV label="Carrier">{carrier?.companyName ?? "—"}</KV>
              <KV label="Truck">{truck?.unitNumber ?? "—"}</KV>
              <KV label="Driver">{driver?.name ?? "—"}</KV>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="financials" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SectionCard title="Revenue">
              <KV label="Gross rate"><Money cents={l.grossRateCents} /></KV>
              <KV label="Fuel surcharge"><Money cents={l.fuelSurchargeCents} /></KV>
              <KV label="Accessorials"><Money cents={l.accessorialsCents} /></KV>
              <KV label="RPM">{l.rpm ? `$${l.rpm.toFixed(2)}/mi` : "—"}</KV>
            </SectionCard>
            <SectionCard title="Dispatcher fee">
              <KV label="Fee type">{l.feeType ?? (carrier as any)?.feeType ?? "percentage"}</KV>
              <KV label="Fee rate">{l.feeRatePercent ? `${l.feeRatePercent}%` : l.flatFeeCents ? `$${(l.flatFeeCents / 100).toFixed(2)} flat` : "—"}</KV>
              {(carrier as any)?.feeRatePercent && <KV label="Carrier default">{(carrier as any).feeRatePercent}%</KV>}
              <KV label="Dispatcher fee"><Money cents={l.feeCents} className="text-[#4F8CFF] font-semibold" /></KV>
              <KV label="Carrier amount"><Money cents={l.carrierAmountCents} /></KV>
            </SectionCard>
            <SectionCard title="Invoices">
              {invoices.length === 0 ? <p className="text-sm text-muted-foreground py-2">No invoices for this load.</p> : invoices.map((inv) => (
                <div key={inv._id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div><p className="text-sm font-medium">{inv.invoiceNumber}</p><p className="text-xs text-muted-foreground"><Money cents={inv.amountCents - inv.paidCents} /> outstanding</p></div>
                  <StatusBadge status={inv.status} />
                </div>
              ))}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="signatures" className="space-y-4 mt-4">
          <SectionCard title="Signature Requests">
            {!sigRequests || sigRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No signature requests for this load.</p>
            ) : (
              <div className="divide-y">
                {sigRequests.map((sr) => (
                  <div key={sr.request._id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{sr.document?.fileName ?? "Document"}</span>
                      <Badge variant="outline" className={sr.request.status === "completed" ? "bg-emerald-500/10 text-emerald-600 border-transparent" : sr.request.status === "pending" || sr.request.status === "in_progress" ? "bg-amber-500/10 text-amber-600 border-transparent" : "bg-muted text-muted-foreground border-transparent"}>
                        {sr.request.status === "completed" ? "Completed" : sr.request.status.charAt(0).toUpperCase() + sr.request.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      {sr.signers.map((signer: any) => (
                        <div key={signer._id} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{signer.signerName} ({signer.role})</span>
                          <span className={signer.status === "signed" ? "text-emerald-600" : signer.status === "declined" ? "text-red-600" : signer.status === "viewed" ? "text-amber-600" : "text-muted-foreground"}>
                            {signer.status.charAt(0).toUpperCase() + signer.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          <SectionCard title="Document checklist" actions={<UploadDocumentButton entityType="load" entityId={id} />}>
            {checklist?.map((item) => (
              <div key={item.type} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm font-medium">{item.type}</span>
                <Badge variant="outline" className={item.status === "received" ? "bg-[#22C55E]/10 text-[#22C55E] border-transparent" : "bg-[#F5A623]/10 text-[#F5A623] border-transparent"}>
                  {item.status === "received" ? "Received" : "Missing"}
                </Badge>
              </div>
            ))}
          </SectionCard>
          {documents.length > 0 && (
            <SectionCard title="All documents">
              <div className="divide-y">
                {documents.map((d) => (
                  <div key={d._id} className="flex items-center justify-between py-2">
                    <div><p className="text-sm font-medium">{d.fileName}</p><p className="text-xs text-muted-foreground">{d.type} · {d.uploadedByName ?? "—"}</p></div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{d.type}</Badge>
                      <DocumentLinkButton storageId={d.storageId} fileName={d.fileName} mimeType={d.mimeType} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <SectionCard title="Status history">
            {statusHistory.length === 0 ? <p className="text-sm text-muted-foreground py-2">No status changes recorded.</p> : (
              <div className="space-y-3">
                {statusHistory.map((h) => (
                  <div key={h._id} className="flex items-start gap-3">
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-[#4F8CFF]" />
                    <div>
                      <p className="text-sm">{h.from ? `${h.from} → ` : ""}{h.to}</p>
                      <p className="text-xs text-muted-foreground">{h.actorName ?? "System"} · {fmtDateTime(h.at, tz)}</p>
                      {h.note && <p className="text-xs text-muted-foreground mt-0.5 italic">{h.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          {rateHistory.length > 0 && (
            <SectionCard title="Rate changes">
              <div className="divide-y">
                {rateHistory.map((r) => (
                  <div key={r._id} className="py-2">
                    <p className="text-sm">{r.field}: <Money cents={r.previousCents} /> → <Money cents={r.newCents} /></p>
                    <p className="text-xs text-muted-foreground">{r.actorName ?? "System"} · {fmtDateTime(r.at, tz)}{r.reason ? ` · ${r.reason}` : ""}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="matching" className="space-y-4 mt-4">
          <SectionCard title="Load match scores" description="Operational match — not a legal or HOS certification.">
            {!matches || matches.length === 0 ? <p className="text-sm text-muted-foreground py-2">No trucks to match.</p> : (
              <div className="space-y-3">
                {matches.slice(0, 10).map((m) => (
                  <div key={m.truckId} className={`flex items-center gap-4 rounded-lg border p-3 ${m.alreadyAssigned ? "border-[#4F8CFF] bg-[#4F8CFF]/5" : ""}`}>
                    <div className="text-center">
                      <p className="text-2xl font-bold tabular-nums">{m.match.score}</p>
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">score</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.unitNumber} <span className="text-muted-foreground">({m.type})</span> {m.alreadyAssigned && <Badge variant="outline" className="ml-1 text-[10px]">Assigned</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{m.currentLocation || "No location"} · {m.availability}</p>
                      {m.driverName && <p className="text-xs text-muted-foreground">Driver: {m.driverName} ({m.driverAvailability})</p>}
                      {m.match.reasons.length > 0 && <p className="text-xs text-[#22C55E] mt-1">{m.match.reasons[0]}</p>}
                      {m.match.concerns.length > 0 && <p className="text-xs text-[#F5A623] mt-0.5">{m.match.concerns[0]}</p>}
                    </div>
                    <Badge variant="outline" className={m.match.tier === "Strong Match" ? "bg-[#22C55E]/10 text-[#22C55E] border-transparent" : m.match.tier === "Good Match" ? "bg-[#4F8CFF]/10 text-[#4F8CFF] border-transparent" : "border-transparent"}>
                      {m.match.tier}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Status advance dialog */}
      {statusDialog && (
        <Dialog open onOpenChange={() => setStatusDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Advance status</DialogTitle>
              <DialogDescription>Move "{l.status}" to one of the allowed next states.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {transitions.map((s) => (
                <Button key={s} variant="outline" className="w-full justify-start hover:bg-[#4F8CFF]/5 hover:border-[#4F8CFF]/20" onClick={() => handleStatus(s)}>{s}</Button>
              ))}
            </div>
            <Field label="Note (optional)"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for this transition" /></Field>
            <DialogFooter><Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign resources dialog */}
      {assignDialog && (
        <Dialog open onOpenChange={() => setAssignDialog(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Assign resources</DialogTitle><DialogDescription>Assign a carrier, truck, and driver to this load.</DialogDescription></DialogHeader>
            <form onSubmit={handleAssign} className="space-y-4">
              <Field label="Carrier">
                <SelectInput name="carrierId" defaultValue={l.carrierId ?? ""}>
                  <option value="">Unassigned</option>
                  {carriers?.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                </SelectInput>
              </Field>
              <Field label="Truck">
                <SelectInput name="truckId" defaultValue={l.truckId ?? ""}>
                  <option value="">Unassigned</option>
                  {trucks?.map((t) => <option key={t._id} value={t._id}>{t.unitNumber} ({t.type ?? "—"})</option>)}
                </SelectInput>
              </Field>
              <Field label="Driver">
                <SelectInput name="driverId" defaultValue={l.driverId ?? ""}>
                  <option value="">Unassigned</option>
                  {drivers?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </SelectInput>
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
                <Button type="submit">Save assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
