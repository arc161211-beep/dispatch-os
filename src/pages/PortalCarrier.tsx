import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { PageHeader, StatCard, SectionCard, StatusBadge, Money, EmptyState, errorMessage } from "@/components/app/shared";
import { KpiCard, AiInsightCard } from "@/components/app/Premium";
import { TruckHero } from "@/components/brand/TruckHero";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/dates";
import { useTimezone } from "@/hooks/use-app";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { TruckMap } from "@/components/app/TruckMap";
import { AIAssistant } from "@/components/app/AIAssistant";
import {
  Package,
  Truck,
  UserRound,
  Wallet,
  FileText,
  MapPin,
  MessageSquare,
  ChevronRight,
  Loader2,
  Sparkles,
  Navigation,
  Activity,
} from "lucide-react";

type LoadType = any;
type TruckType = any;
type DriverType = any;

export default function PortalCarrier() {
  const { user } = useAuth();
  const tz = useTimezone();
  const loads = useQuery(api.loads.list, {});
  const trucks = useQuery(api.trucks.list, {});
  const drivers = useQuery(api.drivers.list, {});
  const invoices = useQuery(api.invoices.list, {});
  const documents = useQuery(api.documents.list, {});
  const conversations = useQuery(api.messages.listConversations, {});
  const truckLocations = useQuery(api.location.getTruckLocations, {});

  const activeLoads = (loads ?? []).filter((l: LoadType) => !["Completed", "Cancelled"].includes(l.status));
  const completedLoads = (loads ?? []).filter((l: LoadType) => l.status === "Completed");
  const availableTrucks = (trucks ?? []).filter((t: TruckType) => t.availability === "Available");
  const activeDrivers = (drivers ?? []).filter((d: DriverType) => d.availability !== "Off Duty");
  const outstanding = (invoices ?? []).reduce((sum: number, i: any) => sum + (i.amountCents - i.paidCents), 0);
  const urgentMessages = (conversations ?? []).filter((c: any) => c.urgent > 0);
  const inTransit = activeLoads.filter((l: LoadType) => ["In Transit", "Loaded", "At Delivery"].includes(l.status));

  const currentLoad = activeLoads.find((l: LoadType) =>
    ["In Transit", "At Delivery", "Loaded", "At Pickup", "Loading"].includes(l.status),
  );

  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-5 pb-8">
      {/* ═══════════ HERO ═══════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/80">
        <div className="relative z-10 flex flex-col lg:flex-row">
          <div className="flex-1 p-6 lg:p-7">
            <div className="flex items-center gap-2 mb-1">
              <Logo size="sm" variant="icon" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Fleet Operations</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              Your Fleet, <span className="text-electric">At a Glance</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{fmtDate(Date.now(), tz)}</p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-electric/10 px-2.5 py-1 font-medium text-electric">
                <Package className="size-3" /> {activeLoads.length} active load{activeLoads.length !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-[#22C55E]/10 px-2.5 py-1 font-medium text-[#22C55E]">
                <Navigation className="size-3" /> {inTransit.length} in transit
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-[#F5A623]/10 px-2.5 py-1 font-medium text-[#F5A623]">
                <Truck className="size-3" /> {availableTrucks.length} truck{availableTrucks.length !== 1 ? "s" : ""} available
              </span>
            </div>
          </div>
          <div className="hidden w-[300px] shrink-0 items-center justify-center lg:flex">
            <TruckHero width={280} height={160} status={activeLoads.length > 0 ? "moving" : "idle"} />
          </div>
        </div>
      </div>

      {/* ═══════════ KPIs ═══════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={<Package className="size-4" />} label="Active Loads" value={activeLoads.length} accent="blue" />
        <KpiCard icon={<Truck className="size-4" />} label="Trucks Available" value={availableTrucks.length} subtitle={`${trucks?.length ?? 0} total`} accent="green" />
        <KpiCard icon={<UserRound className="size-4" />} label="Active Drivers" value={activeDrivers.length} subtitle={`${drivers?.length ?? 0} total`} accent="blue" />
        <KpiCard icon={<Wallet className="size-4" />} label="Outstanding" value={<Money cents={outstanding} />} accent={outstanding > 0 ? "gold" : "green"} />
      </div>

      {/* ═══════════ CURRENT LOAD ═══════════ */}
      {currentLoad && (
        <div className="rounded-xl border border-electric/20 bg-electric/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-electric">Current Load</span>
            <StatusBadge status={currentLoad.status} />
          </div>
          <Link to={`/loads/${currentLoad._id}`} className="text-lg font-bold hover:underline">
            {currentLoad.loadNumber}
          </Link>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{currentLoad.origin ?? "?"}</span>
            <ChevronRight className="size-3" />
            <span>{currentLoad.destination ?? "?"}</span>
          </div>
        </div>
      )}

      {/* ═══════════ TABS ═══════════ */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loads">Loads ({activeLoads.length})</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="location">Map</TabsTrigger>
          <TabsTrigger value="documents">Docs</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="size-3.5 mr-1" /> AI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Upcoming Activity">
              {activeLoads.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">No active loads.</p>
              ) : (
                <div className="space-y-1.5">
                  {activeLoads.slice(0, 5).map((l: LoadType) => (
                    <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{l.loadNumber}</p>
                        <p className="text-[11px] text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                      </div>
                      <StatusBadge status={l.status} />
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Messages"
              actions={urgentMessages.length > 0 ? (
                <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">{urgentMessages.length} urgent</Badge>
              ) : undefined}
            >
              {(conversations ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">No messages yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {(conversations ?? []).slice(0, 5).map((c: any) => (
                    <Link key={c._id} to="/messages" className="flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{c.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{c.lastMessagePreview || "No messages"}</p>
                      </div>
                      {c.unread > 0 && (
                        <Badge className="bg-electric/10 text-electric border-electric/20 text-[10px]">{c.unread}</Badge>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Recent Documents">
            {(documents ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No documents uploaded.</p>
            ) : (
              <div className="space-y-1.5">
                {(documents ?? []).slice(0, 5).map((d: any) => (
                  <div key={d._id} className="flex items-center justify-between rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.fileName}</p>
                        <p className="text-[11px] text-muted-foreground">{d.type} · {fmtRelative(d._creationTime)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="loads" className="space-y-4">
          <SectionCard title="Active Loads">
            {activeLoads.length === 0 ? (
              <EmptyState icon={<Package className="size-5" />} title="No active loads" description="All loads are completed or cancelled." />
            ) : (
              <div className="space-y-1.5">
                {activeLoads.map((l: LoadType) => (
                  <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{l.loadNumber}</p>
                      <p className="text-[11px] text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                      <p className="text-[11px] text-muted-foreground">Pickup: {fmtDate(l.pickupDate, tz)} · Delivery: {fmtDate(l.deliveryDate, tz)}</p>
                    </div>
                    <StatusBadge status={l.status} />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Trucks">
              {(trucks ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">No trucks registered.</p>
              ) : (
                <div className="space-y-1.5">
                  {(trucks ?? []).map((t: TruckType) => (
                    <div key={t._id} className="flex items-center justify-between rounded-lg px-2.5 py-2.5 border border-border/30">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{t.unitNumber}</p>
                        <p className="text-[11px] text-muted-foreground">{t.type ?? "—"} · {t.currentLocation ?? "No location"}</p>
                      </div>
                      <StatusBadge status={t.availability} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title="Drivers">
              {(drivers ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">No drivers registered.</p>
              ) : (
                <div className="space-y-1.5">
                  {(drivers ?? []).map((d: DriverType) => (
                    <div key={d._id} className="flex items-center justify-between rounded-lg px-2.5 py-2.5 border border-border/30">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{d.name}</p>
                        <p className="text-[11px] text-muted-foreground">{d.currentLocation ?? "No location"}</p>
                      </div>
                      <StatusBadge status={d.availability} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="location" className="space-y-4">
          <SectionCard title="Truck Locations" description={`${truckLocations?.length ?? 0} truck with GPS`}>
            <div className="relative">
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
                height="h-96"
              />
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <AIAssistant
            title="Carrier Assistant"
            description="Ask about your trucks, loads, and deliveries"
            suggestedQuestions={["Where is my truck?", "What is my load status?", "When is pickup?", "When is delivery?", "Is POD uploaded?", "Show completed loads"]}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <SectionCard title="Documents">
            {(documents ?? []).length === 0 ? (
              <EmptyState icon={<FileText className="size-5" />} title="No documents" description="Documents will appear here as they are uploaded." />
            ) : (
              <div className="space-y-1.5">
                {(documents ?? []).map((d: any) => (
                  <div key={d._id} className="flex items-center justify-between rounded-lg px-2.5 py-2.5 border border-border/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.fileName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {d.type} · {fmtRelative(d._creationTime)} · {d.uploadedByName ?? "Unknown"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
