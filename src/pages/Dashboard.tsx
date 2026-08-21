import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useTimezone, useCanWrite } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, AiInsightCard, StatusBadge, EmptyState, PageHeader } from "@/components/app/Premium";
import { TruckHero } from "@/components/brand/TruckHero";
import { fmtDateTime, fmtDate, fmtRelative } from "@/lib/dates";
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
  CalendarClock,
  FileWarning,
  CircleAlert,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const },
};

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

  if (!summary) {
    return (
      <div className="space-y-6">
        <div className="h-48 rounded-2xl bg-muted/30 animate-pulse" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const trucksNeedingLoads = summary.trucksNeedingLoads ?? [];

  return (
    <div className="space-y-6">
      {/* ═══════════════ HERO ═══════════════ */}
      <motion.div
        {...fadeUp}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-card/80"
      >
        <div className="relative z-10 flex flex-col lg:flex-row">
          <div className="flex-1 p-6 lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Operations Command Center
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">
              {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{fmtDate(Date.now(), tz)}</p>

            {/* Operational summary */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {summary.ops.availableTrucks > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#22C55E]/10 px-2.5 py-1 font-medium text-[#22C55E]">
                  <Truck className="size-3" /> {summary.ops.availableTrucks} truck{summary.ops.availableTrucks !== 1 ? "s" : ""} available
                </span>
              )}
              {summary.ops.activeLoads > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-electric/10 px-2.5 py-1 font-medium text-electric">
                  <Package className="size-3" /> {summary.ops.activeLoads} active load{summary.ops.activeLoads !== 1 ? "s" : ""}
                </span>
              )}
              {summary.ops.pickupsToday > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#F5A623]/10 px-2.5 py-1 font-medium text-[#F5A623]">
                  <CalendarClock className="size-3" /> {summary.ops.pickupsToday} pickup{summary.ops.pickupsToday !== 1 ? "s" : ""} today
                </span>
              )}
              {summary.ops.urgentIssues === 0 && summary.ops.activeLoads === 0 && summary.ops.availableTrucks === 0 && (
                <span className="flex items-center gap-1.5 text-muted-foreground/70">
                  <CheckCircle2 className="size-3 text-[#22C55E]" /> Your operation is under control.
                </span>
              )}
            </div>

            {/* Quick actions */}
            {canWrite && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20" onClick={() => navigate("/loads?new=1")}>
                  <Package className="size-3.5" /> New Load
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/carriers?new=1")}>
                  <Building2 className="size-3.5" /> New Carrier
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/leads?new=1")}>
                  New Lead
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => navigate("/assistant")}>
                  <Sparkles className="size-3.5" /> AI
                </Button>
              </div>
            )}
          </div>

          {/* Truck animation */}
          <div className="hidden w-[360px] shrink-0 items-center justify-center lg:flex">
            <TruckHero width={340} height={180} status={summary.ops.activeLoads > 0 ? "moving" : "idle"} />
          </div>
        </div>
      </motion.div>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <motion.div {...fadeUp} transition={{ delay: 0.08 }} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard icon={<Truck className="size-4" />} label="Active Trucks" value={summary.ops.trucks} accent="blue" />
        <KpiCard icon={<MapPin className="size-4" />} label="Available" value={summary.ops.availableTrucks} accent="green" />
        <KpiCard icon={<Package className="size-4" />} label="Active Loads" value={summary.ops.activeLoads} accent="blue" />
        <KpiCard icon={<Route className="size-4" />} label="In Transit" value={summary.ops.inTransit} accent="gold" />
        <KpiCard icon={<CalendarClock className="size-4" />} label="Pickups Today" value={summary.ops.pickupsToday} accent={summary.ops.pickupsToday > 0 ? "green" : "blue"} />
        <KpiCard icon={<CheckCircle2 className="size-4" />} label="Deliveries Today" value={summary.ops.deliveriesToday} accent={summary.ops.deliveriesToday > 0 ? "green" : "blue"} />
        <KpiCard icon={<Wallet className="size-4" />} label="Gross Booked" value={`$${(summary.finance.grossBookedCents / 100).toLocaleString()}`} accent="gold" />
        <KpiCard
          icon={<FileWarning className="size-4" />}
          label="Overdue"
          value={summary.finance.overdueInvoices}
          accent={summary.finance.overdueInvoices > 0 ? "red" : "green"}
        />
      </motion.div>

      {/* ═══════════════ EMPTY STATE ═══════════════ */}
      {summary.empty && (
        <motion.div {...fadeUp} transition={{ delay: 0.12 }}>
          <EmptyState
            icon={<Package className="size-6" />}
            title="Welcome to DispatchOS"
            description="Set up your workspace with real records — no demo data required."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {canWrite && (
                  <>
                    <Button size="sm" onClick={() => navigate("/carriers?new=1")}><Building2 className="mr-1.5 size-3.5" /> Add First Carrier</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("/trucks?new=1")}><Truck className="mr-1.5 size-3.5" /> Add a Truck</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("/drivers?new=1")}><Route className="mr-1.5 size-3.5" /> Add a Driver</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate("/loads?new=1")}><Package className="mr-1.5 size-3.5" /> Create Load</Button>
                  </>
                )}
              </div>
            }
          />
        </motion.div>
      )}

      {/* ═══════════════ MAP + NEEDING LOADS ═══════════════ */}
      <motion.div {...fadeUp} transition={{ delay: 0.16 }} className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fleet Map</h3>
                {truckLocations && truckLocations.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">{truckLocations.length} truck{truckLocations.length !== 1 ? "s" : ""} with GPS</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="text-[10px] text-muted-foreground/60">Live</span>
              </div>
            </div>
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
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trucks Needing Loads</h3>
              {canWrite && (
                <Link to="/loads?new=1" className="text-[11px] font-medium text-primary hover:underline">Create load</Link>
              )}
            </div>
            {trucksNeedingLoads.length === 0 ? (
              <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-[#22C55E]" /> All trucks assigned or unavailable.
              </div>
            ) : (
              <div className="space-y-2">
                {trucksNeedingLoads.slice(0, 8).map((t: any) => (
                  <Link
                    key={t._id}
                    to={`/trucks/${t._id}`}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{t.unitNumber} {t.type ? <span className="font-normal text-muted-foreground">({t.type})</span> : ""}</p>
                      <p className="text-[11px] text-muted-foreground">{t.currentLocation ?? "No location"}</p>
                    </div>
                    <StatusBadge status="Available" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ═══════════════ ATTENTION CENTER ═══════════════ */}
      {(summary.attention.urgentMessages.length > 0 ||
        summary.attention.missingPod.length > 0 ||
        summary.attention.overdueTasks.length > 0 ||
        summary.attention.overdueInvoices.length > 0) && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-5 items-center justify-center rounded bg-[#F5A623]/10">
                <AlertTriangle className="size-3 text-[#F5A623]" />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs Your Attention</h3>
            </div>
            <div className="space-y-3">
              {summary.attention.urgentMessages.length > 0 && (
                <AttentionGroup title="Urgent Messages" count={summary.attention.urgentMessages.length}>
                  {summary.attention.urgentMessages.map((m) => (
                    <AttentionRow key={m._id} to="/messages" title={m.body.slice(0, 100)} sub={`${m.priority} · ${m.status}`} urgent />
                  ))}
                </AttentionGroup>
              )}
              {summary.attention.missingPod.length > 0 && (
                <AttentionGroup title="Missing POD" count={summary.attention.missingPod.length}>
                  {summary.attention.missingPod.map((l) => (
                    <AttentionRow key={l._id} to={`/loads/${l._id}`} title={`${l.loadNumber} — ${l.origin ?? "?"} → ${l.destination ?? "?"}`} sub={l.status} />
                  ))}
                </AttentionGroup>
              )}
              {summary.attention.overdueTasks.length > 0 && (
                <AttentionGroup title="Overdue Tasks" count={summary.attention.overdueTasks.length}>
                  {summary.attention.overdueTasks.map((t) => (
                    <AttentionRow key={t._id} to="/tasks" title={t.title} sub={`Due ${fmtRelative(t.dueAt)}`} />
                  ))}
                </AttentionGroup>
              )}
              {summary.attention.overdueInvoices.length > 0 && (
                <AttentionGroup title="Overdue Invoices" count={summary.attention.overdueInvoices.length}>
                  {summary.attention.overdueInvoices.map((i) => (
                    <AttentionRow key={i._id} to="/finance" title={i.invoiceNumber} sub={`$${((i.amountCents - i.paidCents) / 100).toLocaleString()}`} />
                  ))}
                </AttentionGroup>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════ UPCOMING ═══════════════ */}
      <motion.div {...fadeUp} transition={{ delay: 0.24 }} className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Pickups</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">Next 7 days</p>
            </div>
          </div>
          {summary.upcoming.pickups.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No upcoming pickups</p>
          ) : (
            <div className="space-y-1.5">
              {summary.upcoming.pickups.map((l) => (
                <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.loadNumber} · {l.origin ?? "?"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{fmtDateTime(l.pickupDate, tz)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Deliveries</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">Next 7 days</p>
          </div>
          {summary.upcoming.deliveries.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No upcoming deliveries</p>
          ) : (
            <div className="space-y-1.5">
              {summary.upcoming.deliveries.map((l) => (
                <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.loadNumber} · {l.destination ?? "?"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{fmtDateTime(l.deliveryDate, tz)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══════════════ AI + FINANCE ═══════════════ */}
      <motion.div {...fadeUp} transition={{ delay: 0.28 }} className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finance Overview</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <KpiCard icon={<Wallet className="size-4" />} label="Dispatcher Revenue" value={`$${(summary.finance.dispatcherRevenueCents / 100).toLocaleString()}`} accent="gold" />
              <KpiCard icon={<Wallet className="size-4" />} label="Paid" value={`$${(summary.finance.paidFeesCents / 100).toLocaleString()}`} accent="green" />
              <KpiCard icon={<CircleAlert className="size-4" />} label="Outstanding" value={`$${(summary.finance.outstandingFeesCents / 100).toLocaleString()}`} accent={summary.finance.outstandingFeesCents > 0 ? "red" : "green"} />
            </div>
          </div>
        </div>
        <AiInsightCard
          configured={!!aiConfig?.configured}
          text={aiText ?? summary.dailySummaryText}
          loading={aiState === "loading"}
        />
      </motion.div>
    </div>
  );
}

function AttentionGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <Badge variant="outline" className="border-[#F5A623]/20 bg-[#F5A623]/10 text-[10px] font-bold text-[#F5A623]">{count}</Badge>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function AttentionRow({ to, title, sub, urgent }: { to: string; title: React.ReactNode; sub: React.ReactNode; urgent?: boolean }) {
  return (
    <Link to={to} className={cn(
      "flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40",
      urgent && "border border-destructive/20 bg-destructive/5",
    )}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40" />
    </Link>
  );
}
