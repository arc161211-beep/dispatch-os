import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/convex/constants";
import { useCanWrite } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, NextActionPill, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Field, Grid, MoneyInput, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { ImportCsvDialog, ExportCsvButton } from "@/components/app/ImportExport";
import { Search, Users, Plus, ArrowRightLeft, Phone, Mail } from "lucide-react";
import { nextAction } from "@/lib/status";
import { fmtDate, fmtRelative } from "@/lib/dates";
import { useTimezone } from "@/hooks/use-app";

type Lead = NonNullable<ReturnType<typeof useQuery<typeof api.leads.list>>[number]>;

export default function Leads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tz = useTimezone();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<string>("");
  const [dialog, setDialog] = useState<"create" | Lead | null>(null);
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);

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

  const leads = useQuery(api.leads.list, { search: debounced || undefined, status: status || undefined });
  const convert = useMutation(api.leads.convertToCarrier);

  const handleConvert = async (lead: Lead) => {
    try {
      const res = await convert({ id: lead._id });
      toast.success(`Converted ${lead.companyName} — carrier created.`);
      setConvertTarget(null);
      navigate(`/carriers/${res.carrierId}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: Column<Lead>[] = [
    {
      key: "company",
      header: "Company",
      render: (l) => (
        <div>
          <p className="font-medium">{l.companyName}</p>
          <p className="text-xs text-muted-foreground">{[l.city, l.state].filter(Boolean).join(", ") || "—"} · {l.mc || "no MC"}</p>
        </div>
      ),
    },
    { key: "contact", header: "Contact", hideOnMobile: true, render: (l) => (
      <div className="text-sm">
        <p>{l.contactName || "—"}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">{l.phone && <><Phone className="size-3" />{l.phone}</>}</p>
      </div>
    ) },
    { key: "source", header: "Source", hideOnMobile: true, render: (l) => <span className="text-sm text-muted-foreground">{l.source ?? "Manual"}</span> },
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
    {
      key: "followup",
      header: "Next follow-up",
      hideOnMobile: true,
      render: (l) => <span className="text-sm text-muted-foreground">{l.nextFollowUpAt ? `${fmtDate(l.nextFollowUpAt, tz)} (${fmtRelative(l.nextFollowUpAt)})` : "—"}</span>,
    },
    {
      key: "next",
      header: "Next action",
      hideOnMobile: true,
      render: (l) => <NextActionPill action={nextAction("lead", l)} />,
    },
    ...(canWrite
      ? [{
          key: "actions",
          header: "",
          hideOnMobile: true,
          render: (l: Lead) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDialog(l); }}>Edit</Button>
              {!l.convertedToCarrierId && (
                <Button variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); setConvertTarget(l); }}>
                  <ArrowRightLeft className="size-3" /> Convert
                </Button>
              )}
            </div>
          ),
        } satisfies Column<Lead>]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={`${leads?.length ?? 0} carrier leads`}
        actions={
          canWrite && (
            <>
              <ImportCsvDialog
                entity="leads"
                mutationName="importLeads"
                title="Import leads"
                description="Upload a CSV with companyName and optional contactName, phone, email, city, state, mc, usdot, fleetSize, equipment, source."
                requiredColumns={["companyName"]}
                mapRow={(r) => ({
                  companyName: r.companyName ?? "",
                  contactName: r.contactName,
                  phone: r.phone,
                  email: r.email,
                  city: r.city,
                  state: r.state,
                  mc: r.mc,
                  usdot: r.usdot,
                  fleetSize: r.fleetSize ? Number(r.fleetSize) : undefined,
                  equipment: r.equipment,
                  source: r.source,
                })}
              />
              <ExportCsvButton
                filename="leads.csv"
                headers={["Company", "Contact", "Phone", "Email", "City", "State", "MC", "Status", "Source", "Next follow-up"]}
                rows={(leads ?? []).map((l) => [l.companyName, l.contactName ?? "", l.phone ?? "", l.email ?? "", l.city ?? "", l.state ?? "", l.mc ?? "", l.status, l.source ?? "", l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toISOString() : ""])}
              />
              <Button size="sm" className="gap-1.5" onClick={() => setDialog("create")}>
                <Plus className="size-3.5" /> New lead
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
            placeholder="Search company, contact, MC…"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-56">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </SelectInput>
      </div>

      {leads === undefined ? (
        <LoadingState />
      ) : (
        <ResponsiveTable
          columns={columns}
          rows={leads}
          getKey={(l) => l._id}
          onRowClick={canWrite ? (l) => setDialog(l) : undefined}
          empty={<EmptyState icon={<Users className="size-6" />} title="No leads yet" description="Add your first carrier lead or import a CSV." action={canWrite ? <Button size="sm" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New lead</Button> : undefined} />}
        />
      )}

      {dialog && <LeadFormDialog lead={dialog === "create" ? null : dialog} onClose={() => setDialog(null)} />}
      {convertTarget && (
        <Dialog open onOpenChange={() => setConvertTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Convert lead to carrier?</DialogTitle>
              <DialogDescription>
                {convertTarget.companyName} will become a carrier with status <strong>Onboarding</strong>, preserving all
                contact, MC, USDOT, fleet and equipment information. The lead is marked Active and linked to the new carrier.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConvertTarget(null)}>Cancel</Button>
              <Button onClick={() => handleConvert(convertTarget)}>Convert to carrier</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function LeadFormDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const create = useMutation(api.leads.create);
  const update = useMutation(api.leads.update);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      companyName: String(fd.get("companyName") ?? ""),
      contactName: String(fd.get("contactName") ?? "") || undefined,
      phone: String(fd.get("phone") ?? "") || undefined,
      email: String(fd.get("email") ?? "") || undefined,
      website: String(fd.get("website") ?? "") || undefined,
      city: String(fd.get("city") ?? "") || undefined,
      state: String(fd.get("state") ?? "") || undefined,
      mc: String(fd.get("mc") ?? "") || undefined,
      usdot: String(fd.get("usdot") ?? "") || undefined,
      fleetSize: fd.get("fleetSize") ? Number(fd.get("fleetSize")) : undefined,
      equipment: String(fd.get("equipment") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      source: (fd.get("source") as string) || "Manual",
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    try {
      if (lead) {
        await update({ id: lead._id, input });
        toast.success("Lead updated.");
      } else {
        await create({ input });
        toast.success("Lead created.");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lead ? `Edit ${lead.companyName}` : "New lead"}</DialogTitle>
          <DialogDescription>Carrier lead details. Status starts at New.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid>
            <Field label="Company name" required className="sm:col-span-2">
              <TextInput name="companyName" required defaultValue={lead?.companyName} />
            </Field>
            <Field label="Contact name">
              <TextInput name="contactName" defaultValue={lead?.contactName ?? ""} />
            </Field>
            <Field label="Phone">
              <TextInput name="phone" defaultValue={lead?.phone ?? ""} />
            </Field>
            <Field label="Email">
              <TextInput name="email" type="email" defaultValue={lead?.email ?? ""} />
            </Field>
            <Field label="Website">
              <TextInput name="website" defaultValue={lead?.website ?? ""} />
            </Field>
            <Field label="City">
              <TextInput name="city" defaultValue={lead?.city ?? ""} />
            </Field>
            <Field label="State">
              <TextInput name="state" defaultValue={lead?.state ?? ""} />
            </Field>
            <Field label="Fleet size">
              <TextInput name="fleetSize" type="number" min={0} defaultValue={lead?.fleetSize ?? ""} />
            </Field>
            <Field label="Equipment (comma separated)">
              <TextInput name="equipment" defaultValue={(lead?.equipment ?? []).join(", ")} placeholder="Dry Van, Reefer" />
            </Field>
            <Field label="MC number">
              <TextInput name="mc" defaultValue={lead?.mc ?? ""} placeholder="MC-123456" />
            </Field>
            <Field label="USDOT">
              <TextInput name="usdot" defaultValue={lead?.usdot ?? ""} />
            </Field>
            <Field label="Source">
              <SelectInput name="source" defaultValue={lead?.source ?? "Manual"}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
            </Field>
          </Grid>
          <Field label="Notes">
            <TextArea name="notes" defaultValue={lead?.notes ?? ""} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : lead ? "Save changes" : "Create lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
