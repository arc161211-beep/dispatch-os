import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { TRUCK_STATUSES } from "@/convex/constants";
import { useCanWrite, useTimezone } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, NextActionPill, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Field, Grid, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { ImportCsvDialog, ExportCsvButton } from "@/components/app/ImportExport";
import { Search, Truck, Plus, ExternalLink, MapPin } from "lucide-react";
import { nextAction } from "@/lib/status";
import { useQuery as useConvexQuery } from "convex/react";

type TruckType = Record<string, any> & { _id: string; unitNumber: string; type?: string; carrierId: string; availability: string; currentLocation?: string; currentLoadId?: string; vin?: string; make?: string; model?: string; year?: number; notes?: string; preferredLanes?: string[]; avoidedLanes?: string[]; homeTime?: string };

export default function Trucks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [availability, setAvailability] = useState("");
  const [dialog, setDialog] = useState<"create" | TruckType | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") { setDialog("create"); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  const trucks = useQuery(api.trucks.list, { search: debounced || undefined, availability: availability || undefined }) as TruckType[] | undefined;
  const carriers = useQuery(api.carriers.list, {}) as { _id: string; companyName: string }[] | undefined;
  const setAvail = useMutation(api.trucks.setAvailability);

  const handleAvail = async (t: TruckType, val: string) => {
    try { await setAvail({ id: t._id as any, availability: val as never }); toast.success(`${t.unitNumber} → ${val}`); } catch (e) { toast.error(errorMessage(e)); }
  };

  const columns: Column<TruckType>[] = [
    { key: "unit", header: "Unit #", render: (t) => <div><p className="font-medium">{t.unitNumber}</p><p className="text-xs text-muted-foreground">{t.type ?? "—"} · {t.currentLocation ?? "No location"}</p></div> },
    { key: "carrier", header: "Carrier", hideOnMobile: true, render: (t) => <span className="text-sm text-muted-foreground">{carriers?.find((c) => c._id === t.carrierId)?.companyName ?? "—"}</span> },
    { key: "vehicle", header: "Vehicle", hideOnMobile: true, render: (t) => <span className="text-sm text-muted-foreground">{[t.year, t.make, t.model].filter(Boolean).join(" ") || "—"}</span> },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.availability} /> },
    { key: "next", header: "Next action", hideOnMobile: true, render: (t) => <NextActionPill action={nextAction("truck", t as any)} /> },
    ...(canWrite ? [{ key: "actions" as const, header: "", hideOnMobile: true, render: (t: TruckType) => (
      <div className="flex justify-end gap-1">
        <Link to={`/trucks/${t._id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors" title="View details">
          <ExternalLink className="size-4 text-muted-foreground" />
        </Link>
        <SelectInput value={t.availability} onChange={(e) => handleAvail(t, e.target.value)} className="h-8 w-32 text-xs" onClick={(e) => e.stopPropagation()}>
          {TRUCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDialog(t); }}>Edit</Button>
      </div>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Trucks" description={`${trucks?.length ?? 0} trucks`}
        actions={canWrite && (<>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/truck-map")}><MapPin className="size-3.5" /> View Live Map</Button>
          <ImportCsvDialog entity="trucks" mutationName="importTrucks" title="Import trucks" description="CSV with unitNumber, carrierName, type, make, model, year, plate, currentLocation, availability." requiredColumns={["unitNumber", "carrierName"]} mapRow={(r) => ({ unitNumber: r.unitNumber ?? "", carrierName: r.carrierName ?? "", type: r.type, make: r.make, model: r.model, year: r.year ? Number(r.year) : undefined, plate: r.plate, currentLocation: r.currentLocation, availability: r.availability })} />
          <ExportCsvButton filename="trucks.csv" headers={["Unit #", "Carrier", "Type", "Make", "Model", "Year", "Location", "Status"]} rows={(trucks ?? []).map((t) => [t.unitNumber, carriers?.find((c) => c._id === t.carrierId)?.companyName ?? "", t.type ?? "", t.make ?? "", t.model ?? "", t.year ?? "", t.currentLocation ?? "", t.availability])} />
          <Button size="sm" className="gap-1.5" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New truck</Button>
        </>)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search unit, VIN, location…" className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
        </div>
        <SelectInput value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full sm:w-48">
          <option value="">All statuses</option>
          {TRUCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
      </div>
      {trucks === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={trucks} getKey={(t) => t._id} onRowClick={canWrite ? (t) => setDialog(t) : (t) => navigate(`/trucks/${t._id}`)}
          empty={<EmptyState icon={<Truck className="size-6" />} title="No trucks yet" description="Add your first truck or import a CSV." action={canWrite ? <Button size="sm" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New truck</Button> : undefined} />} />
      )}
      {dialog && <TruckFormDialog truck={dialog === "create" ? null : dialog} carriers={carriers ?? []} onClose={() => setDialog(null)} />}
    </div>
  );
}

function TruckFormDialog({ truck, carriers, onClose }: { truck: TruckType | null; carriers: { _id: string; companyName: string }[]; onClose: () => void }) {
  const create = useMutation(api.trucks.create);
  const update = useMutation(api.trucks.update);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      carrierId: String(fd.get("carrierId") ?? "") as any,
      unitNumber: String(fd.get("unitNumber") ?? ""),
      vin: String(fd.get("vin") ?? "") || undefined,
      type: String(fd.get("type") ?? "") || undefined,
      make: String(fd.get("make") ?? "") || undefined,
      model: String(fd.get("model") ?? "") || undefined,
      year: fd.get("year") ? Number(fd.get("year")) : undefined,
      plate: String(fd.get("plate") ?? "") || undefined,
      currentLocation: String(fd.get("currentLocation") ?? "") || undefined,
      maxWeight: fd.get("maxWeight") ? Number(fd.get("maxWeight")) : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    try {
      if (truck) { await update({ id: truck._id as any, input: input as any } as any); toast.success("Truck updated."); }
      else { await create({ input: input as any } as any); toast.success("Truck created."); }
      onClose();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{truck ? `Edit ${truck.unitNumber}` : "New truck"}</DialogTitle><DialogDescription>Truck/unit details and assignment.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid>
            <Field label="Carrier" required>
              <SelectInput name="carrierId" required defaultValue={truck?.carrierId ?? ""}>
                <option value="">Select carrier</option>
                {carriers.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
              </SelectInput>
            </Field>
            <Field label="Unit number" required><TextInput name="unitNumber" required defaultValue={truck?.unitNumber ?? ""} /></Field>
            <Field label="Type"><TextInput name="type" defaultValue={truck?.type ?? ""} placeholder="Dry Van" /></Field>
            <Field label="Make"><TextInput name="make" defaultValue={truck?.make ?? ""} /></Field>
            <Field label="Model"><TextInput name="model" defaultValue={truck?.model ?? ""} /></Field>
            <Field label="Year"><TextInput name="year" type="number" defaultValue={truck?.year ?? ""} /></Field>
            <Field label="VIN"><TextInput name="vin" defaultValue={truck?.vin ?? ""} /></Field>
            <Field label="Plate"><TextInput name="plate" defaultValue={truck?.plate ?? ""} /></Field>
            <Field label="Current location"><TextInput name="currentLocation" defaultValue={truck?.currentLocation ?? ""} placeholder="Dallas, TX" /></Field>
            <Field label="Max weight (lbs)"><TextInput name="maxWeight" type="number" defaultValue={truck?.maxWeight ?? ""} /></Field>
          </Grid>
          <Field label="Notes"><TextArea name="notes" defaultValue={truck?.notes ?? ""} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : truck ? "Save changes" : "Create truck"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
