"use client";

import { useState, useEffect } from "react";
import { Eyebrow, Row } from "@/app/ui";

type HistoryRecord = {
  id: string;
  mode: string;
  inputName: string;
  question: string | null;
  result: string;
  createdAt: string;
};

export default function HistoryView() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/history");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRecords(data.history);
    } catch {
      setError("Could not load history.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecord(id: string) {
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      setError("Could not delete record.");
    }
  }

  function renderResult(record: HistoryRecord) {
    try {
      const data = JSON.parse(record.result);

      if (record.mode === "summary") {
        return (
          <div>
            <Row label="Summary">{data.summary}</Row>
            <Row label="Key points">
              <ul className="space-y-2">
                {data.key_points?.map((p: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-violet-400">&#9656;</span>
                    {p}
                  </li>
                ))}
              </ul>
            </Row>
          </div>
        );
      }

      if (record.mode === "extract") {
        // Check if this is a custom template result (flat key-value, no doc_type)
        // or a standard extract result (has doc_type, dates, parties, amounts)
        const isStandardExtract = "doc_type" in data && "dates" in data;

        if (isStandardExtract) {
          return (
            <div>
              <Row label="Type">
                <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-violet-300">
                  {data.doc_type}
                </span>
              </Row>
              <Row label="Dates">
                {data.dates?.length
                  ? data.dates.map(
                      (d: { date: string; context: string }, i: number) => (
                        <div key={i} className="mb-1">
                          <b className="font-mono text-white">{d.date}</b>{" "}
                          <span className="text-gray-400">&mdash; {d.context}</span>
                        </div>
                      )
                    )
                  : "\u2014"}
              </Row>
              <Row label="Parties">
                {data.parties?.length
                  ? data.parties.map(
                      (p: { name: string; role: string }, i: number) => (
                        <div key={i} className="mb-1">
                          <b className="text-white">{p.name}</b>{" "}
                          <span className="text-gray-400">({p.role})</span>
                        </div>
                      )
                    )
                  : "\u2014"}
              </Row>
              <Row label="Amounts">
                {data.amounts?.length
                  ? data.amounts.map(
                      (a: { value: string; context: string }, i: number) => (
                        <div key={i} className="mb-1">
                          <b className="font-mono text-violet-300">{a.value}</b>{" "}
                          <span className="text-gray-400">&mdash; {a.context}</span>
                        </div>
                      )
                    )
                  : "\u2014"}
              </Row>
            </div>
          );
        }

        // Custom template result — flat key-value object
        return (
          <div>
            {Object.entries(data as Record<string, string | null>).map(
              ([key, val]) => (
                <Row key={key} label={key}>
                  {(val as string) ?? "\u2014"}
                </Row>
              )
            )}
          </div>
        );
      }

      if (record.mode === "ask") {
        return (
          <div>
            <Row label="Question">{record.question ?? "\u2014"}</Row>
            <Row label="Answer">{data.answer}</Row>
          </div>
        );
      }

      return <pre className="text-xs text-gray-400">{record.result}</pre>;
    } catch {
      return <pre className="text-xs text-gray-400">{record.result}</pre>;
    }
  }

  const modeLabel: Record<string, string> = {
    summary: "Summary",
    extract: "Extract",
    ask: "Ask",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#15151c] p-5 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between">
        <Eyebrow>Processing history</Eyebrow>
        {records.length > 0 && (
          <button
            onClick={loadHistory}
            className="font-mono text-[11px] text-gray-500 transition hover:text-gray-300"
          >
            Refresh
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-8 space-y-4">
          {[92, 78, 96].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-white/10"
              style={{ width: `${w}%` }}
            />
          ))}
          <div className="font-mono text-[11px] tracking-[0.15em] text-gray-500">
            LOADING HISTORY...
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="mt-12 text-center text-sm text-gray-500">
          No documents processed yet.
          <div className="mt-2 font-mono text-[11px] tracking-[0.15em] text-gray-600">
            EMPTY
          </div>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="mt-4 space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="rounded-xl border border-white/10 bg-[#0f0f15] transition"
            >
              {/* Header row — always visible */}
              <div
                onClick={() =>
                  setExpandedId(expandedId === record.id ? null : record.id)
                }
                className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 rounded-md bg-violet-500/20 px-2 py-0.5 font-mono text-[11px] text-violet-300">
                    {modeLabel[record.mode] ?? record.mode}
                  </span>
                  <span className="truncate text-sm text-gray-200">
                    {record.inputName}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[11px] text-gray-500">
                    {new Date(record.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRecord(record.id);
                    }}
                    className="text-gray-500 transition hover:text-red-400"
                    title="Delete"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Expanded result */}
              {expandedId === record.id && (
                <div className="border-t border-white/10 px-4 py-3">
                  {renderResult(record)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
