"use client";

import { useState } from "react";
import { type SummaryResult, type ExtractResult } from "@/app/schemas";
import { Eyebrow, Row } from "@/app/ui";

type BatchMode = "summary" | "extract";

type BatchFile = {
  id: string;
  file: File;
  name: string;
  sizeKB: number;
  status: "pending" | "processing" | "done" | "error";
  result?: SummaryResult | ExtractResult;
  error?: string;
};

const BATCH_MODES: { id: BatchMode; label: string; hint: string }[] = [
  { id: "summary", label: "Summarize", hint: "Executive summary + key points" },
  { id: "extract", label: "Extract data", hint: "Dates, parties, amounts" },
];

// Read a File to base64 (same pattern as the single-doc view)
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Build a CSV string from a 2D array and trigger a download
function downloadCsv(rows: string[][], filename: string) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BatchView() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [mode, setMode] = useState<BatchMode>("extract");
  const [processing, setProcessing] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // --- File management ---

  function addFiles(fileList: FileList) {
    const pdfs = Array.from(fileList).filter((f) => f.type === "application/pdf");
    const newFiles: BatchFile[] = pdfs.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      sizeKB: Math.round(f.size / 1024),
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newFiles].slice(0, 20));
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function clearAll() {
    setFiles([]);
    setExpandedRow(null);
  }

  // --- Processing ---

  function updateFile(id: string, updates: Partial<BatchFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  async function processAll() {
    // Reset all statuses before starting
    setFiles((prev) => prev.map((f) => ({ ...f, status: "pending" as const, result: undefined, error: undefined })));
    setProcessing(true);
    setExpandedRow(null);

    for (const f of files) {
      updateFile(f.id, { status: "processing" });

      try {
        const base64 = await readFileAsBase64(f.file);

        const res = await fetch("/api/process", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pdf: base64, mode, fileName: f.name }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          updateFile(f.id, { status: "error", error: err.error });
          continue;
        }

        const { result } = await res.json();
        updateFile(f.id, { status: "done", result });
      } catch {
        updateFile(f.id, { status: "error", error: "Failed to process" });
      }
    }

    setProcessing(false);
  }

  // --- CSV export ---

  function exportBatchCsv() {
    const doneFiles = files.filter((f) => f.status === "done" && f.result);

    if (mode === "summary") {
      const rows = [["File", "Summary", "Key Points"]];
      for (const f of doneFiles) {
        const r = f.result as SummaryResult;
        rows.push([f.name, r.summary, r.key_points.join("; ")]);
      }
      downloadCsv(rows, "docsift-batch-summary.csv");
    } else {
      const rows = [["File", "Doc Type", "Date", "Date Context", "Party", "Party Role", "Amount", "Amount Context"]];
      for (const f of doneFiles) {
        const r = f.result as ExtractResult;
        const items = [
          ...r.dates.map((d) => [f.name, r.doc_type, d.date, d.context, "", "", "", ""]),
          ...r.parties.map((p) => [f.name, r.doc_type, "", "", p.name, p.role, "", ""]),
          ...r.amounts.map((a) => [f.name, r.doc_type, "", "", "", "", a.value, a.context]),
        ];
        if (items.length === 0) items.push([f.name, r.doc_type, "", "", "", "", "", ""]);
        rows.push(...items);
      }
      downloadCsv(rows, "docsift-batch-extract.csv");
    }
  }

  // --- Derived state ---

  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const processedCount = doneCount + errorCount;
  const currentIndex = files.findIndex((f) => f.status === "processing");
  const hasDone = doneCount > 0;

  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      {/* LEFT — Input */}
      <section className="rounded-2xl border border-white/10 bg-[#15151c] p-5 shadow-xl shadow-black/40">
        <Eyebrow>01 — Files</Eyebrow>

        {/* Drop zone */}
        <label
          className="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-white/15 bg-[#0f0f15] px-4 py-8 text-center transition hover:border-violet-500/60"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
            disabled={processing}
          />
          <div className="font-semibold text-gray-200">
            Drop PDFs here or click to browse
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Up to 20 files · PDF only
          </div>
        </label>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-1">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={f.status} />
                  <span className="truncate text-gray-200">{f.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">{f.sizeKB} KB</span>
                </div>
                {!processing && (
                  <button
                    onClick={() => removeFile(f.id)}
                    className="ml-2 shrink-0 text-gray-500 hover:text-red-400 transition"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!processing && (
              <button
                onClick={clearAll}
                className="mt-1 text-xs text-gray-500 hover:text-gray-300 transition"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Mode selector */}
        <div className="mt-6">
          <Eyebrow>02 — Task</Eyebrow>
          <div className="mt-3 flex flex-col gap-2">
            {BATCH_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                disabled={processing}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  mode === m.id
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-white/10 hover:border-white/25"
                }`}
              >
                <span className="text-sm font-semibold text-gray-100">{m.label}</span>
                <span className="text-xs text-gray-500">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        {processing && (
          <div className="mt-4">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${(processedCount / files.length) * 100}%` }}
              />
            </div>
            <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-gray-500">
              PROCESSING {currentIndex + 1} OF {files.length}…
            </div>
          </div>
        )}

        <button
          onClick={processAll}
          disabled={processing || files.length === 0}
          className="mt-6 w-full rounded-xl bg-violet-500 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-400 disabled:opacity-40 disabled:shadow-none"
        >
          {processing ? "Processing…" : `Process ${files.length} document${files.length !== 1 ? "s" : ""}`}
        </button>

        {errorCount > 0 && !processing && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {errorCount} file{errorCount !== 1 ? "s" : ""} failed to process.
          </div>
        )}
      </section>

      {/* RIGHT — Results table */}
      <section>
        <div
          className="h-3.5 rounded-t-2xl border border-b-0 border-white/10"
          style={{
            background:
              "radial-gradient(circle at 7px 0px, #0b0b10 5px, #15151c 5.5px)",
            backgroundSize: "18px 14px",
          }}
        />
        <div className="relative min-h-[320px] overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-[#15151c] p-5 shadow-xl shadow-black/40">
          <Eyebrow>03 — Batch results</Eyebrow>

          {!hasDone && !processing && (
            <div className="mt-16 text-center text-sm text-gray-500">
              Upload PDFs and process them to see combined results.
              <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-gray-600">
                AWAITING INPUT
              </div>
            </div>
          )}

          {!hasDone && processing && (
            <div className="mt-8 space-y-4">
              {[92, 78, 96, 60, 84].map((w, i) => (
                <div
                  key={i}
                  className="h-3 animate-pulse rounded bg-white/10"
                  style={{ width: `${w}%` }}
                />
              ))}
              <div className="font-mono text-[11px] tracking-[0.15em] text-gray-500">
                READING DOCUMENTS…
              </div>
            </div>
          )}

          {hasDone && (
            <>
              <div className="absolute right-5 top-5 -rotate-6 rounded border-2 border-violet-400/80 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-violet-300">
                {doneCount} PROCESSED
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">File</th>
                      {mode === "summary" ? (
                        <>
                          <th className="px-3 py-2">Summary</th>
                          <th className="px-3 py-2">Points</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Dates</th>
                          <th className="px-3 py-2">Parties</th>
                          <th className="px-3 py-2">Amounts</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {files
                      .filter((f) => f.status === "done" && f.result)
                      .map((f) => (
                        <TableRow
                          key={f.id}
                          file={f}
                          mode={mode}
                          expanded={expandedRow === f.id}
                          onToggle={() =>
                            setExpandedRow(expandedRow === f.id ? null : f.id)
                          }
                        />
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end border-t border-dashed border-white/10 pt-3">
                <button
                  onClick={exportBatchCsv}
                  className="rounded-lg px-3 py-1.5 font-mono text-[11px] text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
                >
                  Export CSV
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// --- Small helper components ---

function StatusDot({ status }: { status: BatchFile["status"] }) {
  const styles = {
    pending: "bg-gray-500",
    processing: "bg-violet-400 animate-pulse",
    done: "bg-green-400",
    error: "bg-red-400",
  };
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${styles[status]}`} />;
}

function TableRow({
  file,
  mode,
  expanded,
  onToggle,
}: {
  file: BatchFile;
  mode: BatchMode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const r = file.result!;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-white/10 transition hover:bg-white/5"
      >
        <td className="px-3 py-3 text-gray-200">{file.name}</td>
        {mode === "summary" ? (
          <>
            <td className="px-3 py-3 text-gray-400">
              {(r as SummaryResult).summary.slice(0, 80)}…
            </td>
            <td className="px-3 py-3 text-gray-400">
              {(r as SummaryResult).key_points.length} points
            </td>
          </>
        ) : (
          <>
            <td className="px-3 py-3">
              <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-violet-300">
                {(r as ExtractResult).doc_type}
              </span>
            </td>
            <td className="px-3 py-3 text-gray-400">
              {(r as ExtractResult).dates.length}
            </td>
            <td className="px-3 py-3 text-gray-400">
              {(r as ExtractResult).parties.length}
            </td>
            <td className="px-3 py-3 text-gray-400">
              {(r as ExtractResult).amounts.length}
            </td>
          </>
        )}
      </tr>
      {expanded && (
        <tr>
          <td
            colSpan={mode === "summary" ? 3 : 5}
            className="border-b border-white/10 bg-white/[0.02] px-3 py-3"
          >
            {mode === "summary" ? (
              <div>
                <Row label="Summary">{(r as SummaryResult).summary}</Row>
                <Row label="Key points">
                  <ul className="space-y-2">
                    {(r as SummaryResult).key_points.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-violet-400">▸</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </Row>
              </div>
            ) : (
              <div>
                <Row label="Dates">
                  {(r as ExtractResult).dates.length
                    ? (r as ExtractResult).dates.map((d, i) => (
                        <div key={i} className="mb-1">
                          <b className="font-mono text-white">{d.date}</b>{" "}
                          <span className="text-gray-400">— {d.context}</span>
                        </div>
                      ))
                    : "—"}
                </Row>
                <Row label="Parties">
                  {(r as ExtractResult).parties.length
                    ? (r as ExtractResult).parties.map((p, i) => (
                        <div key={i} className="mb-1">
                          <b className="text-white">{p.name}</b>{" "}
                          <span className="text-gray-400">({p.role})</span>
                        </div>
                      ))
                    : "—"}
                </Row>
                <Row label="Amounts">
                  {(r as ExtractResult).amounts.length
                    ? (r as ExtractResult).amounts.map((a, i) => (
                        <div key={i} className="mb-1">
                          <b className="font-mono text-violet-300">{a.value}</b>{" "}
                          <span className="text-gray-400">— {a.context}</span>
                        </div>
                      ))
                    : "—"}
                </Row>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
