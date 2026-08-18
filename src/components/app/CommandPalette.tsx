import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  FileText,
  Handshake,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Package,
  Plug,
  Plus,
  ScrollText,
  Settings,
  Sparkles,
  Truck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export function CommandPalette({ open, onOpenChange, canWrite }: { open: boolean; onOpenChange: (v: boolean) => void; canWrite: boolean }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const results = useQuery(api.search.globalSearch, debounced.trim().length >= 2 ? { term: debounced.trim() } : "skip");

  const go = (to: string) => {
    onOpenChange(false);
    setTerm("");
    navigate(to);
  };

  const navCommands = [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Leads", to: "/leads", icon: Users },
    { label: "Carriers", to: "/carriers", icon: Building2 },
    { label: "Trucks", to: "/trucks", icon: Truck },
    { label: "Drivers", to: "/drivers", icon: UserRound },
    { label: "Loads", to: "/loads", icon: Package },
    { label: "Brokers", to: "/brokers", icon: Handshake },
    { label: "Messages", to: "/messages", icon: MessageSquare },
    { label: "Documents", to: "/documents", icon: FileText },
    { label: "Tasks", to: "/tasks", icon: ListTodo },
    { label: "Calendar", to: "/calendar", icon: CalendarDays },
    { label: "Finance", to: "/finance", icon: Wallet },
    { label: "Reports", to: "/reports", icon: BarChart3 },
    { label: "AI Assistant", to: "/assistant", icon: Sparkles },
    { label: "Notifications", to: "/notifications", icon: Bell },
    { label: "Integrations", to: "/integrations", icon: Plug },
    { label: "Settings", to: "/settings", icon: Settings },
    { label: "Audit Log", to: "/audit", icon: ScrollText },
  ];

  const newCommands = [
    { label: "New Lead", to: "/leads?new=1", icon: Plus },
    { label: "New Carrier", to: "/carriers?new=1", icon: Plus },
    { label: "New Truck", to: "/trucks?new=1", icon: Plus },
    { label: "New Driver", to: "/drivers?new=1", icon: Plus },
    { label: "New Broker", to: "/brokers?new=1", icon: Plus },
    { label: "New Load", to: "/loads?new=1", icon: Plus },
    { label: "Create Task", to: "/tasks?new=1", icon: Plus },
  ];

  return (
    <CommandDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTerm(""); }}>
      <CommandInput placeholder="Search or type a command…" value={term} onValueChange={setTerm} />
      <CommandList>
        <CommandEmpty>{debounced.trim().length >= 2 ? "No results found." : "Type to search across carriers, loads, brokers, invoices…"}</CommandEmpty>

        {results && results.length > 0 && (
          <>
            <CommandGroup heading="Search results">
              {results.map((r, i) => (
                <CommandItem key={`${r.type}-${r.id}-${i}`} onSelect={() => go(r.route)}>
                  <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{r.type}</span>
                  <span className="truncate">{r.label}</span>
                  {r.sub && <span className="ml-auto truncate text-xs text-muted-foreground">{r.sub}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigate">
          {navCommands.map((c) => (
            <CommandItem key={c.to} onSelect={() => go(c.to)}>
              <c.icon className="size-4" />
              {c.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {canWrite && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Create">
              {newCommands.map((c) => (
                <CommandItem key={c.to} onSelect={() => go(c.to)}>
                  <c.icon className="size-4" />
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
      {debounced.trim().length >= 2 && results === undefined && (
        <div className="flex items-center justify-center gap-2 border-t py-2 text-xs text-muted-foreground">
          <Spinner className="size-3" /> Searching…
        </div>
      )}
    </CommandDialog>
  );
}
