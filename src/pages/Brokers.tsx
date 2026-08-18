import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { BROKER_STATUSES } from "@/convex/constants";
import { useCanWrite } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Field, Grid, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { ImportCsvDialog, ExportCsvButton } from "@/components/app/ImportExport";
import { Search, Handshake, Plus, AlertTriangle } from "lucide-react";

type BrokerType = any;

export default function Brokers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<"create" | BrokerType | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") { setDialog("create"); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  const brokers = useQuery(api.brokers.list, { search: debounced || undefined, status: status || undefined });

  const columns: Column<BrokerType>[] = [
    { key: "company", header: "Company", render: (b) => <div><p className="font-medium">{b.company}</p><p className="text-xs text-muted-foreground">{b.mc ?? "No MC"}</p></div> },
    { key: "contact", header: "Contact", hideOnMobile: true, render: (b) => <span className="text-sm text-muted-foreground">{b.contactName ?? "—"} · {b.phone ?? ""}</span> },
    { key: "risk", header: "Risk", hideOnMobile: true, render: (b) => b.riskFlag && b.riskFlag !== "None" ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><AlertTriangle className="size-3" />{b.riskFlag}</span>
    ) : <span className="text-xs text-muted-foreground">—</span> },
    { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
    ...(canWrite ? [{ key: "actions" as const, header: "", hideOnMobile: true, render: (b: BrokerType) => (
      <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDialog(b); }}>Edit</Button></div>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Brokers" description={`${brokers?.length ?? 0} broker contacts`}
        actions={canWrite && (<>
          <ImportCsvDialog entity="brokers" mutationName="importBrokers" title="Import brokers" description="CSV with company, mc, contactName, phone, email, status." requiredColumns={["company"]} mapRow={(r) => ({ company: r.company ?? "", mc: r.mc, contactName: r.contactName, phone: r.phone, email: r.email, status: r.status })} />
          <ExportCsvButton filename="brokers.csv" headers={["Company", "MC", "Contact", "Phone", "Email", "Status"]} rows={(brokers ?? []).map((b) => [b.company, b.mc ?? "", b.contactName ?? "", b.phone ?? "", b.email ?? "", b.status])} />
          <Button size="sm" className="gap-1.5" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New broker</Button>
        </>)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, MC, contact…" className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
        </div>
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-48">
          <option value="">All statuses</option>
          {BROKER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
      </div>
      {brokers === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={brokers} getKey={(b) => b._id} onRowClick={canWrite ? (b) => setDialog(b) : undefined}
          empty={<EmptyState icon={<Handshake className="size-6" />} title="No brokers yet" description="Add your first broker contact." action={canWrite ? <Button size="sm" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New broker</Button> : undefined} />} />
      )}
      {dialog && <BrokerFormDialog broker={dialog === "create" ? null : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function BrokerFormDialog({ broker, onClose }: { broker: BrokerType | null; onClose: () => void }) {
  const create = useMutation(api.brokers.create);
  const update = useMutation(api.brokers.update);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      company: String(fd.get("company") ?? ""),
      mc: String(fd.get("mc") ?? "") || undefined,
      contactName: String(fd.get("contactName") ?? "") || undefined,
      phone: String(fd.get("phone") ?? "") || undefined,
      email: String(fd.get("email") ?? "") || undefined,
      website: String(fd.get("website") ?? "") || undefined,
      address: String(fd.get("address") ?? "") || undefined,
      status: (fd.get("status") as string || "New") as typeof BROKER_STATUSES[number],
      riskFlag: (fd.get("riskFlag") as string || "None") as "None" | "Review" | "Blocked",
      riskNotes: String(fd.get("riskNotes") ?? "") || undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    try {
      if (broker) { await update({ id: broker._id as any, input: input as any }); toast.success("Broker updated."); }
      else { await create({ input: input as any }); toast.success("Broker created."); }
      onClose();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{broker ? `Edit ${broker.company}` : "New broker"}</DialogTitle><DialogDescription>Broker contact and risk assessment.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid>
            <Field label="Company" required><TextInput name="company" required defaultValue={broker?.company ?? ""} /></Field>
            <Field label="MC number"><TextInput name="mc" defaultValue={broker?.mc ?? ""} placeholder="MC-123456" /></Field>
            <Field label="Contact name"><TextInput name="contactName" defaultValue={broker?.contactName ?? ""} /></Field>
            <Field label="Phone"><TextInput name="phone" defaultValue={broker?.phone ?? ""} /></Field>
            <Field label="Email"><TextInput name="email" type="email" defaultValue={broker?.email ?? ""} /></Field>
            <Field label="Website"><TextInput name="website" defaultValue={broker?.website ?? ""} /></Field>
            <Field label="Address"><TextInput name="address" defaultValue={broker?.address ?? ""} /></Field>
            <Field label="Status">
              <SelectInput name="status" defaultValue={broker?.status ?? "New"}>
                {BROKER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectInput>
            </Field>
            <Field label="Risk flag">
              <SelectInput name="riskFlag" defaultValue={broker?.riskFlag ?? "None"}>
                <option value="None">None</option>
                <option value="Review">Review</option>
                <option value="Blocked">Blocked</option>
              </SelectInput>
            </Field>
          </Grid>
          <Field label="Risk notes"><TextArea name="riskNotes" rows={2} defaultValue={broker?.riskNotes ?? ""} /></Field>
          <Field label="Notes"><TextArea name="notes" defaultValue={broker?.notes ?? ""} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : broker ? "Save changes" : "Create broker"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
