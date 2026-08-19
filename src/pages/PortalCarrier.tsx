import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { PageHeader, StatCard, SectionCard, StatusBadge, Money, EmptyState, errorMessage } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Clock,
  Navigation,
  Activity,
  ChevronRight,
  Share2,
  Loader2,
  Sparkles,
} from "lucide-react";

type LoadType = any;
type TruckType = any;
type DriverType = any;
type MessageType = any;

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
  const updateTruckLocation = useMutation(api.location.updateTruckLocation);

  const activeLoads = (loads ?? []).filter((l: LoadType) => !["Completed", "Cancelled"].includes(l.status));
  const completedLoads = (loads ?? []).filter((l: LoadType) => l.status === "Completed");
  const availableTrucks = (trucks ?? []).filter((t: TruckType) => t.availability === "Available");
  const activeDrivers = (drivers ?? []).filter((d: DriverType) => d.availability !== "Off Duty" && d.availability !== "Unavailable");
  const outstanding = (invoices ?? []).reduce((sum: number, i: any) => sum + (i.amountCents - i.paidCents), 0);
  const urgentMessages = (conversations ?? []).filter((c: any) => c.urgent > 0);
  const currentLoad = activeLoads.find((l: LoadType) =>
    ["In Transit", "At Delivery", "Loaded", "At Pickup", "Loading"].includes(l.status),
  );

  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome, {user?.name ?? "Carrier"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your operations at a glance — {fmtDate(Date.now(), tz)}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Loads" value={activeLoads.length} icon={<Package className="size-4" />} />
        <StatCard label="Trucks Available" value={availableTrucks.length} sub={`${trucks?.length ?? 0} total`} icon={<Truck className="size-4" />} />
        <StatCard label="Active Drivers" value={activeDrivers.length} sub={`${drivers?.length ?? 0} total`} icon={<UserRound className="size-4" />} />
        <StatCard label="Outstanding" value={<Money cents={outstanding} />} tone={outstanding > 0 ? "warn" : "good"} icon={<Wallet className="size-4" />} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loads">Loads ({activeLoads.length})</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="location">Map</TabsTrigger>
          <TabsTrigger value="documents">Docs</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="size-3.5 mr-1" /> AI</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          {/* Current load highlight */}
          {currentLoad && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Load</p>
                  <StatusBadge status={currentLoad.status} />
                </div>
                <Link to={`/loads/${currentLoad._id}`} className="text-lg font-semibold hover:underline">
                  {currentLoad.loadNumber}
                </Link>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{currentLoad.origin ?? "?"}</span>
                  <span>→</span>
                  <span>{currentLoad.destination ?? "?"}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Upcoming pickups/deliveries */}
            <SectionCard title="Upcoming Activity">
              {activeLoads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No active loads.</p>
              ) : (
                <div className="divide-y">
                  {activeLoads.slice(0, 5).map((l: LoadType) => (
                    <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between py-2.5 hover:bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{l.loadNumber}</p>
                        <p className="text-xs text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={l.status} />
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Messages */}
            <SectionCard
              title="Messages"
              actions={urgentMessages.length > 0 ? (
                <Badge className="bg-red-500/10 text-red-600 border-transparent">{urgentMessages.length} urgent</Badge>
              ) : undefined}
            >
              {(conversations ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No messages yet.</p>
              ) : (
                <div className="divide-y">
                  {(conversations ?? []).slice(0, 5).map((c: any) => (
                    <Link key={c._id} to="/messages" className="flex items-center justify-between py-2.5 hover:bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.lastMessagePreview || "No messages"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.unread > 0 && (
                          <Badge className="bg-blue-500/10 text-blue-600 border-transparent text-[10px]">{c.unread}</Badge>
                        )}
                        {c.urgent > 0 && (
                          <Badge className="bg-red-500/10 text-red-600 border-transparent text-[10px]">{c.urgent} urgent</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Recent documents */}
          <SectionCard title="Recent Documents">
            {(documents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No documents uploaded.</p>
            ) : (
              <div className="divide-y">
                {(documents ?? []).slice(0, 5).map((d: any) => (
                  <div key={d._id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.fileName}</p>
                        <p className="text-xs text-muted-foreground">{d.type} · {fmtRelative(d._creationTime)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Loads */}
        <TabsContent value="loads" className="space-y-4">
          <SectionCard title="Active Loads">
            {activeLoads.length === 0 ? (
              <EmptyState icon={<Package className="size-6" />} title="No active loads" description="All loads are completed or cancelled." />
            ) : (
              <div className="divide-y">
                {activeLoads.map((l: LoadType) => (
                  <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between py-3 hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{l.loadNumber}</p>
                      <p className="text-xs text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                      <p className="text-xs text-muted-foreground">Pickup: {fmtDate(l.pickupDate, tz)} · Delivery: {fmtDate(l.deliveryDate, tz)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={l.status} />
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
          {completedLoads.length > 0 && (
            <SectionCard title={`Completed (${completedLoads.length})`}>
              <div className="divide-y">
                {completedLoads.slice(0, 10).map((l: LoadType) => (
                  <Link key={l._id} to={`/loads/${l._id}`} className="flex items-center justify-between py-2.5 hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{l.loadNumber}</p>
                      <p className="text-xs text-muted-foreground">{l.origin ?? "?"} → {l.destination ?? "?"}</p>
                    </div>
                    <StatusBadge status={l.status} />
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}
        </TabsContent>

        {/* Fleet */}
        <TabsContent value="fleet" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Trucks">
              {(trucks ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No trucks registered.</p>
              ) : (
                <div className="divide-y">
                  {(trucks ?? []).map((t: TruckType) => (
                    <div key={t._id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.unitNumber}</p>
                        <p className="text-xs text-muted-foreground">{t.type ?? "—"} · {t.currentLocation ?? "No location"}</p>
                        {t.lat !== undefined && t.lon !== undefined && (
                          <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                            <MapPin className="size-3" /> {t.lat.toFixed(4)}, {t.lon.toFixed(4)}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={t.availability} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Drivers">
              {(drivers ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No drivers registered.</p>
              ) : (
                <div className="divide-y">
                  {(drivers ?? []).map((d: DriverType) => (
                    <div key={d._id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.currentLocation ?? "No location"}</p>
                      </div>
                      <StatusBadge status={d.availability} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        {/* Map */}
        <TabsContent value="location" className="space-y-4">
          <SectionCard title="Truck Locations" description="Current positions of your trucks">
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
          </SectionCard>
        </TabsContent>

        {/* AI Assistant */}
        <TabsContent value="ai" className="space-y-4">
          <AIAssistant
            title="Carrier Assistant"
            description="Ask about your trucks, loads, and deliveries"
            suggestedQuestions={["Where is my truck?", "What is my load status?", "When is pickup?", "When is delivery?", "Is POD uploaded?", "Show completed loads"]}
          />
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="space-y-4">
          <SectionCard title="Documents">
            {(documents ?? []).length === 0 ? (
              <EmptyState
                icon={<FileText className="size-6" />}
                title="No documents"
                description="Documents will appear here as they are uploaded."
              />
            ) : (
              <div className="divide-y">
                {(documents ?? []).map((d: any) => (
                  <div key={d._id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.type} · {fmtRelative(d._creationTime)} · Uploaded by {d.uploadedByName ?? "Unknown"}
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
