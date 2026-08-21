// Input validation helpers. All mutation inputs are shape-validated by Convex
// validators; these helpers add semantic validation on top.

import { ConvexError } from "convex/values";
import { DOC_ALLOWED_EXTENSIONS, DOC_MAX_BYTES } from "../constants";

export function reqString(value: string | null | undefined, name: string, max = 500): string {
  const s = (value ?? "").trim();
  if (!s) throw new ConvexError(`${name} is required.`);
  if (s.length > max) throw new ConvexError(`${name} is too long (max ${max} characters).`);
  return s;
}

export function optString(value: string | null | undefined, max = 1000): string | undefined {
  const s = (value ?? "").trim();
  if (!s) return undefined;
  if (s.length > max) throw new ConvexError(`Value is too long (max ${max} characters).`);
  return s;
}

export function validEmail(value: string | null | undefined): string | undefined {
  const s = optString(value, 254);
  if (!s) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ConvexError("Please enter a valid email address.");
  return s;
}

export function positiveNumber(value: number | null | undefined, name: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new ConvexError(`${name} must be a positive number.`);
  return value;
}

/** Validate an uploaded file's metadata. Returns a safe display name. */
export function validateFileMeta(opts: {
  fileName?: string;
  mimeType?: string;
  size?: number;
  storageId?: string;
}): { fileName: string; mimeType?: string; size?: number } {
  const raw = opts.fileName ?? "";
  const storageId = opts.storageId;
  if (!storageId) throw new ConvexError("Upload failed: no file storage reference was provided.");
  if (!raw) throw new ConvexError("Upload failed: file name is required.");
  const clean = raw.replace(/[^A-Za-z0-9._\- ()]/g, "_");
  const ext = clean.split(".").pop()?.toLowerCase() ?? "";
  if (ext && !(DOC_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ConvexError(`File type ".${ext}" is not allowed. Allowed: ${DOC_ALLOWED_EXTENSIONS.join(", ")}.`);
  }
  if (opts.size && opts.size > DOC_MAX_BYTES) {
    throw new ConvexError("File is too large (max 20 MB).");
  }
  if (["exe", "bat", "sh", "js", "html", "svg", "php", "com"].includes(ext)) {
    throw new ConvexError(`File type ".${ext}" is not allowed.`);
  }
  return { fileName: clean, mimeType: opts.mimeType ?? undefined, size: opts.size ?? undefined };
}

export function parseTags(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((t) => t.trim()).filter(Boolean).slice(0, 20);
  }
  return (value ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function safeDate(ms: number | null | undefined, name = "date"): number | undefined {
  if (ms === null || ms === undefined) return undefined;
  if (!Number.isFinite(ms) || ms <= 0) throw new ConvexError(`Please provide a valid ${name}.`);
  return ms;
}
