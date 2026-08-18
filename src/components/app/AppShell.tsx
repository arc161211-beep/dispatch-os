import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useRole, canWriteRole } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Factory,
  FileText,
  Handshake,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Package,
  Plug,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Sun,
  Truck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

function useNavItems() {
  const role = useRole();
  if (role === "driver") {
    return {
      groups: [
        {
          title: "My Work",
          items: [
            { to: "/portal/driver", label: "Driver Portal", icon: LayoutDashboard, end: true },
            { to: "/loads", label: "My Loads", icon: Package },
            { to: "/messages", label: "Messages", icon: MessageSquare },
            { to: "/documents", label: "Documents", icon: FileText },
          ] as NavItem[],
        },
      ],
      canWrite: false,
    };
  }
  if (role === "carrier_admin") {
    return {
      groups: [
        {
          title: "Overview",
          items: [{ to: "/portal/carrier", label: "Carrier Dashboard", icon: LayoutDashboard, end: true }] as NavItem[],
        },
        {
          title: "Operations",
          items: [
            { to: "/loads", label: "Loads", icon: Package },
            { to: "/trucks", label: "Trucks", icon: Truck },
            { to: "/drivers", label: "Drivers", icon: UserRound },
          ] as NavItem[],
        },
        {
          title: "Communication",
          items: [
            { to: "/documents", label: "Documents", icon: FileText },
            { to: "/messages", label: "Messages", icon: MessageSquare },
            { to: "/tasks", label: "Tasks", icon: ListTodo },
            { to: "/calendar", label: "Calendar", icon: CalendarDays },
          ] as NavItem[],
        },
        {
          title: "Business",
          items: [{ to: "/finance", label: "Finance", icon: Wallet }] as NavItem[],
        },
      ],
      canWrite: false,
    };
  }
  return {
    groups: [
      {
        title: "Overview",
        items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }] as NavItem[],
      },
      {
        title: "Operations",
        items: [
          { to: "/leads", label: "Leads", icon: Users },
          { to: "/carriers", label: "Carriers", icon: Building2 },
          { to: "/trucks", label: "Trucks", icon: Truck },
          { to: "/drivers", label: "Drivers", icon: UserRound },
          { to: "/loads", label: "Loads", icon: Package },
          { to: "/brokers", label: "Brokers", icon: Handshake },
          { to: "/shippers", label: "Shippers", icon: Factory },
        ] as NavItem[],
      },
      {
        title: "Communication",
        items: [
          { to: "/messages", label: "Messages", icon: MessageSquare },
          { to: "/documents", label: "Documents", icon: FileText },
          { to: "/tasks", label: "Tasks", icon: ListTodo },
          { to: "/calendar", label: "Calendar", icon: CalendarDays },
        ] as NavItem[],
      },
      {
        title: "Business",
        items: [
          { to: "/finance", label: "Finance", icon: Wallet },
          { to: "/reports", label: "Reports", icon: BarChart3 },
        ] as NavItem[],
      },
      {
        title: "Intelligence",
        items: [{ to: "/assistant", label: "AI Assistant", icon: Sparkles }] as NavItem[],
      },
      {
        title: "System",
        items: [
          { to: "/notifications", label: "Notifications", icon: Bell },
          { to: "/integrations", label: "Integrations", icon: Plug },
          { to: "/settings", label: "Settings", icon: Settings },
          { to: "/audit", label: "Audit Log", icon: ScrollText },
        ] as NavItem[],
      },
    ],
    canWrite: canWriteRole(role),
  };
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function SettingUp() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Setting up your workspace…
      </div>
    </main>
  );
}

export function AppShell() {
  const { isLoading, user, signOut } = useAuth();
  const provision = useMutation(api.users.provision);
  const navigate = useNavigate();
  const role = useRole();
  const unread = useQuery(api.notifications.unreadCount);
  const settings = useQuery(api.settings.get);
  const { theme, setTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (user && !user.orgId && !provisioning) {
      setProvisioning(true);
      provision()
        .catch((e) => console.error("Provision failed:", e))
        .finally(() => setProvisioning(false));
    }
  }, [user, provision, provisioning]);

  const { groups, canWrite } = useNavItems();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (isLoading || (user && !user.orgId) || provisioning) return <SettingUp />;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const demoMode = settings?.settings?.demoMode;

  return (
    <div className="flex min-h-screen bg-background">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} canWrite={canWrite} />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">D</div>
          <span className="text-sm font-semibold tracking-tight">DispatchOS</span>
          {demoMode && (
            <Badge variant="outline" className="ml-auto bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent">Demo</Badge>
          )}
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g.title}</p>
              <NavList items={g.items} />
            </div>
          ))}
        </div>
        <div className="border-t p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name ?? "User"}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{role?.replace("_", " ")}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="flex items-center gap-2 text-left">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">D</span>
                  DispatchOS
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5 overflow-y-auto p-3">
                {groups.map((g) => (
                  <div key={g.title}>
                    <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g.title}</p>
                    <NavList items={g.items} onNavigate={() => setMobileNavOpen(false)} />
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/70"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search or jump to…</span>
            <span className="ml-auto hidden items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
              ⌘K
            </span>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")} aria-label="Notifications">
              <Bell className="size-4" />
              {(unread ?? 0) > 0 && (
                <span className="absolute mt-[-18px] ml-[18px] flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                  {Math.min(unread ?? 0, 9)}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user?.name ?? "User"}</p>
                  <p className="text-xs font-normal capitalize text-muted-foreground">{role?.replace("_", " ")}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/integrations")}>Integrations</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Demo banner */}
        {demoMode && (
          <div className="border-b bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-300">
            Demo data loaded — these records are marked as demo and can be cleared in Settings.
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
