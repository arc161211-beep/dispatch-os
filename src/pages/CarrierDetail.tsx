import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { motion } from "framer-motion";
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

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } };

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
    <div className="space-y-6 pb-8">
      {/* Back nav */}
      <div className="flex items-center gap-2">
        <Link to="/carriers" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-3.5" /> Carriers
        </Link>
      </div>

      {/* Hero */}
      <motion.div {...fadeUp} className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/80">
        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4F8CFF]">Carrier Client</span>
                <StatusBadge status={carrier.status} />
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">{carrier.companyName}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {carrier.mcNumber && <span className="rounded-full bg-muted px-2 py-0.5">MC: {carrier.mcNumber}</span>}
                {carrier.usdot && <span className="rounded-full bg-muted px-2 py-0.5">USDOT: {carrier.usdot}</span>}
                {carrier.contactName && <span className="rounded-full bg-muted px-2 py-0.5">{carrier.contactName}</span>}
                {carrier.phone && <span className="rounded-full bg-muted px-2 py-0.5">{carrier.phone}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold tabular-nums"><Money cents={stats.dispatcherFeeCents} /></p>
              <p className="text-xs text-muted-foreground mt-0.5">Fee booked</p>
            </div>
          </div>

          {/* Action buttons */}
          {canWrite && (
            <div className="mt-5 flex flex-wrap gap-2">
              <CarrierStatusSelect carrierId={carrier._id} status={carrier.status} />
            </div>
          )}
        </div>
      </motion.div>

      {/* Summary cards */}
      <motion.div {...fadeUp} transition={{ delay: 0.08 }} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard icon={<Truck className="size-4" />} label="Trucks" value={stats.truckCount} sub={`${stats.availableTrucks} available`} tone="accent" />
        <SummaryCard icon={<UserRound className="size-4" />} label="Drivers" value={stats.driverCount} />
        <SummaryCard icon={<Package className="size-4" />} label="Loads" value={stats.loadCount} sub={`${stats.activeLoads} active`} />
        <SummaryCard icon={<Wallet className="size-4" />} label="Outstanding" value={<Money cents={stats.outstandingCents} />} tone={stats.outstandingCents > 0 ? "warn" : "good"} />
        <div className="flex flex-col justify-between rounded-xl border border-border/50 bg-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next action</p>
          <div className="mt-1.5"><NextActionPill action={nextAction("carrier", carrier)} /></div>
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.12 }}>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trucks">Trucks ({trucks?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="drivers">Drivers ({drivers?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="loads">Loads ({loads?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices ({invoices?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SectionCard title="Details">
                <KV label="Legal name">{carrier.legalName ?? "—"}</KV>
                <KV label="DBA">{carrier.dba ?? "—"}</KV>
                <KV label="Contact">{carrier.contactName ?? "—"}</KV>
                <KV label="Email">{carrier.email ?? "—"}</KV>
                <KV label="Phone">{carrier.phone ?? "—"}</KV>
                <KV label="Address">{carrier.address ?? "—"}</KV>
                <KV label="Equipment">{(carrier.equipment ?? []).join(", ") || "—"}</KV>
                <KV label="Fleet size">{carrier.fleetSize ?? "—"}</KV>
                <KV label="Preferred lanes">{(carrier.preferredLanes ?? []).join(", ") || "—"}</KV>
              </SectionCard>
              <SectionCard title="Fee configuration">
                <KV label="Fee type">{carrier.feeType}</KV>
                <KV label="Fee rate">{carrier.feeType === "flat" ? <><Money cents={carrier.flatFeeCents} /> flat</> : <>{carrier.feeRatePercent ?? 0}%</>}</KV>
                {carrier.feeMinCents && <KV label="Min fee"><Money cents={carrier.feeMinCents} /></KV>}
                {carrier.feeMaxCents && <KV label="Max fee"><Money cents={carrier.feeMaxCents} /></KV>}
                <KV label="Insurance expiry">{carrier.insuranceExpiry ? fmtDate(carrier.insuranceExpiry, tz) : "—"}</KV>
                <KV label="Notes">{carrier.notes ?? "—"}</KV>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="trucks">
            <SectionCard title="Fleet">
              {(!trucks || trucks.length === 0) ? <EmptyState icon={<Truck className="size-5" />} title="No trucks" description="Add trucks for this carrier." /> : (
                <div className="space-y-1.5">
                  {trucks.map((t) => (
                    <Link key={t._id} to={`/trucks/${t._id}`} className="flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40">
                      <div><p className="text-sm font-semibold">{t.unitNumber}</p><p className="text-[11px] text-muted-foreground">{t.type ?? "—"}</p></div>
                      <StatusBadge status={t.availability} />
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="drivers">
            <SectionCard title="Drivers">
              {(!drivers || drivers.length === 0) ? <EmptyState icon={<UserRound className="size-5" />} title="No drivers" description="Add drivers for this carrier." /> : (
                <div className="space-y-1.5">
                  {drivers.map((d) => (
                    <Link key={d._id} to={`/drivers/${d._id}`} className="flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40">
                      <div><p className="text-sm font-semibold">{d.name}</p><p className="text-[11px] text-muted-foreground">{d.phone ?? "No phone"}</p></div>
                      <StatusBadge status={d.availability} />
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="loads">
            <SectionCard title="Loads">
              {(!loads || loads.length === 0) ? <EmptyState icon={<Package className="size-5" />} title="No loads" description="Loads will appear here." /> : (
                <ResponsiveTable columns={loadCols} rows={loads} getKey={(l) => l._id} onRowClick={(l) => window.location.href = `/loads/${l._id}`} />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="documents">
            <SectionCard title="Documents" actions={canWrite ? <UploadDocumentButton entityType="carrier" entityId={id} /> : undefined}>
              {(!documents || documents.length === 0) ? <EmptyState icon={<FileText className="size-5" />} title="No documents" description="Upload agreements, insurance, and other documents." /> : (
                <div className="space-y-1.5">
                  {documents.map((d) => (
                    <div key={d._id} className="flex items-center justify-between rounded-lg px-2.5 py-2">
                      <div className="flex items-center gap-2 min-w-0"><FileText className="size-3.5 text-muted-foreground shrink-0" /><div><p className="text-sm font-medium truncate">{d.fileName}</p><p className="text-[11px] text-muted-foreground">{d.type} · {fmtDate(d._creationTime, tz)}</p></div></div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="invoices">
            <SectionCard title="Invoices">
              {(!invoices || invoices.length === 0) ? <EmptyState icon={<Wallet className="size-5" />} title="No invoices" /> : (
                <div className="space-y-1.5">
                  {invoices.map((inv) => (
                    <div key={inv._id} className="flex items-center justify-between rounded-lg px-2.5 py-2">
                      <div><p className="text-sm font-semibold">{inv.invoiceNumber}</p><p className="text-[11px] text-muted-foreground"><Money cents={inv.amountCents - inv.paidCents} /> outstanding</p></div>
                      <StatusBadge status={inv.status} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, tone = "default" }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "default" | "good" | "warn" | "accent" }) {
  const tones = { default: "text-foreground", good: "text-[#22C55E]", warn: "text-[#F5A623]", accent: "text-[#4F8CFF]" };
  const iconBg = { default: "bg-muted", good: "bg-[#22C55E]/10 text-[#22C55E]", warn: "bg-[#F5A623]/10 text-[#F5A623]", accent: "bg-[#4F8CFF]/10 text-[#4F8CFF]" };
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <div className="flex items-center gap-2">
        <div className={`flex size-7 items-center justify-center rounded-lg ${iconBg[tone]}`}>{icon}</div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-2 text-xl font-bold tracking-tight tabular-nums ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function CarrierStatusSelect({ carrierId, status }: { carrierId: string; status: string }) {
  const setStatus = useMutation(api.carriers.setStatus);
  const handleStatus = async (s: string) => {
    try { await setStatus({ id: carrierId as any, status: s as never }); toast.success(`Status → ${s}`); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <SelectInput value={status} onChange={(e) => handleStatus(e.target.value)} className="h-8 w-40 text-xs">
      {CARRIER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </SelectInput>
  );
}
