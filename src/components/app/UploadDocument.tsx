import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { DOCUMENT_TYPES, DOC_ALLOWED_EXTENSIONS, DOC_MAX_BYTES } from "@/convex/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Grid, SelectInput, TextArea } from "@/components/app/forms";
import { errorMessage } from "@/components/app/shared";
import { Upload, FileUp } from "lucide-react";

export function UploadDocumentButton({
  entityType,
  entityId,
  defaultType = "Other",
  onUploaded,
  size = "sm",
}: {
  entityType?: string;
  entityId?: string;
  defaultType?: string;
  onUploaded?: () => void;
  size?: "sm" | "default" | "lg" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const uploadMeta = useMutation(api.documents.upload);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) { toast.error("Please select a file."); return; }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!DOC_ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`File type ".${ext}" is not allowed.`);
      return;
    }
    if (file.size > DOC_MAX_BYTES) {
      toast.error(`File exceeds ${(DOC_MAX_BYTES / 1024 / 1024).toFixed(0)}MB limit.`);
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed.");
      const { storageId } = await res.json() as { storageId: string };

      await uploadMeta({
        entityType,
        entityId,
        type: (fd.get("type") as string || defaultType) as typeof DOCUMENT_TYPES[number],
        fileName: file.name,
        mimeType: file.type || undefined,
        size: file.size,
        storageId,
        notes: String(fd.get("notes") ?? "") || undefined,
      });

      toast.success("Document uploaded.");
      setOpen(false);
      setFile(null);
      onUploaded?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size={size} className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="size-3.5" /> Upload
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFile(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              Upload files up to {(DOC_MAX_BYTES / 1024 / 1024).toFixed(0)}MB. Accepted: {DOC_ALLOWED_EXTENSIONS.slice(0, 6).join(", ")}…
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <Field label="File" required>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center hover:bg-muted/40">
                <FileUp className="size-5 text-muted-foreground" />
                <div className="text-sm">
                  {file ? <span className="font-medium">{file.name}</span> : <span className="text-muted-foreground">Choose a file</span>}
                  {file && <span className="ml-2 text-xs text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>}
                </div>
                <input type="file" className="hidden" accept={DOC_ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
            <Grid>
              <Field label="Document type">
                <SelectInput name="type" defaultValue={defaultType}>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </SelectInput>
              </Field>
            </Grid>
            <Field label="Notes">
              <TextArea name="notes" rows={2} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !file}>{busy ? "Uploading…" : "Upload"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
