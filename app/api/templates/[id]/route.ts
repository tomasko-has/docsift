import { prisma } from "@/app/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body: {
      name?: string;
      fields?: { name: string; description: string }[];
    } = await request.json();

    const data: { name?: string; fields?: string } = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.fields !== undefined) data.fields = JSON.stringify(body.fields);

    if (Object.keys(data).length === 0) {
      return Response.json({ error: "Nothing to update." }, { status: 400 });
    }

    await prisma.extractionTemplate.update({ where: { id }, data });
    return Response.json({ updated: true });
  } catch {
    return Response.json({ error: "Could not update template." }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.extractionTemplate.delete({ where: { id } });
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "Template not found." }, { status: 404 });
  }
}
