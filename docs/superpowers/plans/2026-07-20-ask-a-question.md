# Ask a Question Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "Ask a question" mode that lets users ask free-text questions about their document and get a plain-text answer.

**Architecture:** Add an `ask` prompt to the backend route, accept a `question` parameter, and return `{"answer": "..."}`. On the frontend, extend the Mode type, add a question input that appears when ask mode is selected, send the question with the request, and render the Q&A result in the dossier panel.

**Tech Stack:** Same stack — Next.js route handler, Anthropic API, React client component.

---

## File Map

- **Modify:** `app/api/process/route.ts` — add `ask` prompt, accept `question` param, validate
- **Modify:** `app/page.tsx` — extend Mode type, add question state/input, update handleSubmit, render ask result

---

### Task 1: Add the `ask` prompt and `question` support to the backend route

**Files:**
- Modify: `app/api/process/route.ts`

- [ ] **Step 1: Add the `ask` prompt to the PROMPTS object**

In `app/api/process/route.ts`, find the `PROMPTS` object (lines 1-8). Add the `ask` entry after `extract`:

```typescript
const PROMPTS = {
    summary: `Summarize the document. Respond in English regardless of the document's language. Return ONLY JSON, no markdown fences, exactly in this shape:
  {"summary": "2-3 sentence summary", "key_points": ["3 to 5 key points"]}`,
  
    extract: `Extract structured data from the document. Respond in English regardless of the document's language. Return ONLY JSON, no markdown fences, exactly in this shape:
  {"doc_type": "type of document", "dates": [{"date": "...", "context": "what it refers to"}], "parties": [{"name": "...", "role": "..."}], "amounts": [{"value": "...", "context": "..."}]}
  Use empty arrays for missing data. Never invent data that is not in the document.`,

    ask: `Answer the following question about the document. Respond in English regardless of the document's language. Return ONLY JSON, no markdown fences, exactly in this shape:
  {"answer": "your answer here"}
  Base your answer only on the document content. Never invent data that is not in the document. If the document does not contain enough information to answer, say so.`,
  };
```

- [ ] **Step 2: Expand the mode type and add `question` to the destructured body**

Find the destructuring block (lines 12-17):

```typescript
      const {
        text,
        pdf,
        mode,
      }: { text?: string; pdf?: string; mode: "summary" | "extract" } =
        await request.json();
```

Replace with:

```typescript
      const {
        text,
        pdf,
        mode,
        question,
      }: { text?: string; pdf?: string; mode: "summary" | "extract" | "ask"; question?: string } =
        await request.json();
```

- [ ] **Step 3: Add validation for ask mode missing question**

After the `if (!text && !pdf)` check (line 19-21), add:

```typescript
      if (mode === "ask" && !question?.trim()) {
        return Response.json({ error: "Please enter a question." }, { status: 400 });
      }
```

- [ ] **Step 4: Include the question in the prompt for ask mode**

The prompt needs the user's question appended. Find the `content` building block (lines 23-40). Replace it with:

```typescript
      // For ask mode, append the user's question to the prompt
      const prompt = mode === "ask"
        ? `${PROMPTS[mode]}\n\nQuestion: ${question}`
        : PROMPTS[mode];

      const content = pdf
        ? [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf,
              },
            },
            { type: "text", text: prompt },
          ]
        : [
            {
              type: "text",
              text: `<document>\n${text}\n</document>\n\n${prompt}`,
            },
          ];
```

- [ ] **Step 5: Verify the dev server still compiles**

Run: `npm run build`
Expected: No compile errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/process/route.ts
git commit -m "feat: add ask prompt and question support to process route"
```

---

### Task 2: Add the ask mode, question input, and result rendering to the frontend

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Extend the Mode type and MODES array**

In `app/page.tsx`, find line 5:

```typescript
type Mode = "summary" | "extract";
```

Replace with:

```typescript
type Mode = "summary" | "extract" | "ask";
```

Then find the `MODES` array (lines 7-10):

```typescript
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "summary", label: "Summarize", hint: "Executive summary + key points" },
  { id: "extract", label: "Extract data", hint: "Dates, parties, amounts" },
];
```

Replace with:

```typescript
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "summary", label: "Summarize", hint: "Executive summary + key points" },
  { id: "extract", label: "Extract data", hint: "Dates, parties, amounts" },
  { id: "ask", label: "Ask a question", hint: "Ask anything about the document" },
];
```

- [ ] **Step 2: Add the `question` state**

After the `copied` state (line 20), add:

```typescript
const [question, setQuestion] = useState("");
```

- [ ] **Step 3: Add the question input field in the UI**

Find the closing `</div>` of the task section (line 200-201):

```tsx
            </div>
          </div>
```

After the task `</div>` block (after line 201) and before the submit button (line 203), add:

```tsx
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
```

- [ ] **Step 4: Update the submit button disabled condition**

Find the submit button (line 203-209). The `disabled` prop currently checks `loading || !hasSource`. For ask mode, we also need a question. Find:

```tsx
            disabled={loading || !hasSource}
```

Replace with:

```tsx
            disabled={loading || !hasSource || (mode === "ask" && !question.trim())}
```

- [ ] **Step 5: Update `handleSubmit` to send the question**

Find the body of the fetch call (lines 79-81):

```typescript
        body: JSON.stringify(
          tab === "pdf" && pdf ? { pdf: pdf.data, mode } : { text, mode }
        ),
```

Replace with:

```typescript
        body: JSON.stringify(
          tab === "pdf" && pdf
            ? { pdf: pdf.data, mode, ...(mode === "ask" && { question }) }
            : { text, mode, ...(mode === "ask" && { question }) }
        ),
```

- [ ] **Step 6: Update the result to store the question for display**

Find where the result is set (line 88):

```typescript
        setResult({ mode, data: data.result });
```

Replace with:

```typescript
        setResult({ mode, data: data.result, ...(mode === "ask" && { question }) });
```

- [ ] **Step 7: Add the ask result rendering in the dossier panel**

Find the closing of the extract result block (line 316):

```tsx
                )}
```

After the extract block's closing `)}` (line 316) and before the action buttons div (line 317), add:

```tsx
                {result.mode === "ask" && (
                  <div className="mt-4">
                    <Row label="Question">{result.question}</Row>
                    <Row label="Answer">{result.data.answer}</Row>
                  </div>
                )}
```

- [ ] **Step 8: Verify the dev server compiles**

Run: `npm run build`
Expected: No compile errors.

- [ ] **Step 9: Test in browser — ask mode**

1. Open http://localhost:3000
2. Paste text: "This is an invoice from Acme Corp for $5000 dated January 15, 2024"
3. Select "Ask a question" — a text input should appear
4. Type: "Who is the invoice from?"
5. The "Process document" button should be enabled
6. Click it — wait for result
7. Dossier should show "Question: Who is the invoice from?" and "Answer: ..." rows
8. "Copy JSON" button should appear, "Export CSV" should NOT appear

- [ ] **Step 10: Test edge case — empty question**

1. Select "Ask a question" mode, leave the question field empty
2. The "Process document" button should be disabled (grayed out)

- [ ] **Step 11: Run lint**

Run: `npm run lint`
Expected: Same pre-existing `any` warnings only, no new errors.

- [ ] **Step 12: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add Ask a Question mode with question input and result display"
```
