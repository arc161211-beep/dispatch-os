import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { LOAD_STATUSES, EQUIPMENT_TYPES } from "@/convex/constants";
import { useCanWrite, useTimezone } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, NextActionPill, Money, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Field, Grid, MoneyInput, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { ImportCsvDialog, ExportCsvButton } from "@/components/app/ImportExport";
import { Search, Package, Plus } from "lucide-react";
import { nextAction } from "@/lib/status";
import { fmtDate, fmtDateTime } from "@/lib/dates";

type LoadType = any;

export default function Loads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tz = useTimezone();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<"create" | LoadType | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") { setDialog("create"); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  const loads = useQuery(api.loads.list, { search: debounced || undefined, status: status || undefined });
  const carriers = useQuery(api.carriers.list, {});

  const columns: Column<LoadType>[] = [
    { key: "number", header: "Load #", render: (l) => <div><p className="font-medium">{l.loadNumber}</p><p className="text-xs text-muted-foreground">{l.equipment ?? "—"}</p></div> },
    { key: "lane", header: "Lane", render: (l) => <div className="text-sm"><p>{l.origin ?? "?"} → {l.destination ?? "?"}</p>{l.pickupDate && <p className="text-xs text-muted-foreground">{fmtDate(l.pickupDate, tz)}</p>}</div> },
    { key: "carrier", header: "Carrier", hideOnMobile: true, render: (l) => <span className="text-sm text-muted-foreground">{carriers?.find((c) => c._id === l.carrierId)?.companyName ?? "—"}</span> },
    { key: "rate", header: "Rate", hideOnMobile: true, render: (l) => <Money cents={l.grossRateCents} className="text-sm" /> },
    { key: "rpm", header: "RPM", hideOnMobile: true, render: (l) => <span className="text-sm text-muted-foreground">{l.rpm ? `$${l.rpm.toFixed(2)}` : "—"}</span> },
    { key: "fee", header: "Fee", hideOnMobile: true, render: (l) => <Money cents={l.feeCents} className="text-sm text-primary" /> },
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
    { key: "next", header: "Next action", hideOnMobile: true, render: (l) => <NextActionPill action={nextAction("load", l)} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Loads" description={`${loads?.length ?? 0} loads`}
        actions={canWrite && (<>
          <ImportCsvDialog entity="loads" mutationName="importLoads" title="Import loads" description="CSV with origin, destination, pickupDate, deliveryDate, grossRateCents, carrierName, brokerName, equipment, loadedMiles." requiredColumns={[]} mapRow={(r) => ({ externalId: r.externalId, brokerName: r.brokerName, carrierName: r.carrierName, truckUnit: r.truckUnit, equipment: r.equipment, commodity: r.commodity, weight: r.weight ? Number(r.weight) : undefined, origin: r.origin, destination: r.destination, pickupDate: r.pickupDate ? new Date(r.pickupDate).getTime() : undefined, deliveryDate: r.deliveryDate ? new Date(r.deliveryDate).getTime() : undefined, loadedMiles: r.loadedMiles ? Number(r.loadedMiles) : undefined, deadheadMiles: r.deadheadMiles ? Number(r.deadheadMiles) : undefined, grossRateCents: r.grossRateCents ? Math.round(Number(r.grossRateCents) * 100) : undefined, status: r.status })} />
          <ExportCsvButton filename="loads.csv" headers={["Load #", "Origin", "Destination", "Pickup", "Delivery", "Carrier", "Rate", "Status"]} rows={(loads ?? []).map((l) => [l.loadNumber, l.origin ?? "", l.destination ?? "", l.pickupDate ? new Date(l.pickupDate).toISOString() : "", l.deliveryDate ? new Date(l.deliveryDate).toISOString() : "", carriers?.find((c) => c._id === l.carrierId)?.companyName ?? "", l.grossRateCents ? (l.grossRateCents / 100).toFixed(2) : "", l.status])} />
          <Button size="sm" className="gap-1.5" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New load</Button>
        </>)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search load #, origin, destination…" className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
        </div>
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-48">
          <option value="">All statuses</option>
          {LOAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
      </div>
      {loads === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={loads} getKey={(l) => l._id} onRowClick={(l) => navigate(`/loads/${l._id}`)}
          empty={<EmptyState icon={<Package className="size-6" />} title="No loads yet" description="Create your first load or import a CSV." action={canWrite ? <Button size="sm" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New load</Button> : undefined} />} />
      )}
      {dialog && <LoadFormDialog load={dialog === "create" ? null : dialog} carriers={carriers ?? []} onClose={() => setDialog(null)} />}
    </div>
  );
}

function LoadFormDialog({ load, carriers, onClose }: { load: LoadType | null; carriers: { _id: string; companyName: string; feeType: string; feeRatePercent?: number }[]; onClose: () => void }) {
  const create = useMutation(api.loads.create);
  const update = useMutation(api.loads.update);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      carrierId: String(fd.get("carrierId") ?? "") || undefined,
      equipment: String(fd.get("equipment") ?? "") || undefined,
      commodity: String(fd.get("commodity") ?? "") || undefined,
      weight: fd.get("weight") ? Number(fd.get("weight")) : undefined,
      origin: String(fd.get("origin") ?? "") || undefined,
      destination: String(fd.get("destination") ?? "") || undefined,
      pickupDate: fd.get("pickupDate") ? new Date(String(fd.get("pickupDate"))).getTime() : undefined,
      pickupTime: String(fd.get("pickupTime") ?? "") || undefined,
      deliveryDate: fd.get("deliveryDate") ? new Date(String(fd.get("deliveryDate"))).getTime() : undefined,
      deliveryTime: String(fd.get("deliveryTime") ?? "") || undefined,
      loadedMiles: fd.get("loadedMiles") ? Number(fd.get("loadedMiles")) : undefined,
      deadheadMiles: fd.get("deadheadMiles") ? Number(fd.get("deadheadMiles")) : undefined,
      grossRateCents: fd.get("grossRate") ? Math.round(Number(fd.get("grossRate")) * 100) : undefined,
      fuelSurchargeCents: fd.get("fuelSurcharge") ? Math.round(Number(fd.get("fuelSurcharge")) * 100) : undefined,
      accessorialsCents: fd.get("accessorials") ? Math.round(Number(fd.get("accessorials")) * 100) : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    try {
      if (load) { await update({ id: load._id as any, input: input as any }); toast.success("Load updated."); }
      else { await create({ input: input as any }); toast.success("Load created."); }
      onClose();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{load ? `Edit ${load.loadNumber}` : "New load"}</DialogTitle><DialogDescription>Load details and financials.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid cols={3}>
            <Field label="Carrier">
              <SelectInput name="carrierId" defaultValue={load?.carrierId ?? ""}>
                <option value="">Unassigned</option>
                {carriers.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
              </SelectInput>
            </Field>
            <Field label="Equipment">
              <SelectInput name="equipment" defaultValue={load?.equipment ?? ""}>
                <option value="">Any</option>
                {EQUIPMENT_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
              </SelectInput>
            </Field>
            <Field label="Commodity"><TextInput name="commodity" defaultValue={load?.commodity ?? ""} placeholder="General freight" /></Field>
          </Grid>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Origin</p>
              <TextInput name="origin" defaultValue={load?.origin ?? ""} placeholder="Dallas, TX" />
              <TextInput name="pickupDate" type="date" defaultValue={load?.pickupDate ? new Date(load.pickupDate).toISOString().split("T")[0] : ""} />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
              <TextInput name="destination" defaultValue={load?.destination ?? ""} placeholder="Houston, TX" />
              <TextInput name="deliveryDate" type="date" defaultValue={load?.deliveryDate ? new Date(load.deliveryDate).toISOString().split("T")[0] : ""} />
            </div>
          </div>
          <Grid cols={4}>
            <Field label="Loaded miles"><TextInput name="loadedMiles" type="number" defaultValue={load?.loadedMiles ?? ""} /></Field>
            <Field label="Deadhead miles"><TextInput name="deadheadMiles" type="number" defaultValue={load?.deadheadMiles ?? ""} /></Field>
            <Field label="Weight (lbs)"><TextInput name="weight" type="number" defaultValue={load?.weight ?? ""} /></Field>
          </Grid>
          <Grid cols={4}>
            <Field label="Gross rate ($)"><MoneyInput name="grossRate" defaultValue={load?.grossRateCents ? (load.grossRateCents / 100).toFixed(2) : ""} /></Field>
            <Field label="Fuel surcharge ($)"><MoneyInput name="fuelSurcharge" defaultValue={load?.fuelSurchargeCents ? (load.fuelSurchargeCents / 100).toFixed(2) : ""} /></Field>
            <Field label="Accessorials ($)"><MoneyInput name="accessorials" defaultValue={load?.accessorialsCents ? (load.accessorialsCents / 100).toFixed(2) : ""} /></Field>
          </Grid>
          <Field label="Notes"><TextArea name="notes" defaultValue={load?.notes ?? ""} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : load ? "Save changes" : "Create load"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
