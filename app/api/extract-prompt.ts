import * as z from "zod";
import { prisma } from "@/app/lib/prisma";

export type TemplateField = { name: string; description: string };

// The hardcoded extract prompt used when no template is selected
export const DEFAULT_EXTRACT_PROMPT = `Extract structured data from the document. Respond in English regardless of the document's language. Return ONLY JSON, no markdown fences, exactly in this shape:
{"doc_type": "type of document", "dates": [{"date": "...", "context": "what it refers to"}], "parties": [{"name": "...", "role": "..."}], "amounts": [{"value": "...", "context": "..."}]}
Use empty arrays for missing data. Never invent data that is not in the document.`;

// Build a dynamic extract prompt from template fields.
// AI returns a flat JSON object with field names as keys.
export function buildCustomExtractPrompt(fields: TemplateField[]): string {
  const fieldLines = fields
    .map((f) => f.description ? `- ${f.name}: ${f.description}` : `- ${f.name}`)
    .join("\n");

  return `Extract these fields from the document. Respond in English regardless of the document's language. Return ONLY JSON, no markdown fences, with these exact field names as keys:

${fieldLines}

If a field's value is not found in the document, use null. Never invent data that is not in the document.`;
}

// Build a Zod schema dynamically from template fields.
// Each field maps to z.string().nullable().
export function buildCustomSchema(fields: TemplateField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    shape[f.name] = z.string().nullable();
  }
  return z.object(shape);
}

// Load a template by ID and return the prompt + validator.
// Returns null if templateId is not provided (use default behavior).
export async function loadTemplatePrompt(templateId?: string) {
  if (!templateId) return null;

  const template = await prisma.extractionTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) return null;

  const fields: TemplateField[] = JSON.parse(template.fields);
  return {
    prompt: buildCustomExtractPrompt(fields),
    schema: buildCustomSchema(fields),
    fields,
  };
}
