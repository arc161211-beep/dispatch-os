import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app/AppShell";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { useRole } from "@/hooks/use-app";
import { authorizePath } from "@/lib/roles";
import { ThemeProvider } from "next-themes";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Leads = lazy(() => import("./pages/Leads.tsx"));
const Carriers = lazy(() => import("./pages/Carriers.tsx"));
const CarrierDetail = lazy(() => import("./pages/CarrierDetail.tsx"));
const Trucks = lazy(() => import("./pages/Trucks.tsx"));
const TruckDetail = lazy(() => import("./pages/TruckDetail.tsx"));
const Drivers = lazy(() => import("./pages/Drivers.tsx"));
const DriverDetail = lazy(() => import("./pages/DriverDetail.tsx"));
const Brokers = lazy(() => import("./pages/Brokers.tsx"));
const Shippers = lazy(() => import("./pages/Shippers.tsx"));
const Loads = lazy(() => import("./pages/Loads.tsx"));
const LoadDetail = lazy(() => import("./pages/LoadDetail.tsx"));
const Messages = lazy(() => import("./pages/Messages.tsx"));
const Documents = lazy(() => import("./pages/Documents.tsx"));
const Tasks = lazy(() => import("./pages/Tasks.tsx"));
const Calendar = lazy(() => import("./pages/Calendar.tsx"));
const Finance = lazy(() => import("./pages/Finance.tsx"));
const Reports = lazy(() => import("./pages/Reports.tsx"));
const Assistant = lazy(() => import("./pages/Assistant.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const Integrations = lazy(() => import("./pages/Integrations.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const AuditLog = lazy(() => import("./pages/AuditLog.tsx"));
const PortalDriver = lazy(() => import("./pages/PortalDriver.tsx"));
const PortalCarrier = lazy(() => import("./pages/PortalCarrier.tsx"));
const TrackingPage = lazy(() => import("./pages/TrackingPage.tsx"));
const UserManagement = lazy(() => import("./pages/UserManagement.tsx"));
const StatusPage = lazy(() => import("./pages/Status.tsx"));
const TruckMapPage = lazy(() => import("./pages/TruckMapPage.tsx"));
const LoadBoardPage = lazy(() => import("./pages/LoadBoard.tsx"));

// Premium loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="relative mb-4">
        <div className="size-8 rounded-full border-2 border-[#4F8CFF]/20 border-t-[#4F8CFF] animate-spin" />
      </div>
      <p className="text-xs font-medium text-muted-foreground animate-pulse">Loading…</p>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/**
 * Protected route: requires authentication + valid Convex session.
 * AppInit inside AppShell handles workspace provisioning.
 */
const Protected = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <AppShell>{children}</AppShell>;
};

/**
 * Role-gated route: after AppShell has provisioned the user, checks that
 * the authenticated user's role is authorized for this specific path.
 * If not, redirects to the role's canonical destination.
 */
const RoleGate = ({ children }: { children: React.ReactNode }) => {
  const role = useRole();
  const location = useLocation();
  // role may be undefined while AppInit is still provisioning
  if (!role) return null;
  const redirectTo = authorizePath(location.pathname, role);
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <BrowserRouter>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
                {/* Note: No public signup route — access is invite-only */}
                {/* ── Admin / Dispatcher / Operations routes ── */}
                <Route path="/dashboard" element={<Protected><RoleGate><Dashboard /></RoleGate></Protected>} />
                <Route path="/leads" element={<Protected><RoleGate><Leads /></RoleGate></Protected>} />
                <Route path="/carriers" element={<Protected><RoleGate><Carriers /></RoleGate></Protected>} />
                <Route path="/carriers/:id" element={<Protected><RoleGate><CarrierDetail /></RoleGate></Protected>} />
                <Route path="/trucks" element={<Protected><RoleGate><Trucks /></RoleGate></Protected>} />
                <Route path="/truck-map" element={<Protected><RoleGate><TruckMapPage /></RoleGate></Protected>} />
                <Route path="/load-board" element={<Protected><RoleGate><LoadBoardPage /></RoleGate></Protected>} />
                <Route path="/trucks/:id" element={<Protected><RoleGate><TruckDetail /></RoleGate></Protected>} />
                <Route path="/drivers" element={<Protected><RoleGate><Drivers /></RoleGate></Protected>} />
                <Route path="/drivers/:id" element={<Protected><RoleGate><DriverDetail /></RoleGate></Protected>} />
                <Route path="/brokers" element={<Protected><RoleGate><Brokers /></RoleGate></Protected>} />
                <Route path="/shippers" element={<Protected><RoleGate><Shippers /></RoleGate></Protected>} />
                <Route path="/loads" element={<Protected><RoleGate><Loads /></RoleGate></Protected>} />
                <Route path="/loads/:id" element={<Protected><RoleGate><LoadDetail /></RoleGate></Protected>} />
                <Route path="/messages" element={<Protected><RoleGate><Messages /></RoleGate></Protected>} />
                <Route path="/documents" element={<Protected><RoleGate><Documents /></RoleGate></Protected>} />
                <Route path="/tasks" element={<Protected><RoleGate><Tasks /></RoleGate></Protected>} />
                <Route path="/calendar" element={<Protected><RoleGate><Calendar /></RoleGate></Protected>} />
                <Route path="/finance" element={<Protected><RoleGate><Finance /></RoleGate></Protected>} />
                <Route path="/reports" element={<Protected><RoleGate><Reports /></RoleGate></Protected>} />
                <Route path="/assistant" element={<Protected><RoleGate><Assistant /></RoleGate></Protected>} />
                <Route path="/notifications" element={<Protected><RoleGate><Notifications /></RoleGate></Protected>} />
                <Route path="/integrations" element={<Protected><RoleGate><Integrations /></RoleGate></Protected>} />
                <Route path="/settings" element={<Protected><RoleGate><SettingsPage /></RoleGate></Protected>} />
                <Route path="/users" element={<Protected><RoleGate><UserManagement /></RoleGate></Protected>} />
                <Route path="/audit" element={<Protected><RoleGate><AuditLog /></RoleGate></Protected>} />
                <Route path="/status" element={<Protected><RoleGate><StatusPage /></RoleGate></Protected>} />
                {/* ── Driver portal (driver role only) ── */}
                <Route path="/portal/driver" element={<Protected><RoleGate><PortalDriver /></RoleGate></Protected>} />
                {/* ── Carrier portal (carrier_admin role only) ── */}
                <Route path="/portal/carrier" element={<Protected><RoleGate><PortalCarrier /></RoleGate></Protected>} />
                <Route path="/track/:token" element={<TrackingPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </ThemeProvider>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
