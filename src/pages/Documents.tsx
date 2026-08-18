import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { DOCUMENT_TYPES } from "@/convex/constants";
import { useCanWrite } from "@/hooks/use-app";
import { Button } from "@/components/ui/button";
import { PageHeader, LoadingState, EmptyState, ConfirmButton, errorMessage } from "@/components/app/shared";
import { SelectInput } from "@/components/app/forms";
import { ResponsiveTable, type Column } from "@/components/app/ResponsiveTable";
import { UploadDocumentButton } from "@/components/app/UploadDocument";
import { FileText, Trash2, ExternalLink } from "lucide-react";

type DocType = any;

export default function Documents() {
  const canWrite = useCanWrite();
  const [typeFilter, setTypeFilter] = useState("");
  const docs = useQuery(api.documents.list, { type: typeFilter || undefined });
  const getUrl = useQuery(api.documents.getUrl, docs ? { storageId: docs[0]?.storageId ?? "" } : "skip");
  const removeDoc = useMutation(api.documents.remove);

  const handleDelete = async (doc: DocType) => {
    try { await removeDoc({ id: doc._id as any }); toast.success("Document deleted."); } catch (e) { toast.error(errorMessage(e)); }
  };

  const columns: Column<DocType>[] = [
    { key: "name", header: "File", render: (d) => <div><p className="font-medium text-sm">{d.fileName}</p><p className="text-xs text-muted-foreground">{d.uploadedByName ?? "Unknown"}</p></div> },
    { key: "type", header: "Type", render: (d) => <span className="text-sm">{d.type}</span> },
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
      <SelectInput value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full sm:w-48">
        <option value="">All types</option>
        {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </SelectInput>
      {docs === undefined ? <LoadingState /> : (
        <ResponsiveTable columns={columns} rows={docs} getKey={(d) => d._id}
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
