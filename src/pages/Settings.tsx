import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { FEE_TYPES } from "@/convex/constants";
import { useCanAdmin } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, SectionCard, LoadingState, errorMessage, ConfirmButton } from "@/components/app/shared";
import { Field, Grid, MoneyInput, SelectInput, TextArea, TextInput } from "@/components/app/forms";
import { Settings, Save, Trash2, Database, Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const canAdmin = useCanAdmin();
  const settingsData = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);
  const seedDemo = useMutation(api.seed.seedDemoData);
  const clearDemo = useMutation(api.seed.clearDemoData);
  const [busy, setBusy] = useState(false);
  const [clearDialog, setClearDialog] = useState(false);

  if (!settingsData) return <LoadingState />;
  const settings = settingsData.settings as any;
  const org = settingsData.org as any;
  if (!settings || !org) return <LoadingState />;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateSettings({
        companyName: String(fd.get("companyName") ?? "") || undefined,
        contactEmail: String(fd.get("contactEmail") ?? "") || undefined,
        phone: String(fd.get("phone") ?? "") || undefined,
        timezone: String(fd.get("timezone") ?? "") || undefined,
        currency: String(fd.get("currency") ?? "") || undefined,
        feeDefaults: {
          feeType: (fd.get("feeType") as string || "percentage") as typeof FEE_TYPES[number],
          feeRatePercent: fd.get("feeRatePercent") ? Number(fd.get("feeRatePercent")) : undefined,
          flatFeeCents: fd.get("flatFeeCents") ? Math.round(Number(fd.get("flatFeeCents")) * 100) : undefined,
        },
      });
      toast.success("Settings saved.");
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const handleSeed = async () => {
    try { await seedDemo({}); toast.success("Demo data loaded."); } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleClear = async () => {
    try { await clearDemo(); toast.success("Demo data cleared."); setClearDialog(false); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace configuration" />
      <form onSubmit={handleSave} className="space-y-6">
        <SectionCard title="Organization">
          <Grid>
            <Field label="Company name"><TextInput name="companyName" defaultValue={org.name} /></Field>
            <Field label="Contact email"><TextInput name="contactEmail" type="email" defaultValue={settings.contactEmail ?? ""} /></Field>
            <Field label="Phone"><TextInput name="phone" defaultValue={settings.phone ?? ""} /></Field>
            <Field label="Timezone">
              <SelectInput name="timezone" defaultValue={settings.timezone}>
                {["America/Chicago", "America/New_York", "America/Los_Angeles", "America/Denver", "UTC"].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Currency">
              <SelectInput name="currency" defaultValue={settings.currency}>
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
              </SelectInput>
            </Field>
          </Grid>
        </SectionCard>

        <SectionCard title="Default dispatch fee">
          <Grid>
            <Field label="Fee model">
              <SelectInput name="feeType" defaultValue={settings.feeDefaults.feeType}>
                {FEE_TYPES.map((f) => <option key={f} value={f}>{f === "percentage" ? "Percentage" : "Flat fee"}</option>)}
              </SelectInput>
            </Field>
            <Field label="Default %"><TextInput name="feeRatePercent" type="number" step="0.1" defaultValue={settings.feeDefaults.feeRatePercent ?? 7} /></Field>
            <Field label="Flat fee ($)"><MoneyInput name="flatFeeCents" defaultValue={settings.feeDefaults.flatFeeCents ? (settings.feeDefaults.flatFeeCents / 100).toFixed(2) : ""} /></Field>
          </Grid>
        </SectionCard>

        {canAdmin && (
          <div className="flex justify-end">
            <Button type="submit" disabled={busy} className="gap-1.5"><Save className="size-3.5" /> {busy ? "Saving…" : "Save settings"}</Button>
          </div>
        )}
      </form>

      {canAdmin && (
        <SectionCard title="Demo data" description="Load or clear sample data for testing.">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSeed} className="gap-1.5"><Database className="size-3.5" /> Load demo data</Button>
            {settings.demoMode && (
              <ConfirmButton trigger={<Button variant="destructive" className="gap-1.5"><Trash2 className="size-3.5" /> Clear demo data</Button>} title="Clear all demo data?" description="This will remove all demo-flagged records. This cannot be undone." onConfirm={handleClear} confirmLabel="Clear demo data" />
            )}
          </div>
          {settings.demoMode && <p className="mt-2 text-xs text-amber-600">Demo mode is active. A banner is shown in the app.</p>}
        </SectionCard>
      )}

      <NotificationPrefsCard />
    </div>
  );
}


// ---------------------------------------------------------------------------
// Notification Preferences (per-user)
// ---------------------------------------------------------------------------

function NotificationPrefsCard() {
  const prefsData = useQuery(api.settings.getUserNotificationPrefs);
  const updatePrefs = useMutation(api.settings.updateUserNotificationPrefs);
  const [prefs, setPrefs] = useState({
    urgent: true, loads: true, documents: true, messages: true,
    tasks: true, finance: true, location: true,
  });
  const [saved, setSaved] = useState(false);

  // Sync from server
  if (prefsData && !saved) {
    const p = prefsData as any;
    if (p && typeof p.urgent === "boolean") {
      const serverPrefs = { urgent: p.urgent ?? true, loads: p.loads ?? true, documents: p.documents ?? true, messages: p.messages ?? true, tasks: p.tasks ?? true, finance: p.finance ?? true, location: p.location ?? true };
      if (JSON.stringify(serverPrefs) !== JSON.stringify(prefs)) {
        // Use setTimeout to avoid setState during render
        setTimeout(() => setPrefs(serverPrefs), 0);
      }
    }
  }

  const categories = [
    { key: "urgent" as const, label: "Urgent alerts", desc: "Critical operational notifications" },
    { key: "loads" as const, label: "Load updates", desc: "Status changes, assignments, pickups, deliveries" },
    { key: "documents" as const, label: "Documents", desc: "Upload confirmations, expiry warnings" },
    { key: "messages" as const, label: "Messages", desc: "New messages, replies, urgent communications" },
    { key: "tasks" as const, label: "Tasks", desc: "Task assignments, due date reminders" },
    { key: "finance" as const, label: "Finance", desc: "Invoice updates, payment records" },
    { key: "location" as const, label: "Location", desc: "GPS updates, truck arrival notifications" },
  ];

  const handleToggle = async (key: keyof typeof prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaved(true);
    try { await updatePrefs(next); } catch {}
  };

  return (
    <SectionCard title="Notification Preferences" description="Control which notification categories you receive.">
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.key} className="flex items-center justify-between gap-4 py-1">
            <div className="min-w-0">
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="text-xs text-muted-foreground">{cat.desc}</p>
            </div>
            <Switch
              checked={prefs[cat.key]}
              onCheckedChange={() => handleToggle(cat.key)}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Admins can configure organization-wide quiet hours and urgent-only overrides.
      </p>
    </SectionCard>
  );
}
