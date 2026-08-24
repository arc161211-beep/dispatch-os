import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { DRIVER_STATUSES, ROLES } from "@/convex/constants";
import { useCanWrite, useTimezone } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, NextActionPill, LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { Field, Grid, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { ImportCsvDialog, ExportCsvButton } from "@/components/app/ImportExport";
import { Search, UserRound, Plus, ExternalLink, UserPlus } from "lucide-react";
import { nextAction } from "@/lib/status";
import { fmtDate } from "@/lib/dates";
import { useTimezone as useTz } from "@/hooks/use-app";

type DriverType = any;

export default function Drivers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tz = useTz();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [availability, setAvailability] = useState("");
  const [dialog, setDialog] = useState<"create" | DriverType | null>(null);
  const [inviteDialog, setInviteDialog] = useState<DriverType | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") { setDialog("create"); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  const drivers = useQuery(api.drivers.list, { search: debounced || undefined, availability: availability || undefined });
  const carriers = useQuery(api.carriers.list, {});
  const inviteUser = useMutation(api.users.inviteUser);
  const setAvail = useMutation(api.drivers.setAvailability);

  const handleAvail = async (d: DriverType, val: string) => {
    try { await setAvail({ id: d._id, availability: val as never }); toast.success(`${d.name} → ${val}`); } catch (e) { toast.error(errorMessage(e)); }
  };

  const columns: Column<DriverType>[] = [
    { key: "name", header: "Driver", render: (d) => <div><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.phone ?? "No phone"}</p></div> },
    { key: "carrier", header: "Carrier", hideOnMobile: true, render: (d) => <span className="text-sm text-muted-foreground">{carriers?.find((c) => c._id === d.carrierId)?.companyName ?? "—"}</span> },
    { key: "location", header: "Location", hideOnMobile: true, render: (d) => <span className="text-sm text-muted-foreground">{d.currentLocation ?? d.homeLocation ?? "—"}</span> },
    { key: "status", header: "Status", render: (d) => <StatusBadge status={d.availability} /> },
    { key: "next", header: "Next action", hideOnMobile: true, render: (d) => <NextActionPill action={nextAction("driver", d)} /> },
    ...(canWrite ? [{ key: "actions" as const, header: "", hideOnMobile: true, render: (d: DriverType) => (
      <div className="flex justify-end gap-1">
        <Link to={`/drivers/${d._id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors" title="View details">
          <ExternalLink className="size-4 text-muted-foreground" />
        </Link>
        {d.email && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setInviteDialog(d); }} title="Invite as DispatchOS user">
            <UserPlus className="size-3.5" />
          </Button>
        )}
        <SelectInput value={d.availability} onChange={(e) => handleAvail(d, e.target.value)} className="h-8 w-32 text-xs" onClick={(e) => e.stopPropagation()}>
          {DRIVER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDialog(d); }}>Edit</Button>
      </div>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Drivers" description={`${drivers?.length ?? 0} drivers`}
        actions={canWrite && (<>
          <ImportCsvDialog entity="drivers" mutationName="importDrivers" title="Import drivers" description="CSV with name, carrierName, phone, email, truckUnit, homeLocation, availability." requiredColumns={["name", "carrierName"]} mapRow={(r) => ({ name: r.name ?? "", carrierName: r.carrierName ?? "", phone: r.phone, email: r.email, truckUnit: r.truckUnit, homeLocation: r.homeLocation, availability: r.availability })} />
          <ExportCsvButton filename="drivers.csv" headers={["Name", "Carrier", "Phone", "Email", "Truck", "Location", "Status"]} rows={(drivers ?? []).map((d) => [d.name, carriers?.find((c) => c._id === d.carrierId)?.companyName ?? "", d.phone ?? "", d.email ?? "", "", d.currentLocation ?? d.homeLocation ?? "", d.availability])} />
          <Button size="sm" className="gap-1.5" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New driver</Button>
        </>)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone…" className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
        </div>
        <SelectInput value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full sm:w-48">
          <option value="">All statuses</option>
          {DRIVER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
      </div>
      {drivers === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={drivers} getKey={(d) => d._id} onRowClick={canWrite ? (d) => setDialog(d) : (d) => navigate(`/drivers/${d._id}`)}
          empty={<EmptyState icon={<UserRound className="size-6" />} title="No drivers yet" description="Add your first driver or import a CSV." action={canWrite ? <Button size="sm" onClick={() => setDialog("create")}><Plus className="size-3.5" /> New driver</Button> : undefined} />} />
      )}
      {dialog && <DriverFormDialog driver={dialog === "create" ? null : dialog} carriers={carriers ?? []} onClose={() => setDialog(null)} />}
      {inviteDialog && (
        <InviteDriverDialog
          driver={inviteDialog}
          onClose={() => setInviteDialog(null)}
          onInvite={async () => {
            if (!inviteDialog.email) { toast.error("Driver has no email address."); return; }
            try {
              await inviteUser({
                email: inviteDialog.email,
                role: "driver" as any,
                name: inviteDialog.name,
                driverId: inviteDialog._id as any,
              });
              toast.success(`Invitation sent to ${inviteDialog.email}`);
              setInviteDialog(null);
            } catch (e) { toast.error(errorMessage(e)); }
          }}
        />
      )}
    </div>
  );
}

function DriverFormDialog({ driver, carriers, onClose }: { driver: DriverType | null; carriers: { _id: string; companyName: string }[]; onClose: () => void }) {
  const create = useMutation(api.drivers.create);
  const update = useMutation(api.drivers.update);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const input = {
      carrierId: String(fd.get("carrierId") ?? "") as any,
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? "") || undefined,
      email: String(fd.get("email") ?? "") || undefined,
      homeLocation: String(fd.get("homeLocation") ?? "") || undefined,
      currentLocation: String(fd.get("currentLocation") ?? "") || undefined,
      licenseExpiry: fd.get("licenseExpiry") ? new Date(String(fd.get("licenseExpiry"))).getTime() : undefined,
      medicalCardExpiry: fd.get("medicalCardExpiry") ? new Date(String(fd.get("medicalCardExpiry"))).getTime() : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    try {
      if (driver) { await update({ id: driver._id, input }); toast.success("Driver updated."); }
      else { await create({ input: input as any } as any); toast.success("Driver created."); }
      onClose();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{driver ? `Edit ${driver.name}` : "New driver"}</DialogTitle><DialogDescription>Driver details and assignment.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Grid>
            <Field label="Carrier" required>
              <SelectInput name="carrierId" required defaultValue={driver?.carrierId ?? ""}>
                <option value="">Select carrier</option>
                {carriers.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
              </SelectInput>
            </Field>
            <Field label="Name" required><TextInput name="name" required defaultValue={driver?.name ?? ""} /></Field>
            <Field label="Phone"><TextInput name="phone" defaultValue={driver?.phone ?? ""} /></Field>
            <Field label="Email"><TextInput name="email" type="email" defaultValue={driver?.email ?? ""} /></Field>
            <Field label="Home location"><TextInput name="homeLocation" defaultValue={driver?.homeLocation ?? ""} placeholder="Dallas, TX" /></Field>
            <Field label="Current location"><TextInput name="currentLocation" defaultValue={driver?.currentLocation ?? ""} /></Field>
            <Field label="License expiry"><TextInput name="licenseExpiry" type="date" defaultValue={driver?.licenseExpiry ? new Date(driver.licenseExpiry).toISOString().split("T")[0] : ""} /></Field>
            <Field label="Medical card expiry"><TextInput name="medicalCardExpiry" type="date" defaultValue={driver?.medicalCardExpiry ? new Date(driver.medicalCardExpiry).toISOString().split("T")[0] : ""} /></Field>
          </Grid>
          <Field label="Notes"><TextArea name="notes" defaultValue={driver?.notes ?? ""} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : driver ? "Save changes" : "Create driver"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteDriverDialog({ driver, onClose, onInvite }: { driver: DriverType; onClose: () => void; onInvite: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const handleConfirm = async () => {
    setBusy(true);
    try { await onInvite(); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Driver as User</DialogTitle>
          <DialogDescription>
            Create a DispatchOS login for this driver. They will be able to sign in using their email and access the Driver Portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14">Name</span>
            <span className="text-sm font-medium">{driver.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14">Email</span>
            <span className="text-sm font-medium">{driver.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14">Role</span>
            <span className="text-sm font-medium">Driver</span>
          </div>
        </div>
        {!driver.email && (
          <p className="text-xs text-[#EF4444]">This driver has no email address. Add an email before inviting.</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={busy || !driver.email} className="gap-1.5">
            <UserPlus className="size-3.5" />
            {busy ? "Sending…" : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
