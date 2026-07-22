import { validateResult } from "@/app/schemas";
import { checkRateLimit, rateLimitResponse } from "@/app/api/rate-limit";
import { prisma } from "@/app/lib/prisma";
import { loadTemplatePrompt } from "@/app/api/extract-prompt";

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
  
  export async function POST(request: Request) {
    const limit = checkRateLimit(request);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs!);

    try {
      const {
        text,
        pdf,
        mode,
        question,
        fileName,
        templateId,
      }: { text?: string; pdf?: string; mode: "summary" | "extract" | "ask"; question?: string; fileName?: string; templateId?: string } =
        await request.json();

      if (!text && !pdf) {
        return Response.json({ error: "No document provided." }, { status: 400 });
      }

      if (mode === "ask" && !question?.trim()) {
        return Response.json({ error: "Please enter a question." }, { status: 400 });
      }

      // For extract mode with a template, build a dynamic prompt
      let prompt: string;
      let templateData: Awaited<ReturnType<typeof loadTemplatePrompt>> = null;

      if (mode === "extract" && templateId) {
        templateData = await loadTemplatePrompt(templateId);
      }

      if (mode === "ask") {
        prompt = `${PROMPTS[mode]}\n\nQuestion: ${question}`;
      } else if (mode === "extract" && templateData) {
        prompt = templateData.prompt;
      } else {
        prompt = PROMPTS[mode];
      }

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
  
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content }],
        }),
      });
  
      const data = await res.json();
  
      if (data.error) {
        return Response.json(
          { error: `AI service error: ${data.error.message}` },
          { status: 502 }
        );
      }
  
      const raw = data.content[0].text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);

      // Use custom schema for template-based extraction, standard schema otherwise
      const result = templateData
        ? templateData.schema.parse(parsed)
        : validateResult(mode, parsed);

      // Save to history — fileName comes from batch view, fallback to generic name
      const inputName = fileName ?? (pdf ? "Uploaded PDF" : "Pasted text");
      await prisma.processedDocument.create({
        data: {
          mode,
          inputName,
          question: mode === "ask" ? question : null,
          result: JSON.stringify(result),
        },
      });

      return Response.json({ result });
    } catch {
      return Response.json(
        { error: "Could not process the document. Please try again." },
        { status: 500 }
      );
    }
  }