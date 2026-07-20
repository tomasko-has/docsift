# Copy JSON / Export CSV — Design Spec

## What

Two action buttons in the output panel, visible only when a result exists:

1. **Copy JSON** — available for both modes (summary + extract). Copies `result.data` as formatted JSON to clipboard. Button text changes to "Copied!" for 2 seconds as feedback.

2. **Export CSV** — available only for extract mode. Downloads a CSV file (`docsift-extract.csv`) with sections for dates, parties, amounts. Empty categories are skipped.

## Placement

Buttons sit in a row just below the "03 — Output" eyebrow, right-aligned. Styled small and subtle (`text-gray-400`, lighter on hover) to not disrupt the dossier look.

## Scope

- Only `app/page.tsx` changes — all logic is client-side (Clipboard API, CSV generation, download trigger).
- No new dependencies.
- Two helper functions inline in the file: `copyJson()` and `exportCsv()`.

## CSV Format

```
Section,Field1,Field2
Dates,2024-01-15,Invoice date
Dates,2024-02-15,Due date
Parties,Acme Corp,Seller
Parties,John Doe,Buyer
Amounts,$5000,Total due
```
