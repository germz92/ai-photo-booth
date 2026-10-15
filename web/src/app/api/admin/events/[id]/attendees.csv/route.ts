import { requireOwnedEvent } from "@/lib/access";
import { attachJobNames } from "@/lib/job-name";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function csvCell(value: string | null | undefined) {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvFilename(eventName: string) {
  const slug = eventName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "event"}-attendees.csv`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });

  const jobs = await prisma.job.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      emailStatus: true,
      smsStatus: true,
      createdAt: true,
      theme: { select: { title: true } },
    },
  });
  await attachJobNames(jobs);

  const header = ["Name", "Email", "Phone", "Theme", "Status", "Email status", "SMS status", "Submitted"];
  const rows = jobs.map((job) =>
    [
      job.name || "",
      job.email || "",
      job.phone || "",
      job.theme?.title || "",
      job.status,
      job.emailStatus,
      job.smsStatus,
      job.createdAt.toISOString(),
    ]
      .map((cell) => csvCell(cell))
      .join(","),
  );
  const csv = `\uFEFF${[header.join(","), ...rows].join("\r\n")}\r\n`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(event.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
