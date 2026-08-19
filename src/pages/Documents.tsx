import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { DOCUMENT_TYPES } from "@/convex/constants";
import { useCanWrite, useTimezone } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, LoadingState, EmptyState, ConfirmButton, errorMessage } from "@/components/app/shared";
import { SelectInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { UploadDocumentButton } from "@/components/app/UploadDocument";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { FileText, Trash2, ExternalLink, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type DocType = any;

export default function Documents() {
  const canWrite = useCanWrite();
  const tz = useTimezone();
  const [typeFilter, setTypeFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<"" | "valid" | "expiring" | "expired">("");
  const docs = useQuery(api.documents.list, { type: typeFilter || undefined });
  const removeDoc = useMutation(api.documents.remove);

  const handleDelete = async (doc: DocType) => {
    try { await removeDoc({ id: doc._id as any }); toast.success("Document deleted."); } catch (e) { toast.error(errorMessage(e)); }
  };

  // Compute expiry status for each doc
  const now = Date.now();
  const thirtyDays = 30 * 86_400_000;

  const getExpiryStatus = (d: DocType): "valid" | "expiring" | "expired" | null => {
    if (!d.expiresAt) return null;
    if (d.expiresAt < now) return "expired";
    if (d.expiresAt < now + thirtyDays) return "expiring";
    return "valid";
  };

  const filteredDocs = (docs ?? []).filter((d: DocType) =>
    !expiryFilter || getExpiryStatus(d) === expiryFilter
  );

  const columns: Column<DocType>[] = [
    { key: "name", header: "File", render: (d) => <div><p className="font-medium text-sm">{d.fileName}</p><p className="text-xs text-muted-foreground">{d.uploadedByName ?? "Unknown"}</p></div> },
    { key: "type", header: "Type", render: (d) => <span className="text-sm">{d.type}</span> },
    { key: "expiry", header: "Expiry", hideOnMobile: true, render: (d) => {
      const status = getExpiryStatus(d);
      if (!d.expiresAt) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <div className="flex items-center gap-1.5">
          {status === "expired" && <XCircle className="size-3.5 text-red-500" />}
          {status === "expiring" && <AlertTriangle className="size-3.5 text-amber-500" />}
          {status === "valid" && <CheckCircle2 className="size-3.5 text-emerald-500" />}
          <span className={cn("text-xs",
            status === "expired" ? "text-red-600 dark:text-red-400 font-medium" :
            status === "expiring" ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
          )}>
            {fmtDate(d.expiresAt, tz)}
          </span>
          {status && <Badge variant="outline" className={cn("text-[10px] border-transparent",
            status === "expired" ? "bg-red-500/10 text-red-600" :
            status === "expiring" ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
          )}>
            {status === "expired" ? "Expired" : status === "expiring" ? "Expiring" : "Valid"}
          </Badge>}
        </div>
      );
    } },
    { key: "version", header: "Version", hideOnMobile: true, render: (d) => (
      <span className="text-xs text-muted-foreground">v{d.version ?? 1}</span>
    ) },
    { key: "entity", header: "Linked to", hideOnMobile: true, render: (d) => <span className="text-sm text-muted-foreground">{d.entityType ? `${d.entityType} · ${d.entityId?.slice(0, 8)}…` : "—"}</span> },
    { key: "size", header: "Size", hideOnMobile: true, render: (d) => <span className="text-sm text-muted-foreground">{d.size ? `${(d.size / 1024).toFixed(0)} KB` : "—"}</span> },
    ...(canWrite ? [{ key: "actions" as const, header: "", hideOnMobile: true, render: (d: DocType) => (
      <div className="flex justify-end gap-1">
        {d.storageId && <UrlButton storageId={d.storageId} />}
        <ConfirmButton trigger={<Button variant="ghost" size="icon"><Trash2 className="size-4 text-destructive" /></Button>} title="Delete document?" description="This cannot be undone." onConfirm={() => handleDelete(d)} confirmLabel="Delete" />
      </div>
    ) }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description={`${docs?.length ?? 0} documents`}
        actions={<UploadDocumentButton />} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SelectInput value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full sm:w-48">
          <option value="">All types</option>
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </SelectInput>
        <SelectInput value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value as any)} className="w-full sm:w-48">
          <option value="">All expiry</option>
          <option value="valid">✅ Valid</option>
          <option value="expiring">⚠️ Expiring soon</option>
          <option value="expired">🔴 Expired</option>
        </SelectInput>
      </div>
      {docs === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={filteredDocs} getKey={(d) => d._id}
          empty={<EmptyState icon={<FileText className="size-6" />} title="No documents" description="Upload your first document." action={<UploadDocumentButton />} />} />
      )}
    </div>
  );
}

function UrlButton({ storageId }: { storageId: string }) {
  const url = useQuery(api.documents.getUrl, { storageId });
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors">
      <ExternalLink className="size-4 text-muted-foreground" />
    </a>
  );
}
