import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { nextAction, statusClass, toneClass, type NextAction } from "@/lib/status";
import { AlertTriangle, ArrowRight, CheckCircle2, Inbox, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card — premium
// ---------------------------------------------------------------------------
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "accent";
}) {
  const tones = {
    default: "text-foreground",
    good: "text-[#22C55E]",
    warn: "text-[#F5A623]",
    bad: "text-destructive",
    accent: "text-primary",
  };
  return (
    <Card className="border-border/50 bg-card shadow-none card-hover">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          {icon && (
            <div className={cn("flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary")}>
              {icon}
            </div>
          )}
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <p className={cn("mt-2.5 text-2xl font-bold tracking-tight tabular-nums", tones[tone])}>{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status badge — premium
// ---------------------------------------------------------------------------
export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return null;
  return <Badge variant="outline" className={cn("font-medium text-[11px] rounded-full", statusClass(status), className)}>{status}</Badge>;
}

export function NextActionPill({ action }: { action: NextAction }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        toneClass(action.tone),
      )}
    >
      <ArrowRight className="size-3" />
      {action.label}
    </span>
  );
}

export function useNextAction(type: string, record: Parameters<typeof nextAction>[1]): NextAction {
  return nextAction(type, record);
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
export function Money({ cents, currency, className }: { cents: number | null | undefined; currency?: string; className?: string }) {
  return <span className={cn("tabular-nums font-semibold", className)}>{formatMoney(cents, currency)}</span>;
}

// ---------------------------------------------------------------------------
// Key/value row
// ---------------------------------------------------------------------------
export function KV({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / empty / error states — premium
// ---------------------------------------------------------------------------
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
      <Spinner className="size-5 text-primary" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = <Inbox className="size-5" />,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
      <AlertTriangle className="size-5 text-destructive" />
      <p className="text-sm font-semibold">Something went wrong</p>
      <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}

export function QueryState<T>({
  data,
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  empty?: ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error instanceof Error ? error.message : "Request failed."} onRetry={onRetry} />;
  if (data === undefined || data === null) return <LoadingState />;
  if (empty !== undefined && (Array.isArray(data) ? data.length === 0 : false)) return <>{empty}</>;
  return <>{children(data)}</>;
}

// ---------------------------------------------------------------------------
// Section card — premium
// ---------------------------------------------------------------------------
export function SectionCard({ title, description, actions, children, className }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("border-border/50 bg-card shadow-none", className)}>
      {(title || actions) && (
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 px-4 pt-4">
          <div>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
            {description && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{description}</p>}
          </div>
          {actions}
        </CardHeader>
      )}
      <CardContent className={cn(title && "pt-0", "px-4 pb-4")}>{children}</CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Confirm button (destructive actions)
// ---------------------------------------------------------------------------
export function ConfirmButton({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  variant = "destructive",
  size,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: "destructive" | "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "lg";
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Query error hook helper
// ---------------------------------------------------------------------------
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  return "An unexpected error occurred.";
}

export { Loader2, XCircle, CheckCircle2 };
