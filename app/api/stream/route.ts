import { checkRateLimit, rateLimitResponse } from "@/app/api/rate-limit";
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
      templateId,
    }: { text?: string; pdf?: string; mode: "summary" | "extract" | "ask"; question?: string; templateId?: string } =
      await request.json();

    if (!text && !pdf) {
      return Response.json({ error: "No document provided." }, { status: 400 });
    }

    if (mode === "ask" && !question?.trim()) {
      return Response.json({ error: "Please enter a question." }, { status: 400 });
    }

    // For extract mode with a template, build a dynamic prompt
    let prompt: string;
    if (mode === "ask") {
      prompt = `${PROMPTS[mode]}\n\nQuestion: ${question}`;
    } else if (mode === "extract" && templateId) {
      const templateData = await loadTemplatePrompt(templateId);
      prompt = templateData ? templateData.prompt : PROMPTS[mode];
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

    // Call Anthropic with streaming enabled
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
        stream: true,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok || !res.body) {
      const errData = await res.json().catch(() => null);
      const msg = errData?.error?.message ?? "AI service unavailable.";
      return Response.json({ error: `AI service error: ${msg}` }, { status: 502 });
    }

    // Forward Anthropic's SSE stream, extracting only the text deltas.
    // The client receives plain text chunks — no SSE framing needed,
    // just a ReadableStream of UTF-8 text that builds up the JSON output.
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last (possibly incomplete) line in the buffer
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6);
              if (payload === "[DONE]") continue;

              try {
                const event = JSON.parse(payload);
                if (
                  event.type === "content_block_delta" &&
                  event.delta?.type === "text_delta"
                ) {
                  controller.enqueue(encoder.encode(event.delta.text));
                }
              } catch {
                // Skip malformed SSE lines
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  } catch {
    return Response.json(
      { error: "Could not process the document. Please try again." },
      { status: 500 }
    );
  }
}
