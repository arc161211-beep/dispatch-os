import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { CARRIER_STATUSES, DOCUMENT_TYPES } from "@/convex/constants";
import { useCanWrite, useTimezone } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatusBadge, NextActionPill, Money, SectionCard, LoadingState, EmptyState, KV, errorMessage } from "@/components/app/shared";
import { Field, TextArea, TextInput, SelectInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { UploadDocumentButton } from "@/components/app/UploadDocument";
import { nextAction } from "@/lib/status";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { ArrowLeft, Building2, FileText, Package, Truck, UserRound, Wallet } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export default function CarrierDetail() {
  const { id } = useParams<{ id: string }>();
  const tz = useTimezone();
  const canWrite = useCanWrite();
  const data = useQuery(api.carriers.get, { id: id as Id<"carriers"> });
  const stats = useQuery(api.carriers.getStats, { id: id as Id<"carriers"> });
  const trucks = useQuery(api.trucks.list, { carrierId: id as Id<"carriers"> });
  const drivers = useQuery(api.drivers.list, { carrierId: id as Id<"carriers"> });
  const loads = useQuery(api.loads.list, { carrierId: id as Id<"carriers"> });
  const invoices = useQuery(api.invoices.list, { carrierId: id as Id<"carriers"> });
  const tasks = useQuery(api.tasks.list, { entityType: "carrier", entityId: id });
  const documents = useQuery(api.documents.list, { entityType: "carrier", entityId: id });

  if (!data || !stats) return <LoadingState />;
  const { carrier, agreements } = data;

  const loadCols: Column<NonNullable<typeof loads>[number]>[] = [
    { key: "num", header: "Load", render: (l) => <span className="font-medium">{l.loadNumber}</span> },
    { key: "lane", header: "Lane", render: (l) => <span className="text-sm">{l.origin ?? "?"} → {l.destination ?? "?"}</span> },
    { key: "dates", header: "Pickup / Delivery", hideOnMobile: true, render: (l) => <span className="text-xs text-muted-foreground">{fmtDateTime(l.pickupDate, tz)} · {fmtDateTime(l.deliveryDate, tz)}</span> },
    { key: "rate", header: "Rate", hideOnMobile: true, render: (l) => <Money cents={l.grossRateCents} /> },
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={carrier.companyName}
        description={[carrier.mcNumber, carrier.usdot, carrier.address].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link to="/carriers">
              <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-3.5" /> All carriers</Button>
            </Link>
            {canWrite && <CarrierStatusSelect carrierId={carrier._id} status={carrier.status} />}
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard icon={<Truck className="size-4" />} label="Trucks" value={stats.truckCount} sub={`${stats.availableTrucks} available`} />
        <SummaryCard icon={<UserRound className="size-4" />} label="Drivers" value={stats.driverCount} />
        <SummaryCard icon={<Package className="size-4" />} label="Loads" value={stats.loadCount} sub={`${stats.activeLoads} active`} />
        <SummaryCard icon={<Wallet className="size-4" />} label="Fee booked" value={<Money cents={stats.dispatcherFeeCents} />} />
        <SummaryCard icon={<Wallet className="size-4" />} label="Outstanding" value={<Money cents={stats.outstandingCents} />} tone={stats.outstandingCents > 0 ? "warn" : "good"} />
        <div className="flex flex-col justify-between rounded-xl border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next action</p>
          <div className="mt-1"><NextActionPill action={nextAction("carrier", carrier)} /></div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trucks">Trucks ({trucks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="drivers">Drivers ({drivers?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="loads">Loads ({loads?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="history">Agreements & history</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <SectionCard title="Profile">
            <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <KV label="Contact">{carrier.contactName || "—"} {carrier.phone ? `· ${carrier.phone}` : ""}</KV>
              <KV label="Email">{carrier.email || "—"}</KV>
              <KV label="Equipment">{(carrier.equipment ?? []).join(", ") || "—"}</KV>
              <KV label="Fleet size">{carrier.fleetSize ?? "—"}</KV>
              <KV label="Preferred lanes">{(carrier.preferredLanes ?? []).join(", ") || "—"}</KV>
              <KV label="Avoided lanes">{(carrier.avoidedLanes ?? []).join(", ") || "—"}</KV>
              <KV label="Home time">{carrier.homeTime || "—"}</KV>
              <KV label="Insurance expiry">{carrier.insuranceExpiry ? fmtDate(carrier.insuranceExpiry, tz) : "—"}</KV>
              <KV label="Fee model">
                {carrier.feeType === "flat" ? (
                  <Money cents={carrier.flatFeeCents} />
                ) : (
                  `${carrier.feeRatePercent ?? 0}%${carrier.feeMinCents ? ` · min $${(carrier.feeMinCents / 100).toFixed(0)}` : ""}${carrier.feeMaxCents ? ` · max $${(carrier.feeMaxCents / 100).toFixed(0)}` : ""}`
                )}
              </KV>
              <KV label="Agreement">{carrier.agreementStatus ?? "None"}</KV>
            </dl>
            {carrier.notes && <p className="mt-4 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{carrier.notes}</p>}
          </SectionCard>

          <SectionCard title="Recent loads" actions={<Link to={`/loads?carrier=${carrier._id}`} className="text-xs font-medium text-primary hover:underline">View all</Link>}>
            {(loads ?? []).length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No loads for this carrier yet.</p>
            ) : (
              <ResponsiveTable columns={loadCols} rows={(loads ?? []).slice(0, 8)} getKey={(l) => l._id} onRowClick={(l) => undefined} />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="trucks">
          {trucks === undefined ? <LoadingState /> : <ResponsiveTable
            columns={[
              { key: "unit", header: "Unit", render: (t) => <span className="font-medium">{t.unitNumber}</span> },
              { key: "type", header: "Type", render: (t) => <span className="text-sm">{t.type || "—"}</span> },
              { key: "loc", header: "Location", hideOnMobile: true, render: (t) => <span className="text-sm text-muted-foreground">{t.currentLocation || "—"}</span> },
              { key: "status", header: "Status", render: (t) => <StatusBadge status={t.availability} /> },
            ]}
            rows={trucks}
            getKey={(t) => t._id}
            onRowClick={() => undefined}
            empty={<EmptyState title="No trucks" description="Add a truck to this carrier from the Trucks page." />}
          />}
        </TabsContent>

        <TabsContent value="drivers">
          {drivers === undefined ? <LoadingState /> : <ResponsiveTable
            columns={[
              { key: "name", header: "Name", render: (d) => <span className="font-medium">{d.name}</span> },
              { key: "phone", header: "Phone", hideOnMobile: true, render: (d) => <span className="text-sm text-muted-foreground">{d.phone || "—"}</span> },
              { key: "status", header: "Status", render: (d) => <StatusBadge status={d.availability} /> },
            ]}
            rows={drivers}
            getKey={(d) => d._id}
            onRowClick={() => undefined}
            empty={<EmptyState title="No drivers" description="Add a driver to this carrier from the Drivers page." />}
          />}
        </TabsContent>

        <TabsContent value="loads">
          {loads === undefined ? <LoadingState /> : <ResponsiveTable
            columns={loadCols}
            rows={loads}
            getKey={(l) => l._id}
            onRowClick={(l) => undefined}
            empty={<EmptyState title="No loads" description="Create a load for this carrier." />}
          />}
        </TabsContent>

        <TabsContent value="documents">
          {documents === undefined ? <LoadingState /> : (
            <div className="space-y-4">
              <div className="flex justify-end">
                {canWrite && <UploadDocumentButton entityType="carrier" entityId={carrier._id} />}
              </div>
              <ResponsiveTable
                columns={[
                  { key: "name", header: "File", render: (d) => (
                    <div>
                      <p className="flex items-center gap-1.5 font-medium"><FileText className="size-3.5 text-muted-foreground" />{d.fileName}</p>
                      <p className="text-xs text-muted-foreground">{d.uploadedByName || "—"} · {fmtDateTime(d._creationTime, tz)}</p>
                    </div>
                  ) },
                  { key: "type", header: "Type", render: (d) => <Badge variant="outline">{d.type}</Badge> },
                  { key: "size", header: "Size", hideOnMobile: true, render: (d) => <span className="text-xs text-muted-foreground">{d.size ? `${(d.size / 1024).toFixed(0)} KB` : "—"}</span> },
                ]}
                rows={documents}
                getKey={(d) => d._id}
                onRowClick={() => undefined}
                empty={<EmptyState title="No documents" description="Upload insurance, W-9, agreement, or other documents for this carrier." />}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices">
          {invoices === undefined ? <LoadingState /> : <ResponsiveTable
            columns={[
              { key: "num", header: "Invoice", render: (i) => <span className="font-medium">{i.invoiceNumber}</span> },
              { key: "date", header: "Issued", hideOnMobile: true, render: (i) => <span className="text-sm text-muted-foreground">{fmtDate(i.issueDate, tz)}</span> },
              { key: "amount", header: "Amount", render: (i) => <Money cents={i.amountCents} /> },
              { key: "paid", header: "Paid", hideOnMobile: true, render: (i) => <Money cents={i.paidCents} /> },
              { key: "status", header: "Status", render: (i) => <StatusBadge status={i.effectiveStatus} /> },
            ]}
            rows={invoices}
            getKey={(i) => i._id}
            onRowClick={() => undefined}
            empty={<EmptyState title="No invoices" description="Invoices are created automatically when loads complete." />}
          />}
        </TabsContent>

        <TabsContent value="tasks">
          {tasks === undefined ? <LoadingState /> : <ResponsiveTable
            columns={[
              { key: "title", header: "Task", render: (t) => <span className="font-medium">{t.title}</span> },
              { key: "type", header: "Type", hideOnMobile: true, render: (t) => <span className="text-sm text-muted-foreground">{t.type}</span> },
              { key: "due", header: "Due", hideOnMobile: true, render: (t) => <span className="text-sm">{t.dueAt ? fmtDate(t.dueAt, tz) : "—"}</span> },
              { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
            ]}
            rows={tasks}
            getKey={(t) => t._id}
            onRowClick={() => undefined}
            empty={<EmptyState title="No tasks" description="Create a follow-up task from the Tasks page." />}
          />}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <SectionCard title="Agreements" description="Dispatch agreement versions" actions={canWrite ? <AgreementDialog carrierId={carrier._id} /> : undefined}>
            {agreements.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No agreements recorded.</p>
            ) : (
              <ResponsiveTable
                columns={[
                  { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
                  { key: "signed", header: "Signed", hideOnMobile: true, render: (a) => <span className="text-sm">{a.signedAt ? fmtDate(a.signedAt, tz) : "—"}</span> },
                  { key: "by", header: "Signed by", hideOnMobile: true, render: (a) => <span className="text-sm">{a.signedByName || "—"}</span> },
                  { key: "created", header: "Created", render: (a) => <span className="text-sm text-muted-foreground">{fmtDate(a.createdAt, tz)}</span> },
                ]}
                rows={agreements}
                getKey={(a) => a._id}
                onRowClick={() => undefined}
              />
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <p className={`mt-1.5 text-lg font-semibold tabular-nums ${tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CarrierStatusSelect({ carrierId, status }: { carrierId: Id<"carriers">; status: string }) {
  const setStatus = useMutation(api.carriers.setStatus);
  const [busy, setBusy] = useState(false);
  return (
    <SelectInput
      value={status}
      disabled={busy}
      onChange={async (e) => {
        setBusy(true);
        try {
          await setStatus({ id: carrierId, status: e.target.value as never });
          toast.success(`Status → ${e.target.value}`);
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="h-9 w-40"
    >
      {CARRIER_STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </SelectInput>
  );
}

function AgreementDialog({ carrierId }: { carrierId: Id<"carriers"> }) {
  const [open, setOpen] = useState(false);
  const save = useMutation(api.carriers.saveAgreement);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await save({
        carrierId,
        status: fd.get("status") as "Draft" | "Sent" | "Signed" | "Expired",
        agreementText: String(fd.get("agreementText") ?? "") || undefined,
      });
      toast.success("Agreement saved.");
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Record agreement</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record agreement</DialogTitle>
            <DialogDescription>Signing an agreement activates the carrier (unless already active).</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Status">
              <SelectInput name="status" defaultValue="Sent">
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Signed">Signed</option>
                <option value="Expired">Expired</option>
              </SelectInput>
            </Field>
            <Field label="Agreement text">
              <TextArea name="agreementText" rows={6} placeholder="Paste the agreement text…" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save agreement"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
