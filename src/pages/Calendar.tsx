import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTimezone } from "@/hooks/use-app";
import { PageHeader, SectionCard, LoadingState, StatusBadge } from "@/components/app/shared";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Calendar() {
  const tz = useTimezone();
  const loads = useQuery(api.loads.list, { upcomingOnly: false });
  const tasks = useQuery(api.tasks.list, {});

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const items = useMemo(() => {
    const map: Record<number, { type: string; label: string; to: string; status: string }[]> = {};
    for (const l of (loads ?? [])) {
      if (l.pickupDate) {
        const d = new Date(l.pickupDate);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          map[day] = map[day] ?? [];
          map[day].push({ type: "pickup", label: `${l.loadNumber} pickup`, to: `/loads/${l._id}`, status: l.status });
        }
      }
      if (l.deliveryDate) {
        const d = new Date(l.deliveryDate);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          map[day] = map[day] ?? [];
          map[day].push({ type: "delivery", label: `${l.loadNumber} delivery`, to: `/loads/${l._id}`, status: l.status });
        }
      }
    }
    for (const t of (tasks ?? [])) {
      if (t.dueAt && t.status !== "Completed" && t.status !== "Cancelled") {
        const d = new Date(t.dueAt);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          map[day] = map[day] ?? [];
          map[day].push({ type: "task", label: t.title, to: "/tasks", status: t.status });
        }
      }
    }
    return map;
  }, [loads, tasks, year, month]);

  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(viewDate);

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Upcoming pickups, deliveries, and tasks"
        actions={<div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <span className="text-sm font-medium w-36 text-center">{monthName}</span>
          <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight className="size-4" /></Button>
        </div>} />
      {loads === undefined ? <LoadingState /> : (
        <div className="grid grid-cols-7 gap-px rounded-lg border bg-border overflow-hidden">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-muted/50 px-2 py-1.5 text-center text-xs font-semibold uppercase text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="bg-background min-h-24" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            const dayItems = items[day] ?? [];
            return (
              <div key={day} className={cn("bg-background min-h-24 p-1.5", isToday && "bg-primary/5")}>
                <p className={cn("text-xs font-medium mb-1", isToday ? "text-primary font-bold" : "text-muted-foreground")}>{day}</p>
                <div className="space-y-0.5">
                  {dayItems.slice(0, 3).map((item, idx) => (
                    <Link key={idx} to={item.to} className={cn("block rounded px-1 py-0.5 text-[10px] font-medium truncate", item.type === "pickup" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : item.type === "delivery" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
                      {item.label}
                    </Link>
                  ))}
                  {dayItems.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500" /> Pickup</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Delivery</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> Task</span>
      </div>
    </div>
  );
}
