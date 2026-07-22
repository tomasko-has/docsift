"use client";

import { useState } from "react";
import {
  validateResult,
  type SummaryResult,
  type ExtractResult,
  type AskResult,
  type AiResult,
} from "@/app/schemas";
import { Eyebrow, Row } from "@/app/ui";
import BatchView from "@/app/batch-view";
import HistoryView from "@/app/history-view";
import TemplateSelector from "@/app/template-selector";

type Mode = "summary" | "extract" | "ask";

// Typed wrapper around the result state so we know which shape we have
type Result =
  | { mode: "summary"; data: SummaryResult }
  | { mode: "extract"; data: ExtractResult }
  | { mode: "extract-custom"; data: Record<string, string | null>; templateFields: string[] }
  | { mode: "ask"; data: AskResult; question: string };

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "summary", label: "Summarize", hint: "Executive summary + key points" },
  { id: "extract", label: "Extract data", hint: "Dates, parties, amounts" },
  { id: "ask", label: "Ask a question", hint: "Ask anything about the document" },
];

const SAMPLE_INVOICE = `INVOICE #2024-0042

From: Nextera Solutions Ltd.
123 Business Park, Suite 400
London, UK

To: Greenfield & Associates
456 Oak Avenue
New York, NY 10001

Date: March 3, 2024
Due: April 2, 2024
Payment terms: Net 30

Description                     Qty     Rate        Amount
─────────────────────────────────────────────────────────
UI/UX Design Services            40h    $95/hr      $3,800.00
Frontend Development             60h    $120/hr     $7,200.00
API Integration & Testing        25h    $120/hr     $3,000.00
Project Management               15h    $85/hr      $1,275.00
─────────────────────────────────────────────────────────
                                        Subtotal:   $15,275.00
                                        Tax (8%):   $1,222.00
                                        TOTAL:      $16,497.00

Bank: HSBC UK | IBAN: GB29 HBUK 4012 0612 3456 78
Reference: NEX-GFA-2024-0042

Thank you for your business.`;

