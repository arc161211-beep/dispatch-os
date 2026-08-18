import { useState } from "react";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Download, FileUp } from "lucide-react";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { errorMessage } from "./shared";
import { api } from "@/convex/_generated/api";

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function ExportCsvButton({
  filename,
  headers,
  rows,
  label = "Export",
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => downloadCsv(filename, headers, rows)}
      disabled={rows.length === 0}
    >
      <Download className="size-3.5" />
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// CSV import with preview + row-level errors
// ---------------------------------------------------------------------------

export function ImportCsvDialog({
  entity,
  title,
  description,
  requiredColumns,
  mapRow,
  mutationName,
  accept = ".csv",
}: {
  entity: "leads" | "carriers" | "trucks" | "drivers" | "brokers" | "loads";
  title: string;
  description: string;
  requiredColumns: string[];
  mapRow: (row: Record<string, string>) => Record<string, unknown>;
  mutationName: "importLeads" | "importCarriers" | "importTrucks" | "importDrivers" | "importBrokers" | "importLoads";
  accept?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [result, setResult] = useState<{ inserted: number; errors: { row: number; error: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type ImportFn = (args: { rows: Record<string, unknown>[] }) => Promise<{ inserted: number; errors: { row: number; error: string }[] }>;
  const runImport = useMutation(api[entity][mutationName] as unknown as ImportFn);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setText(text);
      const parsed = parseCsv(text);
      setRows(parsed);
      setResult(null);
      setError(null);
      const missingCols = requiredColumns.filter((c) => !(parsed[0] ?? {})[c]);
      setMissing(missingCols);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = (await runImport({ rows: rows.map(mapRow) })) as { inserted: number; errors: { row: number; error: string }[] };
      setResult(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const previewCols = rows[0] ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileUp className="size-3.5" />
        Import CSV
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResult(null); setRows([]); setText(""); setError(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {!rows.length && !result && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center hover:bg-muted/40">
              <FileUp className="size-6 text-muted-foreground" />
              <span className="text-sm font-medium">Choose a CSV file</span>
              <span className="text-xs text-muted-foreground">Required columns: {requiredColumns.join(", ")}</span>
              <input
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          )}

          {rows.length > 0 && !result && (
            <>
              {missing.length > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    Missing required columns: <strong>{missing.join(", ")}</strong>. Preview will still show below, but import
                    will fail until the file has these headers.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{rows.length}</strong> rows parsed. Duplicates are detected automatically
                  and skipped with row-level errors. Import is transactional per row group — no partial corruption.
                </div>
              )}
              <div className="max-h-56 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewCols.map((c) => (
                        <TableHead key={c} className="text-xs">{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 8).map((r, i) => (
                      <TableRow key={i}>
                        {previewCols.map((c) => (
                          <TableCell key={c} className="text-xs">{r[c]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRows([])}>
                  Choose another file
                </Button>
                <Button type="button" onClick={handleImport} disabled={busy || missing.length > 0}>
                  {busy ? "Importing…" : `Import ${rows.length} rows`}
                </Button>
              </DialogFooter>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {result.inserted} inserted
                </Badge>
                {result.errors.length > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {result.errors.length} row errors
                  </Badge>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-lg border p-2">
                  {result.errors.slice(0, 30).map((e, i) => (
                    <p key={i} className="px-2 py-1 text-xs text-muted-foreground">
                      Row {e.row}: {e.error}
                    </p>
                  ))}
                </div>
              )}
              <Button type="button" onClick={() => { setResult(null); setRows([]); setText(""); }} className="w-full">
                Done
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <span className="hidden">{text.length > 0}</span>
        </DialogContent>
      </Dialog>
    </>
  );
}
