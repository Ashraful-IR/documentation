import type { TiptapJson } from "@/db/schema";

/**
 * DOCX support lives exclusively in this module (§7).
 *
 * The core document model (Tiptap JSON) never depends on DOCX internals —
 * this adapter is the only place that knows about .docx. A selected DOCX
 * library's limitations degrade gracefully here: unsupported constructs are
 * dropped or flattened, never corrupted.
 *
 * Implementation status: interface + graceful degradation only. Wire a
 * library (e.g. `docx` for export, `mammoth` for import) behind these two
 * functions when the feature is scheduled.
 */

export interface DocxImportResult {
  title: string;
  content: TiptapJson;
  warnings: string[];
}

export interface DocxExportOptions {
  title: string;
}

export class DocxUnsupportedError extends Error {
  constructor(message = "DOCX conversion is not available in this build yet") {
    super(message);
    this.name = "DocxUnsupportedError";
  }
}

/** DOCX → Tiptap JSON. Throws DocxUnsupportedError until implemented. */
export async function importDocx(_buffer: ArrayBuffer): Promise<DocxImportResult> {
  throw new DocxUnsupportedError();
}

/** Tiptap JSON → .docx bytes. Throws DocxUnsupportedError until implemented. */
export async function exportDocx(_content: TiptapJson, _options: DocxExportOptions): Promise<ArrayBuffer> {
  throw new DocxUnsupportedError();
}

/** Whether DOCX conversion is wired up in this build. */
export function isDocxSupported(): boolean {
  return false;
}
