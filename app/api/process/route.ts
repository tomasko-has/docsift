const PROMPTS = {
    summary: `Summarize the document. Respond in English regardless of the document's language. Return ONLY JSON, no markdown fences, exactly in this shape:
  {"summary": "2-3 sentence summary", "key_points": ["3 to 5 key points"]}`,
  
    extract: `Extract structured data from the document. Respond in English regardless of the document's language. Return ONLY JSON, no markdown fences, exactly in this shape:
  {"doc_type": "type of document", "dates": [{"date": "...", "context": "what it refers to"}], "parties": [{"name": "...", "role": "..."}], "amounts": [{"value": "...", "context": "..."}]}
  Use empty arrays for missing data. Never invent data that is not in the document.`,
  };
  
  export async function POST(request: Request) {
    try {
      const {
        text,
        pdf,
        mode,
      }: { text?: string; pdf?: string; mode: "summary" | "extract" } =
        await request.json();
  
      if (!text && !pdf) {
        return Response.json({ error: "No document provided." }, { status: 400 });
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
            { type: "text", text: PROMPTS[mode] },
          ]
        : [
            {
              type: "text",
              text: `<document>\n${text}\n</document>\n\n${PROMPTS[mode]}`,
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
      return Response.json({ result: JSON.parse(raw) });
    } catch {
      return Response.json(
        { error: "Could not process the document. Please try again." },
        { status: 500 }
      );
    }
  }