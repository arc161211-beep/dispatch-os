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
import heroTruckImg from "/assets/publichero-truck.png";
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
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
    <div className="space-y-5">
      {/* ═══════════════ ROW 1: HERO + COMPACT KPI ═══════════════ */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Hero — larger */}
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/80 lg:col-span-3"
        >
          <div className="relative z-10 p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
              Operations Command Center
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">
              {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Everything important, at a glance.</p>

            {/* Compact KPI summary */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs">
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
              {summary.ops.deliveriesToday > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#F5A623]/10 px-2.5 py-1 font-medium text-[#F5A623]">
                  <CalendarClock className="size-3" /> {summary.ops.deliveriesToday} delivery{summary.ops.deliveriesToday !== 1 ? "ies" : ""} today
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
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => navigate("/assistant")}>
                  <Sparkles className="size-3.5" /> AI
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Truck animation — right side */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.05 }}
          className="hidden rounded-2xl border border-border/50 bg-card p-4 lg:flex lg:col-span-2 flex-col items-center justify-center"
        >
          <img src={heroTruckImg} alt="DispatchOS fleet" className="w-full h-auto max-h-[280px] rounded-xl object-cover" style={{ filter: "drop-shadow(0 15px 30px rgba(0,0,0,0.4))" }} loading="lazy" />
          <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
            {summary.ops.activeLoads > 0 ? "Fleet in motion" : "Fleet standing by"}
          </p>
        </motion.div>
      </div>

      {/* ═══════════════ ROW 2: ACTIVE LOADS + ATTENTION ═══════════════ */}
      <motion.div {...fadeUp} transition={{ delay: 0.08 }} className="grid gap-5 lg:grid-cols-3">
        {/* Active loads — larger */}
        <div className="rounded-xl border border-border/50 bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Loads</h3>
            <Link to="/loads" className="text-[11px] font-medium text-primary hover:underline">View all</Link>
          </div>
          {summary.upcoming.pickups.length === 0 && summary.upcoming.deliveries.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No active loads right now.</p>
          ) : (
            <div className="space-y-1.5">
              {[...summary.upcoming.pickups, ...summary.upcoming.deliveries].slice(0, 5).map((l: any) => (
                <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.loadNumber} · {l.origin ?? "?"} → {l.destination ?? "?"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{fmtDateTime(l.pickupDate ?? l.deliveryDate, tz)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Attention — smaller */}
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-[#F5A623]/10">
              <AlertTriangle className="size-3 text-[#F5A623]" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Needs Attention</h3>
          </div>
          {(summary.attention.urgentMessages.length === 0 && summary.attention.missingPod.length === 0 && summary.attention.overdueTasks.length === 0 && summary.attention.overdueInvoices.length === 0) ? (
            <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-[#22C55E]" /> All clear.
            </div>
          ) : (
            <div className="space-y-2">
              {summary.attention.urgentMessages.length > 0 && (
                <Link to="/messages" className="flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-2.5 py-2 text-xs hover:bg-destructive/10">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  <span className="font-medium">{summary.attention.urgentMessages.length} urgent message{summary.attention.urgentMessages.length !== 1 ? "s" : ""}</span>
                </Link>
              )}
              {summary.attention.missingPod.length > 0 && (
                <Link to="/loads" className="flex items-center gap-2 rounded-lg bg-[#F5A623]/5 border border-[#F5A623]/20 px-2.5 py-2 text-xs hover:bg-[#F5A623]/10">
                  <span className="size-1.5 rounded-full bg-[#F5A623]" />
                  <span className="font-medium">{summary.attention.missingPod.length} missing POD</span>
                </Link>
              )}
              {summary.attention.overdueTasks.length > 0 && (
                <Link to="/tasks" className="flex items-center gap-2 rounded-lg bg-[#F5A623]/5 border border-[#F5A623]/20 px-2.5 py-2 text-xs hover:bg-[#F5A623]/10">
                  <span className="size-1.5 rounded-full bg-[#F5A623]" />
                  <span className="font-medium">{summary.attention.overdueTasks.length} overdue task{summary.attention.overdueTasks.length !== 1 ? "s" : ""}</span>
                </Link>
              )}
              {summary.attention.overdueInvoices.length > 0 && (
                <Link to="/finance" className="flex items-center gap-2 rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/20 px-2.5 py-2 text-xs hover:bg-[#EF4444]/10">
                  <span className="size-1.5 rounded-full bg-[#EF4444]" />
                  <span className="font-medium">{summary.attention.overdueInvoices.length} overdue invoice{summary.attention.overdueInvoices.length !== 1 ? "s" : ""}</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══════════════ ROW 3: MAP + UPCOMING ═══════════════ */}
      <motion.div {...fadeUp} transition={{ delay: 0.12 }} className="grid gap-5 lg:grid-cols-5">
        {/* Fleet map — larger */}
        <div className="rounded-xl border border-border/50 bg-card p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fleet Map</h3>
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

        {/* Upcoming schedule — smaller */}
        <div className="rounded-xl border border-border/50 bg-card p-4 lg:col-span-2">
          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Upcoming Schedule</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">Next 7 days</p>
          </div>
          {summary.upcoming.pickups.length === 0 && summary.upcoming.deliveries.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No upcoming events</p>
          ) : (
            <div className="space-y-1.5">
              {summary.upcoming.pickups.slice(0, 3).map((l: any) => (
                <Link key={`p-${l._id}`} to={`/loads/${l._id}`} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{l.loadNumber} pickup</p>
                    <p className="truncate text-[10px] text-muted-foreground">{fmtDateTime(l.pickupDate, tz)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
              {summary.upcoming.deliveries.slice(0, 3).map((l: any) => (
                <Link key={`d-${l._id}`} to={`/loads/${l._id}`} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{l.loadNumber} delivery</p>
                    <p className="truncate text-[10px] text-muted-foreground">{fmtDateTime(l.deliveryDate, tz)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          )}

          {/* Trucks needing loads */}
          {trucksNeedingLoads.length > 0 && (
            <div className="mt-3 border-t border-border/30 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Trucks Needing Loads</h4>
                {canWrite && <Link to="/loads?new=1" className="text-[10px] font-medium text-primary hover:underline">Create</Link>}
              </div>
              {trucksNeedingLoads.slice(0, 3).map((t: any) => (
                <Link key={t._id} to={`/trucks/${t._id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40">
                  <span className="text-xs font-medium">{t.unitNumber}</span>
                  <StatusBadge status="Available" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══════════════ ROW 4: FINANCE + AI ═══════════════ */}
      <motion.div {...fadeUp} transition={{ delay: 0.16 }} className="grid gap-5 lg:grid-cols-3">
        {/* Finance — larger */}
        <div className="rounded-xl border border-border/50 bg-card p-4 lg:col-span-2">
          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={<Wallet className="size-4" />} label="Gross Booked" value={`$${(summary.finance.grossBookedCents / 100).toLocaleString()}`} accent="gold" />
            <KpiCard icon={<Wallet className="size-4" />} label="Dispatcher Revenue" value={`$${(summary.finance.dispatcherRevenueCents / 100).toLocaleString()}`} accent="blue" />
            <KpiCard icon={<Wallet className="size-4" />} label="Paid" value={`$${(summary.finance.paidFeesCents / 100).toLocaleString()}`} accent="green" />
            <KpiCard
              icon={<FileWarning className="size-4" />}
              label="Outstanding"
              value={`$${(summary.finance.outstandingFeesCents / 100).toLocaleString()}`}
              accent={summary.finance.outstandingFeesCents > 0 ? "red" : "green"}
            />
          </div>
        </div>

        {/* AI Insights — smaller */}
        <AiInsightCard
          configured={!!aiConfig?.configured}
          text={aiText ?? summary.dailySummaryText}
          loading={aiState === "loading"}
        />
      </motion.div>
    </div>
  );
}
