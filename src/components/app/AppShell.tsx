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
import { Logo } from "@/components/brand/Logo";
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
  Activity,
  Sun,
  Truck,
  UserRound,
  Users,
  UserCog,
  Wallet,
  ChevronLeft,
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
          { to: "/users", label: "Users", icon: UserCog },
          { to: "/integrations", label: "Integrations", icon: Plug },
          { to: "/settings", label: "Settings", icon: Settings },
          { to: "/audit", label: "Audit Log", icon: ScrollText },
          { to: "/status", label: "Status", icon: Activity },
        ] as NavItem[],
      },
    ],
    canWrite: canWriteRole(role),
  };
}

function NavList({ items, onNavigate, collapsed }: { items: NavItem[]; onNavigate?: () => void; collapsed?: boolean }) {
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
              "relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150",
              collapsed && "justify-center px-2",
              isActive
                ? "nav-active-rail bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/90",
            )
          }
          title={collapsed ? item.label : undefined}
        >
          <item.icon className="size-4 shrink-0" />
          {!collapsed && item.label}
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
  const [collapsed, setCollapsed] = useState(false);

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

      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:flex",
          collapsed ? "w-[60px]" : "w-56",
        )}
      >
        {/* Logo */}
        <div className={cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
          {collapsed ? (
            <div className="flex size-8 items-center justify-center rounded-lg bg-electric/10">
              <svg className="size-5 text-electric" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7v6c0 5.55 4.27 10.74 10 12 5.73-1.26 10-6.45 10-12V7L12 2z" />
              </svg>
            </div>
          ) : (
            <Logo size="sm" variant="full" />
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
          {groups.map((g) => (
            <div key={g.title}>
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                  {g.title}
                </p>
              )}
              <NavList items={g.items} collapsed={collapsed} />
            </div>
          ))}
        </div>

        {/* Collapse + User */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70"
          >
            <ChevronLeft className={cn("size-4 transition-transform duration-200", collapsed && "rotate-180")} />
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <Avatar className="size-7">
                <AvatarFallback className="bg-electric/10 text-electric text-[10px] font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-sidebar-foreground">{user?.name ?? "User"}</p>
                <p className="truncate text-[10px] capitalize text-sidebar-foreground/50">{role?.replace("_", " ")}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl sm:px-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden size-8">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
              <SheetHeader className="border-b border-sidebar-border px-4 py-3">
                <SheetTitle className="flex items-center gap-2 text-left">
                  <Logo size="sm" variant="full" />
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 overflow-y-auto p-3">
                {groups.map((g) => (
                  <div key={g.title}>
                    <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                      {g.title}
                    </p>
                    <NavList items={g.items} onNavigate={() => setMobileNavOpen(false)} />
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Search */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 text-xs text-muted-foreground transition-all duration-150 hover:border-border hover:bg-muted/50"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="ml-auto hidden rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 sm:inline">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/notifications")}
              aria-label="Notifications"
              className="relative size-8"
            >
              <Bell className="size-4" />
              {(unread ?? 0) > 0 && (
                <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white">
                  {Math.min(unread ?? 0, 9)}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="size-8"
            >
              {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full size-8" aria-label="Account">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-electric/10 text-electric text-[9px] font-bold">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{user?.name ?? "User"}</p>
                  <p className="text-xs font-normal capitalize text-muted-foreground">{role?.replace("_", " ")}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/integrations")}>Integrations</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 size-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Demo banner */}
        {demoMode && (
          <div className="border-b border-[#F5A623]/20 bg-[#F5A623]/5 px-4 py-1.5 text-center text-[11px] font-semibold text-[#F5A623]">
            DEMO MODE — Test data loaded
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
