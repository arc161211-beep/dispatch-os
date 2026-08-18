import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
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
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/dates";
import { ArrowLeft, FileText, Package, Truck, UserRound, Clock, Route, Wallet } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

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
  const setStatus = useMutation(api.loads.setStatus);
  const assignResources = useMutation(api.loads.assignResources);
  const remove = useMutation(api.loads.remove);

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
    try {              await assignResources({
        id: l._id as any,
        carrierId: (String(fd.get("carrierId") || "") || undefined) as any,
        truckId: (String(fd.get("truckId") || "") || undefined) as any,
        driverId: (String(fd.get("driverId") || "") || undefined) as any,
      });
      toast.success("Resources updated."); setAssignDialog(false);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleDelete = async () => {
    try {      await remove({ id: l._id as any }); toast.success("Load deleted."); navigate("/loads"); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/loads")}><ArrowLeft className="size-4" /></Button>
        <PageHeader title={l.loadNumber} description={`${l.origin ?? "?"} → ${l.destination ?? "?"}`} actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={l.status} className="text-sm" />
            {canWrite && transitions.length > 0 && (
              <Button size="sm" className="gap-1.5" onClick={() => setStatusDialog(transitions[0])}>
                <Route className="size-3.5" /> Advance status
              </Button>
            )}
            {canWrite && (
              <Button size="sm" variant="outline" onClick={() => setAssignDialog(true)} className="gap-1.5">
                <Truck className="size-3.5" /> Assign
              </Button>
            )}
            {canWrite && l.status === "Draft" && (
              <ConfirmButton trigger={<Button size="sm" variant="destructive">Delete</Button>} title="Delete load?" description="This action cannot be undone." onConfirm={handleDelete} confirmLabel="Delete" />
            )}
          </div>
        } />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="matching">Load match</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SectionCard title="Route & schedule">
              <KV label="Origin">{l.origin ?? "—"}</KV>
              <KV label="Destination">{l.destination ?? "—"}</KV>
              <KV label="Pickup">{fmtDateTime(l.pickupDate, tz)}</KV>
              <KV label="Delivery">{fmtDateTime(l.deliveryDate, tz)}</KV>
              <KV label="Loaded miles">{l.loadedMiles ?? "—"}</KV>
              <KV label="Deadhead">{l.deadheadMiles ?? "—"}</KV>
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
              <KV label="Dispatcher fee"><Money cents={l.feeCents} className="text-primary font-semibold" /></KV>
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

        <TabsContent value="documents" className="space-y-4 mt-4">
          <SectionCard title="Document checklist" actions={<UploadDocumentButton entityType="load" entityId={id} />}>
            {checklist?.map((item) => (
              <div key={item.type} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm font-medium">{item.type}</span>
                <Badge variant="outline" className={item.status === "received" ? "bg-emerald-500/10 text-emerald-600 border-transparent" : "bg-amber-500/10 text-amber-600 border-transparent"}>
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
                    <Badge variant="outline">{d.type}</Badge>
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
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
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
                  <div key={m.truckId} className={`flex items-center gap-4 rounded-lg border p-3 ${m.alreadyAssigned ? "border-primary bg-primary/5" : ""}`}>
                    <div className="text-center">
                      <p className="text-2xl font-bold tabular-nums">{m.match.score}</p>
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">score</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.unitNumber} <span className="text-muted-foreground">({m.type})</span> {m.alreadyAssigned && <Badge variant="outline" className="ml-1 text-[10px]">Assigned</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{m.currentLocation || "No location"} · {m.availability}</p>
                      {m.driverName && <p className="text-xs text-muted-foreground">Driver: {m.driverName} ({m.driverAvailability})</p>}
                      {m.match.reasons.length > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{m.match.reasons[0]}</p>}
                      {m.match.concerns.length > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{m.match.concerns[0]}</p>}
                    </div>
                    <Badge variant="outline" className={m.match.tier === "Strong Match" ? "bg-emerald-500/10 text-emerald-600 border-transparent" : m.match.tier === "Good Match" ? "bg-blue-500/10 text-blue-600 border-transparent" : "border-transparent"}>
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
                <Button key={s} variant="outline" className="w-full justify-start" onClick={() => handleStatus(s)}>{s}</Button>
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