export default function Home() {
  const [view, setView] = useState<"single" | "batch" | "history">("single");
  const [tab, setTab] = useState<"paste" | "pdf">("paste");
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<{ name: string; sizeKB: number; data: string } | null>(null);
  const [mode, setMode] = useState<Mode>("summary");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);

  async function copyJson() {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportCsv() {
    if (!result) return;
    if (result.mode === "extract") {
      const d = result.data;
      const rows: string[][] = [["Section", "Field1", "Field2"]];
      for (const date of d.dates ?? []) rows.push(["Dates", date.date, date.context]);
      for (const party of d.parties ?? []) rows.push(["Parties", party.name, party.role]);
      for (const amount of d.amounts ?? []) rows.push(["Amounts", amount.value, amount.context]);
      const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "docsift-extract.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else if (result.mode === "extract-custom") {
      const rows: string[][] = [["Field", "Value"]];
      for (const field of result.templateFields) {
        rows.push([field, result.data[field] ?? ""]);
      }
      const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "docsift-extract.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function loadSample() {
    setTab("paste");
    setText(SAMPLE_INVOICE);
    setMode("summary");
  }

  function handleFile(file: File | undefined) {
    if (!file || file.type !== "application/pdf") return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = (reader.result as string).split(",")[1];
      setPdf({ name: file.name, sizeKB: Math.round(file.size / 1024), data });
    };
    reader.readAsDataURL(file);
  }

  async function saveToHistory(
    saveMode: Mode,
    inputName: string,
    result: string,
    saveQuestion?: string
  ) {
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: saveMode,
          inputName,
          question: saveQuestion,
          result,
        }),
      });
    } catch {
      // Saving to history is best-effort — don't block the user if it fails
    }
  }

  const hasSource = tab === "pdf" ? !!pdf : !!text.trim();

  async function handleSubmit() {
    setLoading(true);
    setResult(null);
    setError("");
    setStreamingText("");

    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          tab === "pdf" && pdf
            ? { pdf: pdf.data, mode, ...(mode === "ask" && { question }), ...(mode === "extract" && templateId && { templateId }) }
            : { text, mode, ...(mode === "ask" && { question }), ...(mode === "extract" && templateId && { templateId }) }
        ),
      });

      // Non-stream error responses (400, 502, etc.) come back as JSON
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong.");
        return;
      }

      // Read the streamed text token by token
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setStreamingText(full);
      }

      // Stream finished — parse and validate the accumulated JSON
      const cleaned = full.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (mode === "ask") {
        const validated = validateResult(mode, parsed);
        setResult({ mode, data: validated as AskResult, question });
      } else if (mode === "extract" && templateId) {
        // Custom template — result is a flat key-value object
        setResult({
          mode: "extract-custom",
          data: parsed as Record<string, string | null>,
          templateFields: Object.keys(parsed),
        });
      } else if (mode === "extract") {
        const validated = validateResult(mode, parsed);
        setResult({ mode, data: validated as ExtractResult });
      } else {
        const validated = validateResult(mode, parsed);
        setResult({ mode, data: validated as SummaryResult });
      }

      // Save to history after successful stream parse
      const inputName = tab === "pdf" && pdf ? pdf.name : "Pasted text";
      saveToHistory(mode, inputName, cleaned, mode === "ask" ? question : undefined);

      if (mode === "ask") setQuestion("");
    } catch {
      setError("Could not process the document. Please try again.");
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  }

  return (
    <div className="min-h-screen px-4 pb-16">
      {/* Header */}
      <header className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-6 pt-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 text-lg font-bold text-white shadow-lg shadow-violet-500/25">
              D
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              DocSift<span className="text-violet-400">.</span>
            </h1>
          </div>
          <p className="mt-3 text-sm text-gray-400">
            Drop in a document — get a{" "}
            <span className="rounded bg-violet-500/20 px-1 text-violet-300">summary</span>{" "}
            or clean{" "}
            <span className="rounded bg-violet-500/20 px-1 text-violet-300">
              structured data
            </span>
            .
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-violet-400">
            AI document intelligence
          </div>
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {(["single", "batch", "history"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 font-mono text-xs transition ${
                  view === v
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {v === "single" ? "Single" : v === "batch" ? "Batch" : "History"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content — switches between single-doc and batch views */}
      {view === "batch" ? (
        <main className="mx-auto mt-8 max-w-5xl">
          <BatchView />
        </main>
      ) : view === "history" ? (
        <main className="mx-auto mt-8 max-w-3xl">
          <HistoryView />
        </main>
      ) : (
      <main className="mx-auto mt-8 grid max-w-5xl items-start gap-6 md:grid-cols-2">
        {/* INPUT */}
        <section className="rounded-2xl border border-white/10 bg-[#15151c] p-5 shadow-xl shadow-black/40">
          <Eyebrow>01 — Source</Eyebrow>

          <div className="mt-3 flex gap-2">
            {(["paste", "pdf"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 font-mono text-xs transition ${
                  tab === t
                    ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/50"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {t === "paste" ? "Paste text" : "Upload PDF"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "paste" ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste a contract, invoice, report, article…"
                rows={9}
                className="w-full resize-y rounded-xl border border-white/10 bg-[#0f0f15] p-4 text-sm text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
              />
            ) : (
              <label className="block cursor-pointer rounded-xl border-2 border-dashed border-white/15 bg-[#0f0f15] px-4 py-10 text-center transition hover:border-violet-500/60">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="hidden"
                />
                {pdf ? (
                  <>
                    <div className="font-mono text-sm font-semibold text-gray-200">
                      {pdf.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {pdf.sizeKB} KB · click to replace
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-gray-200">Drop a PDF here</div>
                    <div className="mt-1 text-xs text-gray-500">or click to browse</div>
                  </>
                )}
              </label>
            )}
          </div>

          <div className="mt-6">
            <Eyebrow>02 — Task</Eyebrow>
            <div className="mt-3 flex flex-col gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
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

          {mode === "extract" && (
            <TemplateSelector
              selectedId={templateId}
              onSelect={setTemplateId}
              disabled={loading}
            />
          )}

          {mode === "ask" && (
            <div className="mt-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to know?"
                className="w-full rounded-xl border border-white/10 bg-[#0f0f15] p-4 text-sm text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !hasSource || (mode === "ask" && !question.trim())}
            className="mt-6 w-full rounded-xl bg-violet-500 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-400 disabled:opacity-40 disabled:shadow-none"
          >
            {loading ? "Processing…" : mode === "ask" ? "Ask" : "Process document"}
          </button>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </section>

        {/* OUTPUT — dossier */}
        <section>
          {/* perforated top edge */}
          <div
            className="h-3.5 rounded-t-2xl border border-b-0 border-white/10"
            style={{
              background:
                "radial-gradient(circle at 7px 0px, #0b0b10 5px, #15151c 5.5px)",
              backgroundSize: "18px 14px",
            }}
          />
          <div className="relative min-h-[320px] overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-[#15151c] p-5 shadow-xl shadow-black/40">
            <Eyebrow>03 — Output</Eyebrow>

            {!result && !loading && (
              <div className="mt-16 text-center text-sm text-gray-500">
                Results land here as a clean, structured dossier.
                <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-gray-600">
                  AWAITING INPUT
                </div>
                <button
                  onClick={loadSample}
                  className="mt-6 rounded-lg border border-white/10 px-4 py-2 font-mono text-[11px] text-gray-400 transition hover:border-violet-500/50 hover:text-violet-300"
                >
                  Try with a sample invoice
                </button>
              </div>
            )}

            {loading && (
              <div className="mt-4">
                {streamingText ? (
                  <div className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-gray-400">
                    {streamingText}
                    <span className="inline-block h-4 w-1.5 animate-pulse bg-violet-400" />
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {[92, 78, 96, 60, 84].map((w, i) => (
                      <div
                        key={i}
                        className="h-3 animate-pulse rounded bg-white/10"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                )}
                <div className="mt-3 font-mono text-[11px] tracking-[0.15em] text-gray-500">
                  {streamingText ? "STREAMING…" : "READING DOCUMENT…"}
                </div>
              </div>
            )}

            {result && (
              <>
                <div className="absolute right-5 top-5 -rotate-6 rounded border-2 border-violet-400/80 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.15em] text-violet-300">
                  PROCESSED
                </div>

                {result.mode === "summary" && (
                  <div className="mt-4">
                    <Row label="Summary">{result.data.summary}</Row>
                    <Row label="Key points">
                      <ul className="space-y-2">
                        {result.data.key_points?.map((p: string, i: number) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-violet-400">▸</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </Row>
                  </div>
                )}

                {result.mode === "extract" && (
                  <div className="mt-4">
                    <Row label="Type">
                      <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-violet-300">
                        {result.data.doc_type}
                      </span>
                    </Row>
                    <Row label="Dates">
                      {result.data.dates?.length
                        ? result.data.dates.map((d, i) => (
                            <div key={i} className="mb-1">
                              <b className="font-mono text-white">{d.date}</b>{" "}
                              <span className="text-gray-400">— {d.context}</span>
                            </div>
                          ))
                        : "—"}
                    </Row>
                    <Row label="Parties">
                      {result.data.parties?.length
                        ? result.data.parties.map((p, i) => (
                            <div key={i} className="mb-1">
                              <b className="text-white">{p.name}</b>{" "}
                              <span className="text-gray-400">({p.role})</span>
                            </div>
                          ))
                        : "—"}
                    </Row>
                    <Row label="Amounts">
                      {result.data.amounts?.length
                        ? result.data.amounts.map((a, i) => (
                            <div key={i} className="mb-1">
                              <b className="font-mono text-violet-300">{a.value}</b>{" "}
                              <span className="text-gray-400">— {a.context}</span>
                            </div>
                          ))
                        : "—"}
                    </Row>
                  </div>
                )}

                {result.mode === "extract-custom" && (
                  <div className="mt-4">
                    {result.templateFields.map((field) => (
                      <Row key={field} label={field}>
                        {result.data[field] ?? "\u2014"}
                      </Row>
                    ))}
                  </div>
                )}

                {result.mode === "ask" && (
                  <div className="mt-4">
                    <Row label="Question">{result.question}</Row>
                    <Row label="Answer">{result.data.answer}</Row>
                  </div>
                )}
                <div className="mt-4 flex justify-end gap-2 border-t border-dashed border-white/10 pt-3">
                  <button
                    onClick={copyJson}
                    className="rounded-lg px-3 py-1.5 font-mono text-[11px] text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
                  >
                    {copied ? "Copied!" : "Copy JSON"}
                  </button>
                  {(result.mode === "extract" || result.mode === "extract-custom") && (
                    <button
                      onClick={exportCsv}
                      className="rounded-lg px-3 py-1.5 font-mono text-[11px] text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
                    >
                      Export CSV
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      )}
      <footer className="mx-auto mt-10 flex max-w-5xl justify-center font-mono text-[11px] tracking-[0.1em] text-gray-600">
        <span>PDF + TEXT INPUT · STRUCTURED JSON OUTPUT</span>
      </footer>
    </div>
  );
}

