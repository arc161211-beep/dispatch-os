import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { INVOICE_STATUSES } from "@/convex/constants";
import { useCanWrite, useTimezone } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, Money, StatCard, LoadingState, EmptyState, errorMessage, ConfirmButton } from "@/components/app/shared";
import { Field, Grid, MoneyInput, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { Wallet, Plus, CreditCard } from "lucide-react";
import { fmtDate } from "@/lib/dates";

type InvoiceType = any;

export default function Finance() {
  const tz = useTimezone();
  const canWrite = useCanWrite();
  const [statusFilter, setStatusFilter] = useState("");
  const [payDialog, setPayDialog] = useState<InvoiceType | null>(null);
  const [newInvDialog, setNewInvDialog] = useState(false);

  const invoices = useQuery(api.invoices.list, { status: statusFilter || undefined });
  const carriers = useQuery(api.carriers.list, {});
  const recordPayment = useMutation(api.invoices.recordPayment);
  const updateStatus = useMutation(api.invoices.updateStatus);
  const createInvoice = useMutation(api.invoices.create);
  const removeInvoice = useMutation(api.invoices.remove);

  const totalOutstanding = (invoices ?? []).reduce((sum, i) => sum + i.outstandingCents, 0);
  const totalPaid = (invoices ?? []).reduce((sum, i) => sum + i.paidCents, 0);
  const overdueCount = (invoices ?? []).filter((i) => i.effectiveStatus === "Overdue").length;

  const handlePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!payDialog) return;
    const fd = new FormData(e.currentTarget);
    try {
      await recordPayment({
        invoiceId: payDialog._id as any,
        amountCents: Math.round(Number(fd.get("amount") ?? 0) * 100),
        method: String(fd.get("method") ?? "") || undefined,
        reference: String(fd.get("reference") ?? "") || undefined,
      });
      toast.success("Payment recorded."); setPayDialog(null);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createInvoice({
        carrierId: (String(fd.get("carrierId") || "") || undefined) as any,
        amountCents: Math.round(Number(fd.get("amount") ?? 0) * 100),
        dueDate: fd.get("dueDate") ? new Date(String(fd.get("dueDate"))).getTime() : undefined,
        notes: String(fd.get("notes") ?? "") || undefined,
      });
      toast.success("Invoice created."); setNewInvDialog(false);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleStatus = async (inv: InvoiceType, s: string) => {
    try { await updateStatus({ id: inv._id as any, status: s as never }); toast.success(`Invoice → ${s}`); } catch (e) { toast.error(errorMessage(e)); }
  };

  const columns: Column<InvoiceType>[] = [
    { key: "number", header: "Invoice #", render: (i) => <div><p className="font-medium">{i.invoiceNumber}</p><p className="text-xs text-muted-foreground">{i.carrierName || "—"}</p></div> },
    { key: "amount", header: "Amount", render: (i) => <Money cents={i.amountCents} className="text-sm" /> },
    { key: "outstanding", header: "Outstanding", render: (i) => <Money cents={i.outstandingCents} className={i.outstandingCents > 0 ? "text-sm font-medium" : "text-sm text-muted-foreground"} /> },
    { key: "issue", header: "Issued", hideOnMobile: true, render: (i) => <span className="text-sm text-muted-foreground">{fmtDate(i.issueDate, tz)}</span> },
    { key: "due", header: "Due", hideOnMobile: true, render: (i) => <span className="text-sm text-muted-foreground">{fmtDate(i.dueDate, tz)}</span> },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={i.effectiveStatus} /> },
    ...(canWrite ? [{ key: "actions" as const, header: "", hideOnMobile: true, render: (i: InvoiceType) => (
      <div className="flex justify-end gap-1">
        {i.outstandingCents > 0 && <Button variant="ghost" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); setPayDialog(i); }}><CreditCard className="size-3" /> Pay</Button>}
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setPayDialog(null); }}>Edit</Button>
      </div>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="Invoices and payment tracking"
        actions={canWrite && <Button size="sm" className="gap-1.5" onClick={() => setNewInvDialog(true)}><Plus className="size-3.5" /> New invoice</Button>} />

      {/* Premium KPI cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <StatCard label="Outstanding" value={<Money cents={totalOutstanding} />} tone={totalOutstanding > 0 ? "warn" : "good"} icon={<Wallet className="size-4" />} />
        <StatCard label="Paid" value={<Money cents={totalPaid} />} tone="good" icon={<CreditCard className="size-4" />} />
        <StatCard label="Overdue" value={overdueCount} tone={overdueCount > 0 ? "bad" : "default"} />
        <StatCard label="Total invoices" value={invoices?.length ?? 0} />
      </motion.div>

      <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-48">
        <option value="">All statuses</option>
        {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </SelectInput>

      {invoices === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={invoices} getKey={(i) => i._id}
          empty={<EmptyState icon={<Wallet className="size-6" />} title="No invoices" description="Invoices are auto-created when loads are completed, or you can create them manually." action={canWrite ? <Button size="sm" onClick={() => setNewInvDialog(true)}><Plus className="size-3.5" /> New invoice</Button> : undefined} />} />
      )}

      {/* Payment dialog */}
      {payDialog && (
        <Dialog open onOpenChange={() => setPayDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>For {payDialog.invoiceNumber} — outstanding: <Money cents={payDialog.outstandingCents} /></DialogDescription></DialogHeader>
            <form onSubmit={handlePayment} className="space-y-4">
              <Field label="Amount ($)" required><MoneyInput name="amount" required defaultValue={(payDialog.outstandingCents / 100).toFixed(2)} /></Field>
              <Field label="Method"><TextInput name="method" placeholder="ACH, check, wire…" /></Field>
              <Field label="Reference"><TextInput name="reference" placeholder="Check #, transaction ID…" /></Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
                <Button type="submit">Record payment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* New invoice dialog */}
      {newInvDialog && (
        <Dialog open onOpenChange={() => setNewInvDialog(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New invoice</DialogTitle><DialogDescription>Create a manual dispatcher invoice.</DialogDescription></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Carrier">
                <SelectInput name="carrierId">
                  <option value="">Select carrier</option>
                  {carriers?.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                </SelectInput>
              </Field>
              <Field label="Amount ($)" required><MoneyInput name="amount" required /></Field>
              <Field label="Due date"><TextInput name="dueDate" type="date" /></Field>
              <Field label="Notes"><TextArea name="notes" rows={2} /></Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewInvDialog(false)}>Cancel</Button>
                <Button type="submit">Create invoice</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
