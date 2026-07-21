import * as z from "zod";

// --- Schemas for each AI response mode ---

export const SummaryResult = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
});

export const ExtractResult = z.object({
  doc_type: z.string(),
  dates: z.array(z.object({ date: z.string(), context: z.string() })),
  parties: z.array(z.object({ name: z.string(), role: z.string() })),
  amounts: z.array(z.object({ value: z.string(), context: z.string() })),
});

export const AskResult = z.object({
  answer: z.string(),
});

// --- Inferred TypeScript types ---

export type SummaryResult = z.infer<typeof SummaryResult>;
export type ExtractResult = z.infer<typeof ExtractResult>;
export type AskResult = z.infer<typeof AskResult>;

// Union type for any valid AI result
export type AiResult = SummaryResult | ExtractResult | AskResult;

// Validates parsed JSON against the correct schema for the given mode.
// Throws a ZodError if the AI returned something unexpected.
export function validateResult(mode: "summary" | "extract" | "ask", data: unknown) {
  const schemas = { summary: SummaryResult, extract: ExtractResult, ask: AskResult };
  return schemas[mode].parse(data);
}
