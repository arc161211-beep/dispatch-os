import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, SelectInput, TextArea } from "@/components/app/forms";
import { errorMessage } from "@/components/app/shared";
import { PenLine, Trash2, Plus } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface SignerInput {
  signerUserId?: string;
  signerName: string;
  signerEmail: string;
  role: string;
  order: number;
}

const SIGNER_ROLES = ["carrier", "dispatcher", "broker", "shipper", "driver", "other"] as const;

export function RequestSignatureButton({
  documentId,
  loadId,
  disabled,
  size = "sm",
}: {
  documentId: Id<"documents">;
  loadId?: Id<"loads">;
  disabled?: boolean;
  size?: "sm" | "default" | "lg" | "icon";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className="gap-1.5"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <PenLine className="size-3.5" /> Request Signature
      </Button>
      <RequestSignatureDialog
        open={open}
        onClose={() => setOpen(false)}
        documentId={documentId}
        loadId={loadId}
      />
    </>
  );
}

function RequestSignatureDialog({
  open,
  onClose,
  documentId,
  loadId,
}: {
  open: boolean;
  onClose: () => void;
  documentId: Id<"documents">;
  loadId?: Id<"loads">;
}) {
  const [busy, setBusy] = useState(false);
  const [sequential, setSequential] = useState(false);
  const [message, setMessage] = useState("");
  const [signers, setSigners] = useState<SignerInput[]>([
    { signerName: "", signerEmail: "", role: "carrier", order: 1 },
  ]);

  const createRequest = useMutation(api.signatures.createRequest);

  const addSigner = () => {
    setSigners((prev) => [
      ...prev,
      { signerName: "", signerEmail: "", role: "dispatcher", order: prev.length + 1 },
    ]);
  };

  const removeSigner = (idx: number) => {
    setSigners((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, order: i + 1 })),
    );
  };

  const updateSigner = (idx: number, field: keyof SignerInput, value: string | number) => {
    setSigners((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const validSigners = signers.filter((s) => s.signerName.trim());
    if (validSigners.length === 0) {
      toast.error("Add at least one signer with a name.");
      return;
    }

    setBusy(true);
    try {
      await createRequest({
        documentId,
        loadId,
        message: message || undefined,
        sequential,
        signers: validSigners.map((s, i) => ({
          signerUserId: s.signerUserId as any,
          signerName: s.signerName,
          signerEmail: s.signerEmail || undefined,
          role: s.role as any,
          order: i + 1,
        })),
      });
      toast.success("Signature request created.");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Signature</DialogTitle>
          <DialogDescription>
            Select signers for this document. They will receive an in-app notification.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Message (optional)">
            <TextArea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Instructions for signers..."
            />
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Signers ({signers.length})</span>
            <Button type="button" variant="ghost" size="sm" onClick={addSigner} className="gap-1">
              <Plus className="size-3.5" /> Add Signer
            </Button>
          </div>

          {signers.map((signer, idx) => (
            <div key={idx} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Signer {idx + 1}</Badge>
                {signers.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => removeSigner(idx)}
                  >
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name" required>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={signer.signerName}
                    onChange={(e) => updateSigner(idx, "signerName", e.target.value)}
                    placeholder="John Smith"
                  />
                </Field>
                <Field label="Role">
                  <SelectInput
                    value={signer.role}
                    onChange={(e) => updateSigner(idx, "role", e.target.value)}
                  >
                    {SIGNER_ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <Field label="Email (optional)">
                <input
                  type="email"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={signer.signerEmail}
                  onChange={(e) => updateSigner(idx, "signerEmail", e.target.value)}
                  placeholder="john@example.com"
                />
              </Field>

            </div>
          ))}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={sequential}
              onChange={(e) => setSequential(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Sequential signing (sign in order)
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating..." : "Send Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
