import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, SectionCard, LoadingState } from "@/components/app/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { APP_VERSION, BUILD_DATE, APP_NAME } from "@/lib/version";
import { INTEGRATION_PROVIDERS } from "@/convex/constants";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Server,
  Database,
  Brain,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  CreditCard,
  FileSignature,
} from "lucide-react";

type IntegrationRecord = {
  key: string;
  label: string;
  envs: readonly string[];
  configured: boolean;
  config?: unknown;
  updatedAt?: number;
};

const ICON_MAP: Record<string, typeof Activity> = {
  ai: Brain,
  email: Mail,
  sms: MessageSquare,
  maps: MapPin,
  loadboard: Package,
  payments: CreditCard,
  storage: Database,
  signature: FileSignature,
};

export default function StatusPage() {
  const integrations = useQuery(api.integrations.getAll);
  const health = useQuery(api.health.health);
  const settings = useQuery(api.settings.get);

  if (integrations === undefined || health === undefined) return <LoadingState />;

  const integrationMap = new Map<string, IntegrationRecord>();
  for (const i of integrations ?? []) {
    integrationMap.set(i.key, i as IntegrationRecord);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Status"
        description={`${APP_NAME} v${APP_VERSION} · Built ${BUILD_DATE}`}
      />

      {/* Core Services */}
      <SectionCard title="Core Services" description="Infrastructure health checks">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceCard
            icon={<Server className="size-4" />}
            name="HTTP Router"
            configured={!!health?.ok}
          />
          <ServiceCard
            icon={<Database className="size-4" />}
            name="Database (Convex)"
            configured={!!health?.ok}
          />
          <ServiceCard
            icon={<Shield className="size-4" />}
            name="Authentication"
            configured={!!health?.ok}
          />
        </div>
      </SectionCard>

      {/* External Integrations */}
      <SectionCard title="External Integrations" description="Provider configuration status">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATION_PROVIDERS.map((provider) => {
            const record = integrationMap.get(provider.key);
            const configured = record?.configured ?? false;
            const Icon = ICON_MAP[provider.key] ?? Activity;
            return (
              <ServiceCard
                key={provider.key}
                icon={<Icon className="size-4" />}
                name={provider.label}
                configured={configured}
              />
            );
          })}
        </div>
      </SectionCard>

      {/* Application Info */}
      <SectionCard title="Application Information" description="Version and configuration details">
        <div className="space-y-3">
          <InfoRow label="Application" value={APP_NAME} />
          <InfoRow label="Version" value={APP_VERSION} />
          <InfoRow label="Build Date" value={BUILD_DATE} />
          <InfoRow label="Timezone" value={settings?.settings?.timezone ?? "Not configured"} />
          <InfoRow label="Currency" value={settings?.settings?.currency ?? "Not configured"} />
          <InfoRow label="Fee Model" value={settings?.settings?.feeDefaults?.feeType ?? "Not configured"} />
          <InfoRow label="Fee Rate" value={`${settings?.settings?.feeDefaults?.feeRatePercent ?? 0}%`} />
          <InfoRow label="Demo Mode" value={settings?.settings?.demoMode ? "Active" : "Inactive"} />
          <InfoRow label="Financial Visibility" value={settings?.settings?.carrierFinancialVisibility ?? "full"} />
        </div>
      </SectionCard>

      {/* Security */}
      <SectionCard title="Security Configuration" description="Security-related settings">
        <div className="space-y-3">
          <InfoRow label="Authentication" value="Email OTP" />
          <InfoRow label="Anonymous Access" value="Disabled" />
          <InfoRow label="Public Signup" value="Disabled" />
          <InfoRow label="Access Model" value="Invite-only" />
          <InfoRow label="Security Headers" value="Enabled (CSP, HSTS, X-Frame-Options)" />
          <InfoRow label="Webhook HMAC Verification" value="Available (requires WEBHOOK_SECRET_* env)" />
        </div>
      </SectionCard>

      {/* Data Retention */}
      <SectionCard title="Data Retention" description="Configured retention policies">
        <div className="space-y-3">
          <InfoRow
            label="Location History"
            value={settings?.settings?.dataRetention?.locationHistoryDays ? `${settings.settings.dataRetention.locationHistoryDays} days` : "Not configured"}
          />
          <InfoRow
            label="Message Retention"
            value={settings?.settings?.dataRetention?.messageRetentionDays ? `${settings.settings.dataRetention.messageRetentionDays} days` : "Not configured"}
          />
          <InfoRow
            label="Audit Log Retention"
            value={settings?.settings?.dataRetention?.auditLogRetentionDays ? `${settings.settings.dataRetention.auditLogRetentionDays} days` : "Not configured"}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function ServiceCard({
  icon,
  name,
  configured,
}: {
  icon: React.ReactNode;
  name: string;
  configured: boolean;
}) {
  const label = configured ? "Healthy" : "Not Configured";
  const variant = configured ? "default" as const : "secondary" as const;

  return (
    <Card className="shadow-none border-border/70">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{name}</p>
          <Badge variant={variant} className="mt-0.5 text-[10px]">
            {label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
