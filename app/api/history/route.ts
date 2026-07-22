import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request) {
  try {
    const body: {
      mode: string;
      inputName: string;
      question?: string;
      result: string;
    } = await request.json();

    if (!body.mode || !body.inputName || !body.result) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    const doc = await prisma.processedDocument.create({
      data: {
        mode: body.mode,
        inputName: body.inputName,
        question: body.question ?? null,
        result: body.result,
      },
    });

    return Response.json({ id: doc.id });
  } catch {
    return Response.json(
      { error: "Could not save to history." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const docs = await prisma.processedDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json({ history: docs });
  } catch {
    return Response.json(
      { error: "Could not load history." },
      { status: 500 }
    );
  }
}
