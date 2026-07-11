# DocSift — AI Document Intelligence

Upload a PDF or paste text — get an executive summary or clean structured
data (dates, parties, amounts) extracted by AI.

![screenshot](./screenshot.png)

## Features

- **PDF & text input** — PDFs are sent to Claude natively (works with scanned documents too)
- **Summarization** — executive summary + key points
- **Structured extraction** — dates, parties and amounts as validated JSON
- **Server-side API key** — the Anthropic key never reaches the browser
- **Error handling** — API failures surface as clear messages, never a frozen UI

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Anthropic API (Claude)

## Getting started

1. `npm install`
2. Create `.env.local` with `ANTHROPIC_API_KEY=your-key`
3. `npm run dev` and open http://localhost:3000
