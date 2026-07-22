# DocSift — AI Document Intelligence

Upload a PDF or paste text — get an executive summary, structured data, or answers to your questions, all powered by AI.

**Live demo:** [docsift.onrender.com](https://docsift.onrender.com)

![screenshot](./screenshot.png)

## Features

- **PDF & text input** — PDFs are sent to Claude natively (works with scanned documents too)
- **Summarization** — executive summary + key points
- **Structured extraction** — dates, parties and amounts as validated JSON
- **Custom extraction templates** — define your own fields (e.g. "invoice number", "IBAN") and the AI extracts exactly what you need
- **Ask a question** — ask anything about the document and get a grounded answer
- **Batch processing** — upload up to 20 PDFs and process them all at once
- **Streaming responses** — see results appear token by token in real time
- **Processing history** — past results are saved and browsable (SQLite via Prisma)
- **CSV export** — export extracted data as CSV (single doc and batch)
- **Rate limiting** — 10 requests/min per IP to protect the API key
- **Server-side API key** — the Anthropic key never reaches the browser
- **Zod validation** — AI output is validated against typed schemas

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Anthropic API (Claude) · Prisma + SQLite · Zod

## Getting started

1. `npm install`
2. Create `.env.local` with `ANTHROPIC_API_KEY=your-key`
3. Create `.env` with `DATABASE_URL="file:./dev.db"`
4. `npx prisma migrate dev` to set up the database
5. `npm run dev` and open http://localhost:3000
