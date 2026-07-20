# Sample Document Button — Design Spec

## What

A "Try with a sample invoice" button in the output panel's empty state (AWAITING INPUT). Clicking it prefills the textarea with a sample invoice, switches to Paste text tab, and sets mode to Summarize. The user then clicks "Process document" themselves.

## Placement

In the output panel, below the "AWAITING INPUT" text. Only visible when there is no result and no loading state. Styled as a small, subtle button matching existing UI conventions.

## Behavior

On click:
1. Switch tab to "paste"
2. Fill textarea with sample invoice text
3. Set mode to "Summarize"

## Sample Text

```
INVOICE #2024-0042

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

Thank you for your business.
```

## Scope

- Only `app/page.tsx` — constant for sample text, button in empty state, click handler that sets tab/text/mode.
- No new files. No new dependencies.
