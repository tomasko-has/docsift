# Ask a Question Mode — Design Spec

## What

A third mode "Ask a question" alongside Summarize and Extract data. The user provides a document and asks a free-text question about it. Claude answers in plain text.

## Backend (`app/api/process/route.ts`)

- New `ask` prompt in `PROMPTS` object. Returns JSON: `{"answer": "..."}`. Includes "Never invent data that is not in the document."
- Route accepts a new `question` parameter in the request body. For `ask` mode, the question is embedded in the prompt sent to Claude.
- Mode type expands to `"summary" | "extract" | "ask"`.
- Validation: if mode is `ask` and `question` is missing/empty, return 400 error.

## Frontend (`app/page.tsx`)

- `Mode` type expands to include `"ask"`.
- New entry in `MODES` array: `{ id: "ask", label: "Ask a question", hint: "Ask anything about the document" }`.
- New `question` state (string). A text input field appears below the task section only when `mode === "ask"`. Placeholder: "What would you like to know?"
- `handleSubmit` sends `question` in the request body when mode is `ask`.
- Result display in the dossier panel: two `Row` components — "Question" (what the user asked) and "Answer" (Claude's response).
- Copy JSON works for ask mode (already supported). Export CSV does not appear (already restricted to extract mode).

## Scope

- Modify: `app/api/process/route.ts` — new prompt, expanded types, question parameter
- Modify: `app/page.tsx` — new mode, question state, input field, result rendering
- No new files. No new dependencies.
