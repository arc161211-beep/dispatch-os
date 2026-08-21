import { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================================
// Premium KPI Card
// ============================================================
interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  subtitle?: string;
  trend?: { value: number; label: string };
  href?: string;
  className?: string;
  accent?: "blue" | "gold" | "green" | "red";
}

const accentMap = {
  blue: "bg-electric/10 text-electric",
  gold: "bg-[#F5A623]/10 text-[#F5A623]",
  green: "bg-[#22C55E]/10 text-[#22C55E]",
  red: "bg-destructive/10 text-destructive",
};

export function KpiCard({ icon, label, value, subtitle, trend, className, accent = "blue" }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative rounded-xl border border-border/60 bg-card p-4 transition-all duration-200",
        "hover:border-border hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]",
        "dark:hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("flex size-9 items-center justify-center rounded-lg", accentMap[accent])}>
          {icon}
        </div>
        {trend && (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              trend.value >= 0 ? "text-[#22C55E]" : "text-destructive",
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
        {subtitle && <p className="mt-1 text-[11px] text-muted-foreground/70">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

// ============================================================
// Premium Section Header
// ============================================================
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ============================================================
// Premium Status Badge
// ============================================================
interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

const statusColors: Record<string, string> = {
  Active: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20",
  Available: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20",
  Completed: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20",
  Paid: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20",
  "In Transit": "bg-electric/10 text-electric border-electric/20",
  "At Pickup": "bg-electric/10 text-electric border-electric/20",
  Loading: "bg-electric/10 text-electric border-electric/20",
  Loaded: "bg-electric/10 text-electric border-electric/20",
  Booked: "bg-electric/10 text-electric border-electric/20",
  "Driver Notified": "bg-electric/10 text-electric border-electric/20",
  "At Delivery": "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20",
  Delivered: "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20",
  "POD Pending": "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  Draft: "bg-muted text-muted-foreground border-border",
  Offered: "bg-muted text-muted-foreground border-border",
  Suspended: "bg-destructive/10 text-destructive border-destructive/20",
  Cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  Expired: "bg-destructive/10 text-destructive border-destructive/20",
  Overdue: "bg-destructive/10 text-destructive border-destructive/20",
  Disputed: "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  "Out of Service": "bg-muted text-muted-foreground border-border",
  Maintenance: "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  "On Leave": "bg-muted text-muted-foreground border-border",
  "Off Duty": "bg-muted text-muted-foreground border-border",
  "On Load": "bg-electric/10 text-electric border-electric/20",
  Prospect: "bg-muted text-muted-foreground border-border",
  Inactive: "bg-muted text-muted-foreground border-border",
  "Under Review": "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  New: "bg-electric/10 text-electric border-electric/20",
  "Expiring Soon": "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  active: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20",
  expiring: "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const color = statusColors[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        color,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      {status}
    </span>
  );
}

// ============================================================
// Premium Empty State
// ============================================================
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ============================================================
// Premium Page Header
// ============================================================
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, children, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-1", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// Animated number counter
// ============================================================
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  return (
    <motion.span
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      key={value}
    >
      {value.toLocaleString()}
    </motion.span>
  );
}

// ============================================================
// Attention item
// ============================================================
interface AttentionItemProps {
  icon: ReactNode;
  label: string;
  value: string;
  urgent?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AttentionItem({ icon, label, value, urgent, onClick, className }: AttentionItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-left transition-all duration-150",
        "hover:border-border hover:bg-card hover:shadow-sm",
        urgent && "border-destructive/20 bg-destructive/5",
        className,
      )}
    >
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{value}</p>
      </div>
    </button>
  );
}

// ============================================================
// Premium AI Insight card
// ============================================================
export function AiInsightCard({ configured, text, loading }: { configured: boolean; text?: string | null; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-electric/10">
          <svg className="size-3.5 text-electric" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dispatch Intelligence</span>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : !configured ? (
          <p className="text-xs text-muted-foreground">AI not configured. Add API keys in Settings → Integrations.</p>
        ) : text ? (
          <p className="text-sm leading-relaxed text-foreground/80">{text}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Ask the AI assistant for operational insights.</p>
        )}
      </div>
    </div>
  );
}
