import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useCanWrite } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Field, Grid, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { Search, Factory, Plus } from "lucide-react";

type ShipperType = any;

export default function Shippers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dialog, setDialog] = useState<"create" | ShipperType | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") { setDialog("create"); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  const shippers = useQuery(api.shippers.list, { search: debounced || undefined });

  const columns: Column<ShipperType>[] = [
    { key: "company", header: "Company", render: (s) => <div><p className="font-medium">{s.company}</p><p className="text-xs text-muted-foreground">{s.location ?? "No location"}</p></div> },
    { key: "contact", header: "Contact", hideOnMobile: true, render: (s) => <span className="text-sm text-muted-foreground">{s.contactName ?? "—"} · {s.phone ?? ""}</span> },
    { key: "email", header: "Email", hideOnMobile: true, render: (s) => <span className="text-sm text-muted-foreground">{s.email ?? "—"}</span> },
    ...(canWrite ? [{ key: "actions" as const, header: "", hideOnMobile: true, render: (s: ShipperType) => (
      <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDialog(s); }}>Edit</Button></div>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Shippers" description={`${shippers?.length ?? 0} shippers`}
        actions={canWrite && (<Button size="sm" className="gap-1.5" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New shipper</Button>)} />
      <div className="relative">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company, location…" className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
      </div>
      {shippers === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={shippers} getKey={(s) => s._id} onRowClick={canWrite ? (s) => setDialog(s) : undefined}
          empty={<EmptyState icon={<Factory className="size-6" />} title="No shippers yet" description="Add your first shipper contact." action={canWrite ? <Button size="sm" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New shipper</Button> : undefined} />} />
      )}
      {dialog && <ShipperFormDialog shipper={dialog === "create" ? null : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ShipperFormDialog({ shipper, onClose }: { shipper: ShipperType | null; onClose: () => void }) {
  const create = useMutation(api.shippers.create);
  const update = useMutation(api.shippers.update);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      company: String(fd.get("company") ?? ""),
      location: String(fd.get("location") ?? "") || undefined,
      address: String(fd.get("address") ?? "") || undefined,
      contactName: String(fd.get("contactName") ?? "") || undefined,
      phone: String(fd.get("phone") ?? "") || undefined,
      email: String(fd.get("email") ?? "") || undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    try {
      if (shipper) { await update({ id: shipper._id as any, input }); toast.success("Shipper updated."); }
      else { await create({ input: input as any }); toast.success("Shipper created."); }
      onClose();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{shipper ? `Edit ${shipper.company}` : "New shipper"}</DialogTitle><DialogDescription>Shipper contact details.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid>
            <Field label="Company" required><TextInput name="company" required defaultValue={shipper?.company ?? ""} /></Field>
            <Field label="Location"><TextInput name="location" defaultValue={shipper?.location ?? ""} placeholder="Dallas, TX" /></Field>
            <Field label="Address"><TextInput name="address" defaultValue={shipper?.address ?? ""} /></Field>
            <Field label="Contact name"><TextInput name="contactName" defaultValue={shipper?.contactName ?? ""} /></Field>
            <Field label="Phone"><TextInput name="phone" defaultValue={shipper?.phone ?? ""} /></Field>
            <Field label="Email"><TextInput name="email" type="email" defaultValue={shipper?.email ?? ""} /></Field>
          </Grid>
          <Field label="Notes"><TextArea name="notes" defaultValue={shipper?.notes ?? ""} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : shipper ? "Save changes" : "Create shipper"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
