import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, StatCard, SectionCard, Money, LoadingState } from "@/components/app/shared";
import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function Reports() {
  const [tab, setTab] = useState<"operations" | "financial" | "crm" | "dispatcher">("operations");
  const ops = useQuery(api.reports.operations, {});
  const fin = useQuery(api.reports.financial, {});
  const crm = useQuery(api.reports.crm, {});
  const disp = useQuery(api.reports.dispatcher, {});

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Operational and financial analytics" />
      <div className="flex gap-2 flex-wrap">
        {(["operations", "financial", "crm", "dispatcher"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === "operations" && (ops === undefined ? <LoadingState /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Loads created" value={ops.loadsCreated} icon={<BarChart3 className="size-4" />} />
            <StatCard label="Completed" value={ops.completedLoads} tone="good" />
            <StatCard label="Completion rate" value={`${ops.completionRate}%`} />
            <StatCard label="Avg RPM" value={`$${ops.avgRpm.toFixed(2)}`} tone="accent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Loads by status">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(ops.byStatus).map(([status, count]) => ({ status, count }))}>
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Top lanes">
              {ops.topLanes.length === 0 ? <p className="text-sm text-muted-foreground py-2">No lane data yet.</p> : (
                <div className="space-y-2">
                  {ops.topLanes.map((l, i) => (
                    <div key={l.lane} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-4">{i + 1}.</span>
                      <span className="text-sm flex-1">{l.lane}</span>
                      <span className="text-sm text-muted-foreground">{l.count} loads</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      ))}

      {tab === "financial" && (fin === undefined ? <LoadingState /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Gross revenue" value={<Money cents={fin.grossLoadRevenueCents} />} icon={<DollarSign className="size-4" />} />
            <StatCard label="Dispatcher revenue" value={<Money cents={fin.dispatcherRevenueCents} />} tone="accent" />
            <StatCard label="Paid" value={<Money cents={fin.paidCents} />} tone="good" />
            <StatCard label="Unpaid" value={<Money cents={fin.unpaidCents} />} tone={fin.unpaidCents > 0 ? "warn" : "good"} />
            <StatCard label="Overdue" value={<Money cents={fin.overdueCents} />} tone={fin.overdueCents > 0 ? "bad" : "default"} />
          </div>
          <SectionCard title="Invoices by status">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={Object.entries(fin.invoiceByStatus).map(([status, count]) => ({ name: status, value: count }))} cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {Object.entries(fin.invoiceByStatus).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      ))}

      {tab === "crm" && (crm === undefined ? <LoadingState /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total leads" value={crm.totalLeads} icon={<Users className="size-4" />} />
            <StatCard label="Converted" value={crm.converted} tone="good" />
            <StatCard label="Conversion rate" value={`${crm.conversionRate}%`} tone="accent" />
            <StatCard label="Active clients" value={crm.activeClients} tone="good" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Leads by status">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(crm.leadsByStatus).map(([status, count]) => ({ status, count }))}>
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Leads by source">
              <div className="space-y-2">
                {Object.entries(crm.leadsBySource).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                  <div key={source} className="flex items-center gap-3">
                    <span className="text-sm flex-1">{source}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      ))}

      {tab === "dispatcher" && (disp === undefined ? <LoadingState /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Loads booked" value={disp.loadsBooked} icon={<TrendingUp className="size-4" />} />
            <StatCard label="Completed" value={disp.loadsCompleted} tone="good" />
            <StatCard label="Avg load value" value={<Money cents={disp.avgLoadValueCents} />} />
            <StatCard label="Dispatcher revenue" value={<Money cents={disp.dispatcherRevenueCents} />} tone="accent" />
          </div>
          <SectionCard title="Loads per carrier">
            {disp.loadsPerCarrier.length === 0 ? <p className="text-sm text-muted-foreground py-2">No carrier data yet.</p> : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disp.loadsPerCarrier.slice(0, 10)}>
                    <XAxis dataKey="carrierName" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="loads" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>
      ))}
    </div>
  );
}
