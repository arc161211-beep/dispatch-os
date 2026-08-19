import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useTimezone, useCanWrite } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard, SectionCard, StatusBadge, Money, LoadingState } from "@/components/app/shared";
import { fmtDateTime, fmtDate, fmtRelative, tzDayStart } from "@/lib/dates";
import { statusClass } from "@/lib/status";
import { cn } from "@/lib/utils";
import { TruckMap } from "@/components/app/TruckMap";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  MapPin,
  Package,
  Route,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tz = useTimezone();
  const canWrite = useCanWrite();
  const summary = useQuery(api.dashboard.summary);
  const truckLocations = useQuery(api.location.getTruckLocations, {});
  const aiConfig = useQuery(api.ai.config);
  const generateSummary = useAction(api.ai.generateDailySummary);

  const [aiText, setAiText] = useState<string | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    if (aiConfig?.configured && aiState === "idle") {
      setAiState("loading");
      generateSummary()
        .then((r) => {
          setAiText(r.text);
          setAiState(r.text ? "done" : "error");
        })
        .catch(() => setAiState("error"));
    }
  }, [aiConfig, aiState, generateSummary]);

  if (!summary) return <LoadingState label="Loading your operations…" />;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const quickActions = canWrite
    ? [
        { label: "New Load", to: "/loads?new=1" },
        { label: "New Carrier", to: "/carriers?new=1" },
        { label: "New Lead", to: "/leads?new=1" },
        { label: "Ask AI", to: "/assistant" },
      ]
    : [{ label: "Ask AI", to: "/assistant" }];

  const trucksNeedingLoads = summary.trucksNeedingLoads ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={fmtDate(Date.now(), tz)}
        actions={
          <>
            {canWrite && (
              <Link to="/loads?new=1">
                <Button size="sm" className="gap-1.5">
                  <Package className="size-3.5" /> New Load
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Onboarding checklist */}
      {summary.empty && (
        <SectionCard title="Get DispatchOS ready in minutes" description="Set up your workspace with real records — no demo data required.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Add your first carrier", to: "/carriers?new=1" },
              { label: "Add a truck to the carrier", to: "/trucks?new=1" },
              { label: "Add a driver", to: "/drivers?new=1" },
              { label: "Create your first load", to: "/loads?new=1" },
            ].map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => navigate(s.to)}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                <span className="text-sm font-medium">{s.label}</span>
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Operations */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operations</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Active carriers" value={summary.ops.activeCarriers} sub={`${summary.ops.totalCarriers} total`} icon={<Building2 className="size-4" />} />
          <StatCard label="Available trucks" value={summary.ops.availableTrucks} sub={`${summary.ops.trucks} total`} icon={<Truck className="size-4" />} />
          <StatCard label="Active loads" value={summary.ops.activeLoads} icon={<Package className="size-4" />} />
          <StatCard label="In transit" value={summary.ops.inTransit} icon={<Route className="size-4" />} />
          <StatCard label="Pickups today" value={summary.ops.pickupsToday} tone={summary.ops.pickupsToday > 0 ? "good" : "default"} />
          <StatCard label="Deliveries today" value={summary.ops.deliveriesToday} tone={summary.ops.deliveriesToday > 0 ? "good" : "default"} />
          <StatCard label="Delayed loads" value={summary.ops.delayedLoads} tone={summary.ops.delayedLoads > 0 ? "bad" : "default"} />
          <StatCard label="Urgent issues" value={summary.ops.urgentIssues} tone={summary.ops.urgentIssues > 0 ? "bad" : "good"} />
        </div>
      </div>

      {/* Finance */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Finance</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Gross booked" value={<Money cents={summary.finance.grossBookedCents} />} icon={<Wallet className="size-4" />} />
          <StatCard label="Dispatcher revenue" value={<Money cents={summary.finance.dispatcherRevenueCents} />} tone="accent" />
          <StatCard label="Outstanding fees" value={<Money cents={summary.finance.outstandingFeesCents} />} tone={summary.finance.outstandingFeesCents > 0 ? "warn" : "good"} />
          <StatCard label="Paid fees" value={<Money cents={summary.finance.paidFeesCents} />} tone="good" />
          <StatCard label="Overdue invoices" value={summary.finance.overdueInvoices} tone={summary.finance.overdueInvoices > 0 ? "bad" : "default"} />
        </div>
      </div>

      {/* Map + Trucks needing loads */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Truck Locations"
          description={truckLocations && truckLocations.length > 0 ? `${truckLocations.length} truck${truckLocations.length !== 1 ? "s" : ""} with GPS` : undefined}
        >
          <TruckMap
            trucks={(truckLocations ?? []).map((t: any) => ({
              truckId: t.truckId,
              unitNumber: t.unitNumber,
              type: t.type,
              driverName: t.driverName,
              availability: t.availability,
              lat: t.lat,
              lon: t.lon,
              location: t.location,
              at: t.at,
            }))}
          />
        </SectionCard>

        <SectionCard
          title="Trucks Needing Loads"
          description={`${trucksNeedingLoads.length} available truck${trucksNeedingLoads.length !== 1 ? "s" : ""} without assignment`}
          actions={canWrite ? (
            <Link to="/loads?new=1" className="text-xs font-medium text-primary hover:underline">Create load</Link>
          ) : undefined}
        >
          {trucksNeedingLoads.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-500" /> All trucks are assigned or unavailable.
            </div>
          ) : (
            <div className="divide-y">
              {trucksNeedingLoads.slice(0, 6).map((t: any) => (
                <div key={t._id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.unitNumber} {t.type ? `(${t.type})` : ""}</p>
                    <p className="text-xs text-muted-foreground">{t.currentLocation ?? "No location"}</p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-transparent text-[10px]">
                    Needs load
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attention */}
        <SectionCard
          title="Needs attention"
          description="Real items from your records"
          className="lg:col-span-2"
          actions={
            <Link to="/tasks" className="text-xs font-medium text-primary hover:underline">All tasks</Link>
          }
        >
          {summary.ops.urgentIssues === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-500" /> Nothing urgent right now.
            </div>
          ) : (
            <div className="space-y-4">
              {summary.attention.urgentMessages.length > 0 && (
                <AttentionGroup title="Urgent messages" count={summary.attention.urgentMessages.length}>
                  {summary.attention.urgentMessages.map((m) => (
                    <AttentionRow key={m._id} to="/messages" title={m.body.slice(0, 90)} sub={`${m.priority} · ${m.status}`} badge="urgent" />
                  ))}
                </AttentionGroup>
              )}
              {summary.attention.missingPod.length > 0 && (
                <AttentionGroup title="Missing POD" count={summary.attention.missingPod.length}>
                  {summary.attention.missingPod.map((l) => (
                    <AttentionRow key={l._id} to={`/loads/${l._id}`} title={`${l.loadNumber} — ${l.origin ?? "?"} → ${l.destination ?? "?"}`} sub={l.status} badge="POD" />
                  ))}
                </AttentionGroup>
              )}
              {summary.attention.overdueTasks.length > 0 && (
                <AttentionGroup title="Overdue tasks" count={summary.attention.overdueTasks.length}>
                  {summary.attention.overdueTasks.map((t) => (
                    <AttentionRow key={t._id} to="/tasks" title={t.title} sub={`Due ${fmtRelative(t.dueAt)}`} badge={t.priority} />
                  ))}
                </AttentionGroup>
              )}
              {summary.attention.overdueInvoices.length > 0 && (
                <AttentionGroup title="Overdue invoices" count={summary.attention.overdueInvoices.length}>
                  {summary.attention.overdueInvoices.map((i) => (
                    <AttentionRow key={i._id} to="/finance" title={i.invoiceNumber} sub={<Money cents={i.amountCents - i.paidCents} />} badge="overdue" />
                  ))}
                </AttentionGroup>
              )}
              {summary.attention.expiringCarriers.length > 0 && (
                <AttentionGroup title="Insurance expiring within 30 days" count={summary.attention.expiringCarriers.length}>
                  {summary.attention.expiringCarriers.map((c) => (
                    <AttentionRow key={c._id} to={`/carriers/${c._id}`} title={c.companyName} sub={`Expires ${fmtDate(c.insuranceExpiry)}`} badge="expiring" />
                  ))}
                </AttentionGroup>
              )}
              {summary.attention.expiringDrivers.length > 0 && (
                <AttentionGroup title="Driver credentials expiring" count={summary.attention.expiringDrivers.length}>
                  {summary.attention.expiringDrivers.map((d) => (
                    <AttentionRow key={d._id} to="/drivers" title={d.name} sub={fmtDate(d.licenseExpiry ?? d.medicalCardExpiry)} badge="expiring" />
                  ))}
                </AttentionGroup>
              )}
            </div>
          )}
        </SectionCard>

        {/* AI summary */}
        <SectionCard
          title="Daily summary"
          description={aiConfig?.configured ? `AI · ${aiConfig.model}` : "Computed from your records"}
          actions={<Sparkles className="size-4 text-primary" />}
        >
          {aiState === "loading" && (
            <div className="space-y-2 py-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
            </div>
          )}
          {aiState === "done" && aiText && <p className="text-sm leading-6 text-muted-foreground">{aiText}</p>}
          {aiState === "error" && <p className="text-sm leading-6 text-muted-foreground">{summary.dailySummaryText}</p>}
          {aiState === "idle" && !aiConfig?.configured && <p className="text-sm leading-6 text-muted-foreground">{summary.dailySummaryText}</p>}
          {aiState === "idle" && aiConfig?.configured && <p className="text-xs text-muted-foreground">Generating…</p>}
          {!aiConfig?.configured && (
            <p className="mt-3 rounded-lg border border-dashed bg-muted/40 p-2.5 text-xs text-muted-foreground">
              AI Not Configured — the summary above is generated from real database records. Add NVIDIA_API_KEY,
              NVIDIA_BASE_URL and NVIDIA_MODEL to enable the AI assistant.
            </p>
          )}
          <Link to="/assistant">
            <Button variant="outline" size="sm" className="mt-4 w-full gap-1.5">
              <Sparkles className="size-3.5" /> Open AI assistant
            </Button>
          </Link>
        </SectionCard>
      </div>

      {/* Upcoming */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Upcoming pickups" description="Next 7 days" actions={quickActions.length > 0 ? <QuickActions actions={quickActions} navigate={navigate} /> : undefined}>
          {summary.upcoming.pickups.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No upcoming pickups scheduled.</p>
          ) : (
            <div className="divide-y">
              {summary.upcoming.pickups.map((l) => (
                <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.loadNumber} · {l.origin ?? "?"}</p>
                    <p className="truncate text-xs text-muted-foreground">{fmtDateTime(l.pickupDate, tz)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Upcoming deliveries" description="Next 7 days">
          {summary.upcoming.deliveries.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No upcoming deliveries scheduled.</p>
          ) : (
            <div className="divide-y">
              {summary.upcoming.deliveries.map((l) => (
                <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.loadNumber} · {l.destination ?? "?"}</p>
                    <p className="truncate text-xs text-muted-foreground">{fmtDateTime(l.deliveryDate, tz)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function QuickActions({ actions, navigate }: { actions: { label: string; to: string }[]; navigate: (to: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.slice(0, 2).map((a) => (
        <Button key={a.label} variant="outline" size="sm" onClick={() => navigate(a.to)}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function AttentionGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Badge variant="outline" className={cn("border-transparent", count > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "")}>
          {count}
        </Badge>
      </div>
      <div className="mt-1 divide-y">{children}</div>
    </div>
  );
}

function AttentionRow({ to, title, sub, badge }: { to: string; title: React.ReactNode; sub: React.ReactNode; badge?: string }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-3 py-2 hover:bg-muted/30">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      {badge && (
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusClass(badge))}>
          {badge}
        </span>
      )}
    </Link>
  );
}
