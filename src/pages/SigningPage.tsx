import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingState, EmptyState, errorMessage } from "@/components/app/shared";
import { PageHeader } from "@/components/app/shared";
import { fmtDateTime } from "@/lib/dates";
import {
  PenLine,
  Upload,
  Type,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  FileText,
} from "lucide-react";

type SignMode = "draw" | "upload" | "typed";

export default function SigningPage() {
  const { id: requestId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const request = useQuery(
    api.signatures.get,
    requestId ? { requestId: requestId as any } : "skip",
  );
  const auditTrail = useQuery(
    api.signatures.getAuditTrail,
    requestId ? { requestId: requestId as any } : "skip",
  );

  if (!requestId) return <EmptyState title="Invalid link" />;
  if (request === undefined) return <LoadingState />;
  if (!request) return <EmptyState title="Signature request not found" />;

  const { request: req, signers, document } = request;

  // Find current user's signer row
  const mySignerRow = signers.find(
    (sr) => sr.status !== "signed" && sr.status !== "declined",
  );

  const isCompleted = req.status === "completed";
  const isCancelled = req.status === "cancelled";
  const isDeclined = req.status === "declined";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 p-4 py-8">
        <PageHeader
          title="Sign Document"
          description={
            isCompleted
              ? "All signatures completed"
              : isCancelled
                ? "This request was cancelled"
                : isDeclined
                  ? "This request was declined"
                  : "Review and sign the document"
          }
        />

        {/* Document info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" />
              {document?.fileName ?? "Document"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Type: {document?.type ?? "Unknown"}</span>
              {req.loadId && <span>· Load: {req.loadId.slice(0, 8)}…</span>}
            </div>
            {document?.storageId && (
              <DocumentPreview storageId={document.storageId} />
            )}
            {req.message && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <span className="font-medium">Instructions: </span>
                {req.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signers status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Signers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {signers
                .sort((a, b) => a.order - b.order)
                .map((sr) => (
                  <div
                    key={sr._id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-5">
                        {sr.order}.
                      </span>
                      <div>
                        <p className="text-sm font-medium">{sr.signerName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{sr.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sr.status === "signed" && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-transparent">
                          <CheckCircle2 className="size-3 mr-1" /> Signed
                        </Badge>
                      )}
                      {sr.status === "declined" && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-transparent">
                          <XCircle className="size-3 mr-1" /> Declined
                        </Badge>
                      )}
                      {sr.status === "viewed" && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-transparent">
                          <Clock className="size-3 mr-1" /> Viewed
                        </Badge>
                      )}
                      {sr.status === "pending" && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Signing area — only show if request is active and user is a signer */}
        {mySignerRow && !isCompleted && !isCancelled && !isDeclined && (
          <SigningArea signerRow={mySignerRow} requestId={requestId!} />
        )}

        {/* Status for completed */}
        {isCompleted && (
          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardContent className="flex items-center gap-3 py-6">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <div>
                <p className="font-medium text-emerald-700 dark:text-emerald-400">
                  All Signatures Complete
                </p>
                <p className="text-sm text-muted-foreground">
                  This document has been fully signed by all parties.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audit Trail */}
        {auditTrail && auditTrail.signatures.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditTrail.signatures.map((sig) => (
                  <div key={sig._id} className="flex items-start gap-3 rounded-md border p-3">
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{sig.signerName}</p>
                        <Badge variant="outline" className="text-[10px] border-transparent bg-muted text-muted-foreground">
                          {sig.signatureType === "draw" ? "Drew" : sig.signatureType === "upload" ? "Uploaded" : "Typed"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Signed at {fmtDateTime(sig.signedAt)}
                      </p>
                      {sig.consentConfirmed && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          ✓ Electronic consent confirmed
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SigningArea({
  signerRow,
  requestId,
}: {
  signerRow: any;
  requestId: string;
}) {
  const [mode, setMode] = useState<SignMode>("typed");
  const [typedName, setTypedName] = useState(signerRow.signerName ?? "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const markViewed = useMutation(api.signatures.markViewed);
  const signDocument = useMutation(api.signatures.signDocument);
  const declineSignature = useMutation(api.signatures.declineSignature);

  // Mark as viewed on mount
  useEffect(() => {
    if (signerRow.status === "pending") {
      markViewed({ signerRowId: signerRow._id }).catch(() => {});
    }
  }, [signerRow._id, signerRow.status]);

  const handleSign = async () => {
    if (!consent) {
      toast.error("Please confirm electronic signing consent.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "typed") {
        if (!typedName.trim()) {
          toast.error("Please enter your name as your signature.");
          setBusy(false);
          return;
        }
        await signDocument({
          signerRowId: signerRow._id,
          signatureType: "typed",
          signatureText: typedName,
          consentConfirmed: true,
        });
      } else if (mode === "draw") {
        // For draw mode, the DrawingPad component handles the actual signing
        toast.error("Drawing is handled in the component below.");
        setBusy(false);
        return;
      } else if (mode === "upload") {
        // Upload handled separately
        toast.error("Upload is handled in the component below.");
        setBusy(false);
        return;
      }
      toast.success("Document signed successfully!");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    const reason = prompt("Please provide a reason for declining (optional):");
    setBusy(true);
    try {
      await declineSignature({ signerRowId: signerRow._id, reason: reason ?? undefined });
      toast.success("Signature declined.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your Signature</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          {(["typed", "draw", "upload"] as SignMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(m)}
              className="gap-1.5"
            >
              {m === "typed" && <Type className="size-3.5" />}
              {m === "draw" && <PenLine className="size-3.5" />}
              {m === "upload" && <Upload className="size-3.5" />}
              {m === "typed" ? "Type" : m === "draw" ? "Draw" : "Upload"}
            </Button>
          ))}
        </div>

        {/* Typed signature */}
        {mode === "typed" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Type your full name</label>
            <input
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-lg font-serif italic"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Your full name"
            />
            <div className="rounded-md border border-dashed p-4 text-center">
              <p className="text-2xl font-serif italic text-foreground/80">
                {typedName || "Your signature will appear here"}
              </p>
            </div>
          </div>
        )}

        {/* Draw signature */}
        {mode === "draw" && (
          <DrawingPad
            signerRowId={signerRow._id}
            onSigned={() => {
              toast.success("Document signed successfully!");
            }}
          />
        )}

        {/* Upload signature */}
        {mode === "upload" && (
          <UploadSignature
            signerRowId={signerRow._id}
            onSigned={() => {
              toast.success("Document signed successfully!");
            }}
          />
        )}

        <Separator />

        {/* Consent checkbox */}
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="size-4 rounded border-input mt-0.5"
          />
          <span>
            I confirm that I am signing this document electronically and agree that
            my electronic signature is the legal equivalent of my manual signature.
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSign}
            disabled={busy || !consent || (mode === "typed" && !typedName.trim())}
            className="flex-1"
          >
            {busy ? "Signing..." : "Sign Document"}
          </Button>
          <Button variant="outline" onClick={handleDecline} disabled={busy}>
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Canvas-based drawing pad for draw mode signatures. */
function DrawingPad({
  signerRowId,
  onSigned,
}: {
  signerRowId: string;
  onSigned: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [busy, setBusy] = useState(false);

  const signDocument = useMutation(api.signatures.signDocument);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDraw = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setIsDrawing(true);
    },
    [getPos],
  );

  const draw = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pos = getPos(e);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasContent(true);
    },
    [isDrawing, getPos],
  );

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  const submitDraw = async () => {
    if (!hasContent) {
      toast.error("Please draw your signature first.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      // Convert canvas to blob and upload
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create image")), "image/png"));
      });

      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload failed.");
      const { storageId } = (await res.json()) as { storageId: string };

      await signDocument({
        signerRowId: signerRowId as any,
        signatureType: "draw",
        signatureStorageId: storageId,
        consentConfirmed: true,
      });
      onSigned();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Draw your signature below</label>
      <canvas
        ref={canvasRef}
        width={500}
        height={150}
        className="w-full rounded-md border border-input bg-white cursor-crosshair touch-none"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={stopDraw}
        onPointerLeave={stopDraw}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>
          Clear
        </Button>
        <Button type="button" size="sm" onClick={submitDraw} disabled={busy || !hasContent}>
          {busy ? "Uploading..." : "Use This Signature"}
        </Button>
      </div>
    </div>
  );
}

/** Upload an existing signature image. */
function UploadSignature({
  signerRowId,
  onSigned,
}: {
  signerRowId: string;
  onSigned: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signDocument = useMutation(api.signatures.signDocument);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed.");
      const { storageId } = (await res.json()) as { storageId: string };

      await signDocument({
        signerRowId: signerRowId as any,
        signatureType: "upload",
        signatureStorageId: storageId,
        consentConfirmed: true,
      });
      onSigned();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Upload signature image</label>
      <div className="rounded-md border border-dashed p-4 text-center">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="text-sm"
        />
      </div>
      {preview && (
        <div className="rounded-md border p-2 text-center">
          <img src={preview} alt="Signature preview" className="max-h-24 mx-auto" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Supported formats: PNG, JPG, WebP. Max 2MB.
      </p>
      <Button
        type="button"
        size="sm"
        onClick={handleUpload}
        disabled={busy || !file}
        className="w-full"
      >
        {busy ? "Uploading..." : "Upload & Sign"}
      </Button>
    </div>
  );
}

/** Inline document preview for PDFs and images. */
function DocumentPreview({ storageId }: { storageId: string }) {
  const url = useQuery(api.documents.getUrl, { storageId });
  if (!url) return null;

  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(url);

  return (
    <div className="rounded-md border overflow-hidden">
      {isImage ? (
        <img src={url} alt="Document" className="max-h-64 mx-auto" />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 text-sm text-blue-600 hover:underline"
        >
          <ExternalLink className="size-4" />
          Open document in new tab
        </a>
      )}
    </div>
  );
}
