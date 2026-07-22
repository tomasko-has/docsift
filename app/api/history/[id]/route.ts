import { prisma } from "@/app/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.processedDocument.delete({ where: { id } });
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "Record not found." }, { status: 404 });
  }
}
