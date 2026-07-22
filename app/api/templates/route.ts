import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.extractionTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ templates });
  } catch {
    return Response.json(
      { error: "Could not load templates." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: {
      name: string;
      fields: { name: string; description: string }[];
    } = await request.json();

    if (!body.name?.trim()) {
      return Response.json({ error: "Template name is required." }, { status: 400 });
    }
    if (!body.fields?.length) {
      return Response.json({ error: "At least one field is required." }, { status: 400 });
    }
    for (const f of body.fields) {
      if (!f.name?.trim()) {
        return Response.json({ error: "Each field must have a name." }, { status: 400 });
      }
    }

    const template = await prisma.extractionTemplate.create({
      data: {
        name: body.name.trim(),
        fields: JSON.stringify(body.fields),
      },
    });

    return Response.json({ id: template.id });
  } catch {
    return Response.json(
      { error: "Could not create template." },
      { status: 500 }
    );
  }
}
