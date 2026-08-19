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
const Drivers = lazy(() => import("./pages/Drivers.tsx"));
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
const UserManagement = lazy(() => import("./pages/UserManagement.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
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

const Protected = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <AppShell />;
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
                <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                <Route path="/leads" element={<Protected><Leads /></Protected>} />
                <Route path="/carriers" element={<Protected><Carriers /></Protected>} />
                <Route path="/carriers/:id" element={<Protected><CarrierDetail /></Protected>} />
                <Route path="/trucks" element={<Protected><Trucks /></Protected>} />
                <Route path="/drivers" element={<Protected><Drivers /></Protected>} />
                <Route path="/brokers" element={<Protected><Brokers /></Protected>} />
                <Route path="/shippers" element={<Protected><Shippers /></Protected>} />
                <Route path="/loads" element={<Protected><Loads /></Protected>} />
                <Route path="/loads/:id" element={<Protected><LoadDetail /></Protected>} />
                <Route path="/messages" element={<Protected><Messages /></Protected>} />
                <Route path="/documents" element={<Protected><Documents /></Protected>} />
                <Route path="/tasks" element={<Protected><Tasks /></Protected>} />
                <Route path="/calendar" element={<Protected><Calendar /></Protected>} />
                <Route path="/finance" element={<Protected><Finance /></Protected>} />
                <Route path="/reports" element={<Protected><Reports /></Protected>} />
                <Route path="/assistant" element={<Protected><Assistant /></Protected>} />
                <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
                <Route path="/integrations" element={<Protected><Integrations /></Protected>} />
                <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
                <Route path="/users" element={<Protected><UserManagement /></Protected>} />
                <Route path="/audit" element={<Protected><AuditLog /></Protected>} />
                <Route path="/portal/driver" element={<Protected><PortalDriver /></Protected>} />
                <Route path="/portal/carrier" element={<Protected><PortalCarrier /></Protected>} />
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
