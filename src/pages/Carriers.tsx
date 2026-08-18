import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { CARRIER_STATUSES, EQUIPMENT_TYPES, FEE_TYPES } from "@/convex/constants";
import { useCanWrite } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, NextActionPill, LoadingState, EmptyState, Money, errorMessage } from "@/components/app/shared";
import { Field, Grid, MoneyInput, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { ImportCsvDialog, ExportCsvButton } from "@/components/app/ImportExport";
import { Search, Building2, Plus } from "lucide-react";
import { nextAction } from "@/lib/status";
import { fmtDate } from "@/lib/dates";
import { useTimezone } from "@/hooks/use-app";

type Carrier = NonNullable<ReturnType<typeof useQuery<typeof api.carriers.list>>[number]>;

export default function Carriers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tz = useTimezone();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<"create" | Carrier | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setDialog("create");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const carriers = useQuery(api.carriers.list, { search: debounced || undefined, status: status || undefined });
  const setStatusMut = useMutation(api.carriers.setStatus);

  const handleStatus = async (c: Carrier, s: string) => {
    try {
      await setStatusMut({ id: c._id, status: s as never });
      toast.success(`${c.companyName} → ${s}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: Column<Carrier>[] = [
    {
      key: "company",
      header: "Company",
      render: (c) => (
        <div>
          <p className="font-medium">{c.companyName}</p>
          <p className="text-xs text-muted-foreground">{[c.mcNumber, c.usdot].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      ),
    },
    { key: "contact", header: "Contact", hideOnMobile: true, render: (c) => (
      <div className="text-sm">
        <p>{c.contactName || "—"}</p>
        <p className="text-xs text-muted-foreground">{c.phone || c.email || ""}</p>
      </div>
    ) },
    {
      key: "fee",
      header: "Fee",
      hideOnMobile: true,
      render: (c) =>
        c.feeType === "flat" ? (
          <span className="text-sm"><Money cents={c.flatFeeCents} /> flat</span>
        ) : (
          <span className="text-sm">
            {c.feeRatePercent ?? 0}%{c.feeMinCents ? ` min ${(c.feeMinCents / 100).toFixed(0)}` : ""}{c.feeMaxCents ? ` max ${(c.feeMaxCents / 100).toFixed(0)}` : ""}
          </span>
        ),
    },
    { key: "equipment", header: "Equipment", hideOnMobile: true, render: (c) => <span className="text-xs text-muted-foreground">{(c.equipment ?? []).join(", ") || "—"}</span> },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    {
      key: "next",
      header: "Next action",
      hideOnMobile: true,
      render: (c) => <NextActionPill action={nextAction("carrier", c)} />,
    },
    ...(canWrite
      ? [{
          key: "actions",
          header: "",
          hideOnMobile: true,
          render: (c: Carrier) => (
            <div className="flex justify-end gap-1">
              <SelectInput
                value={c.status}
                onChange={(e) => handleStatus(c, e.target.value)}
                className="h-8 w-32 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                {CARRIER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDialog(c); }}>Edit</Button>
            </div>
          ),
        } satisfies Column<Carrier>]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carriers"
        description={`${carriers?.length ?? 0} carrier clients`}
        actions={
          canWrite && (
            <>
              <ImportCsvDialog
                entity="carriers"
                mutationName="importCarriers"
                title="Import carriers"
                description="Upload a CSV with companyName and optional contactName, email, phone, mcNumber, usdot, equipment, fleetSize, feeType (percentage|flat), feeRatePercent, status."
                requiredColumns={["companyName"]}
                mapRow={(r) => ({
                  companyName: r.companyName ?? "",
                  contactName: r.contactName,
                  email: r.email,
                  phone: r.phone,
                  mcNumber: r.mcNumber,
                  usdot: r.usdot,
                  equipment: r.equipment,
                  fleetSize: r.fleetSize ? Number(r.fleetSize) : undefined,
                  feeType: r.feeType,
                  feeRatePercent: r.feeRatePercent ? Number(r.feeRatePercent) : undefined,
                  status: r.status,
                })}
              />
              <ExportCsvButton
                filename="carriers.csv"
                headers={["Company", "Contact", "Phone", "Email", "MC", "USDOT", "Equipment", "Fleet size", "Fee type", "Fee %", "Status"]}
                rows={(carriers ?? []).map((c) => [c.companyName, c.contactName ?? "", c.phone ?? "", c.email ?? "", c.mcNumber ?? "", c.usdot ?? "", (c.equipment ?? []).join("; "), c.fleetSize ?? "", c.feeType, c.feeRatePercent ?? "", c.status])}
              />
              <Button size="sm" className="gap-1.5" onClick={() => setDialog("create")}>
                <Plus className="size-3.5" /> New carrier
              </Button>
            </>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, MC, contact…"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-48">
          <option value="">All statuses</option>
          {CARRIER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </SelectInput>
      </div>

      {carriers === undefined ? (
        <LoadingState />
      ) : (
        <ResponsiveTable
          columns={columns}
          rows={carriers}
          getKey={(c) => c._id}
          onRowClick={(c) => navigate(`/carriers/${c._id}`)}
          empty={<EmptyState icon={<Building2 className="size-6" />} title="No carriers yet" description="Add your first carrier client or import a CSV." action={canWrite ? <Button size="sm" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New carrier</Button> : undefined} />}
        />
      )}

      {dialog && <CarrierFormDialog carrier={dialog === "create" ? null : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

export function CarrierFormDialog({ carrier, onClose, defaultStatus }: { carrier: Carrier | null; onClose: () => void; defaultStatus?: string }) {
  const create = useMutation(api.carriers.create);
  const update = useMutation(api.carriers.update);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const feeType = fd.get("feeType") as string;
    const input = {
      companyName: String(fd.get("companyName") ?? ""),
      legalName: String(fd.get("legalName") ?? "") || undefined,
      dba: String(fd.get("dba") ?? "") || undefined,
      contactName: String(fd.get("contactName") ?? "") || undefined,
      email: String(fd.get("email") ?? "") || undefined,
      phone: String(fd.get("phone") ?? "") || undefined,
      address: String(fd.get("address") ?? "") || undefined,
      mcNumber: String(fd.get("mcNumber") ?? "") || undefined,
      usdot: String(fd.get("usdot") ?? "") || undefined,
      equipment: String(fd.get("equipment") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      fleetSize: fd.get("fleetSize") ? Number(fd.get("fleetSize")) : undefined,
      preferredLanes: String(fd.get("preferredLanes") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      avoidedLanes: String(fd.get("avoidedLanes") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      homeTime: String(fd.get("homeTime") ?? "") || undefined,
      feeType: feeType === "flat" ? "flat" : "percentage",
      feeRatePercent: feeType !== "flat" && fd.get("feeRatePercent") ? Number(fd.get("feeRatePercent")) : undefined,
      feeMinCents: feeType !== "flat" && fd.get("feeMinCents") ? Math.round(Number(fd.get("feeMinCents")) * 100) : undefined,
      feeMaxCents: feeType !== "flat" && fd.get("feeMaxCents") ? Math.round(Number(fd.get("feeMaxCents")) * 100) : undefined,
      flatFeeCents: feeType === "flat" && fd.get("flatFeeCents") ? Math.round(Number(fd.get("flatFeeCents")) * 100) : undefined,
      insuranceExpiry: fd.get("insuranceExpiry") ? new Date(String(fd.get("insuranceExpiry"))).getTime() : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    try {
      if (carrier) {
        await update({ id: carrier._id, input });
        toast.success("Carrier updated.");
      } else {
        const res = await create({ input });
        toast.success("Carrier created.");
        onClose();
        return;
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{carrier ? `Edit ${carrier.companyName}` : "New carrier"}</DialogTitle>
          <DialogDescription>Carrier/client details including the dispatch fee configuration.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid>
            <Field label="Company name" required className="sm:col-span-2">
              <TextInput name="companyName" required defaultValue={carrier?.companyName} />
            </Field>
            <Field label="Legal name">
              <TextInput name="legalName" defaultValue={carrier?.legalName ?? ""} />
            </Field>
            <Field label="DBA">
              <TextInput name="dba" defaultValue={carrier?.dba ?? ""} />
            </Field>
            <Field label="Contact name">
              <TextInput name="contactName" defaultValue={carrier?.contactName ?? ""} />
            </Field>
            <Field label="Phone">
              <TextInput name="phone" defaultValue={carrier?.phone ?? ""} />
            </Field>
            <Field label="Email">
              <TextInput name="email" type="email" defaultValue={carrier?.email ?? ""} />
            </Field>
            <Field label="MC number">
              <TextInput name="mcNumber" defaultValue={carrier?.mcNumber ?? ""} placeholder="MC-123456" />
            </Field>
            <Field label="USDOT">
              <TextInput name="usdot" defaultValue={carrier?.usdot ?? ""} />
            </Field>
            <Field label="Address">
              <TextInput name="address" defaultValue={carrier?.address ?? ""} />
            </Field>
            <Field label="Fleet size">
              <TextInput name="fleetSize" type="number" min={0} defaultValue={carrier?.fleetSize ?? ""} />
            </Field>
            <Field label="Equipment (comma separated)">
              <TextInput name="equipment" defaultValue={(carrier?.equipment ?? []).join(", ")} placeholder={EQUIPMENT_TYPES.join(", ")} />
            </Field>
            <Field label="Home time">
              <TextInput name="homeTime" defaultValue={carrier?.homeTime ?? ""} placeholder="e.g. Home weekly, 34-hour reset" />
            </Field>
            <Field label="Preferred lanes (comma separated)">
              <TextInput name="preferredLanes" defaultValue={(carrier?.preferredLanes ?? []).join(", ")} placeholder="Dallas, Houston, Laredo" />
            </Field>
            <Field label="Avoided lanes (comma separated)">
              <TextInput name="avoidedLanes" defaultValue={(carrier?.avoidedLanes ?? []).join(", ")} />
            </Field>
            <Field label="Insurance expiry">
              <TextInput name="insuranceExpiry" type="date" defaultValue={carrier?.insuranceExpiry ? fmtDate(carrier.insuranceExpiry, "UTC") : ""} />
            </Field>
          </Grid>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dispatch fee</p>
            <Grid>
              <Field label="Fee model">
                <SelectInput name="feeType" defaultValue={carrier?.feeType ?? "percentage"}>
                  {FEE_TYPES.map((f) => (
                    <option key={f} value={f}>{f === "percentage" ? "Percentage of gross" : "Flat fee per load"}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Fee % (of gross)">
                <TextInput name="feeRatePercent" type="number" step="0.1" min={0} defaultValue={carrier?.feeRatePercent ?? 7} />
              </Field>
              <Field label="Minimum per load ($)">
                <MoneyInput name="feeMinCents" defaultValue={carrier?.feeMinCents ? (carrier.feeMinCents / 100).toFixed(2) : ""} />
              </Field>
              <Field label="Maximum per load ($)">
                <MoneyInput name="feeMaxCents" defaultValue={carrier?.feeMaxCents ? (carrier.feeMaxCents / 100).toFixed(2) : ""} />
              </Field>
              <Field label="Flat fee per load ($)">
                <MoneyInput name="flatFeeCents" defaultValue={carrier?.flatFeeCents ? (carrier.flatFeeCents / 100).toFixed(2) : ""} />
              </Field>
            </Grid>
          </div>

          <Field label="Notes">
            <TextArea name="notes" defaultValue={carrier?.notes ?? ""} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : carrier ? "Save changes" : "Create carrier"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
