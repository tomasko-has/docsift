# Copy JSON / Export CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Copy JSON" and "Export CSV" buttons to the output panel so users can grab results in a usable format.

**Architecture:** Two client-side helper functions (`copyJson`, `exportCsv`) plus a small button row in the output section. No backend changes — clipboard and download are browser APIs. One new state variable (`copied`) drives the "Copied!" feedback.

**Tech Stack:** React (useState, Clipboard API), plain CSV string generation, Blob + URL.createObjectURL for download.

---

## File Map

- **Modify:** `app/page.tsx` — add state, helper functions, and button UI

No new files. No test files (this is a client-only UI feature with browser APIs — manual browser testing).

---

### Task 1: Add the `copied` state and `copyJson` helper

**Files:**
- Modify: `app/page.tsx:17` (add state)
- Modify: `app/page.tsx:31` (add helper function, before `handleFile`)

- [ ] **Step 1: Add `copied` state variable**

In `app/page.tsx`, after the existing state declarations (line 19), add:

```typescript
const [copied, setCopied] = useState(false);
```

- [ ] **Step 2: Add `copyJson` function**

In `app/page.tsx`, after the `copied` state line and before the `handleFile` function (line 21), add:

```typescript
async function copyJson() {
  if (!result) return;
  await navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}
```

- [ ] **Step 3: Verify the dev server still compiles**

Run: `npm run dev`
Expected: No compile errors. The app loads normally — no visible change yet since the button UI isn't added.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add copied state and copyJson helper for clipboard support"
```

---

### Task 2: Add the `exportCsv` helper

**Files:**
- Modify: `app/page.tsx` (add function after `copyJson`)

- [ ] **Step 1: Add `exportCsv` function**

In `app/page.tsx`, right after the `copyJson` function, add:

```typescript
function exportCsv() {
  if (!result || result.mode !== "extract") return;
  const d = result.data;
  const rows: string[][] = [["Section", "Field1", "Field2"]];

  for (const date of d.dates ?? []) {
    rows.push(["Dates", date.date, date.context]);
  }
  for (const party of d.parties ?? []) {
    rows.push(["Parties", party.name, party.role]);
  }
  for (const amount of d.amounts ?? []) {
    rows.push(["Amounts", amount.value, amount.context]);
  }

  // Wrap each cell in quotes and escape any quotes inside the value
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "docsift-extract.csv";
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verify the dev server still compiles**

Run: `npm run dev`
Expected: No compile errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add exportCsv helper for CSV download"
```

---

### Task 3: Add the action buttons to the output panel UI

**Files:**
- Modify: `app/page.tsx:193-194` (insert button row between the Eyebrow and the result content)

- [ ] **Step 1: Add button row in the output section**

In `app/page.tsx`, find this block (around line 193):

```tsx
<Eyebrow>03 — Output</Eyebrow>

            {!result && !loading && (
```

Replace with:

```tsx
<Eyebrow>03 — Output</Eyebrow>

            {result && (
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={copyJson}
                  className="rounded-lg px-3 py-1.5 font-mono text-[11px] text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
                >
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
                {result.mode === "extract" && (
                  <button
                    onClick={exportCsv}
                    className="rounded-lg px-3 py-1.5 font-mono text-[11px] text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
                  >
                    Export CSV
                  </button>
                )}
              </div>
            )}

            {!result && !loading && (
```

- [ ] **Step 2: Test in browser — summary mode**

1. Open http://localhost:3000
2. Paste any text, select "Summarize", click "Process document"
3. Verify: only "Copy JSON" button appears (no "Export CSV")
4. Click "Copy JSON" — text changes to "Copied!" for 2 seconds
5. Paste somewhere — should be formatted JSON with `summary` and `key_points`

- [ ] **Step 3: Test in browser — extract mode**

1. Paste any text (e.g. a short invoice), select "Extract data", click "Process document"
2. Verify: both "Copy JSON" and "Export CSV" buttons appear
3. Click "Copy JSON" — works the same as summary mode
4. Click "Export CSV" — browser downloads `docsift-extract.csv`
5. Open the CSV — should have Section/Field1/Field2 headers with correct data

- [ ] **Step 4: Test edge case — no result state**

1. Refresh the page (no result yet)
2. Verify: no buttons are visible, just the "AWAITING INPUT" placeholder

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add Copy JSON and Export CSV buttons to output panel"
```
