import { requireOwnedEvent } from "@/lib/access";
import {
  clampOverlayAxis,
  clampOverlayScale,
  isOverlayPlacement,
  matchingOverlayPlacement,
} from "@/lib/overlay";
import { getEventBranding, prisma, setDocumentFields } from "@/lib/prisma";
import { attachThemeLooks } from "@/lib/theme-looks-db";
import { clampBatch } from "@/lib/workflow";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      themes: { orderBy: { sortOrder: "asc" } },
      _count: { select: { jobs: true } },
    },
  });
  if (!event) return Response.json({ error: "Not found" }, { status: 404 });
  const branding = await getEventBranding(id);
  const themes = await attachThemeLooks(event.themes);
  return Response.json({
    event: {
      ...event,
      themes,
      allowUpload: branding.allowUpload,
      wallTitle: branding.wallTitle,
      showWallTitle: branding.showWallTitle,
      hasLogo: Boolean(branding.wallLogoKey),
      overlayEnabled: branding.overlayEnabled,
      hasOverlayLogo: Boolean(branding.overlayLogoKey),
      overlayPlacement: branding.overlayPlacement,
      overlayScale: branding.overlayScale,
      overlayX: branding.overlayX,
      overlayY: branding.overlayY,
      hasOverlaySample: Boolean(branding.overlaySampleKey),
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedEvent(id);
  if (!access.ok) return access.response;
  const body = (await request.json()) as {
    name?: string;
    eventDate?: string;
    status?: string;
    batch?: number;
    allowUpload?: boolean;
    wallTitle?: string;
    showWallTitle?: boolean;
    overlayEnabled?: boolean;
    overlayPlacement?: string;
    overlayScale?: number;
    overlayX?: number;
    overlayY?: number;
  };
  const data: {
    name?: string;
    eventDate?: Date;
    status?: string;
    batch?: number;
  } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.eventDate) {
    const eventDate = new Date(`${body.eventDate}T12:00:00.000Z`);
    if (Number.isNaN(eventDate.getTime())) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }
    data.eventDate = eventDate;
  }
  if (body.status && ["draft", "live", "archived"].includes(body.status)) {
    data.status = body.status;
  }
  if (body.batch != null) data.batch = clampBatch(body.batch, 1);
  try {
    const event =
      Object.keys(data).length > 0
        ? await prisma.event.update({ where: { id }, data })
        : await prisma.event.findUnique({ where: { id } });
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const extras: Record<string, unknown> = {};
    if (typeof body.allowUpload === "boolean") extras.allowUpload = body.allowUpload;
    if (typeof body.wallTitle === "string") extras.wallTitle = body.wallTitle.trim();
    if (typeof body.showWallTitle === "boolean") extras.showWallTitle = body.showWallTitle;
    if (typeof body.overlayEnabled === "boolean") extras.overlayEnabled = body.overlayEnabled;
    if (body.overlayScale != null) extras.overlayScale = clampOverlayScale(body.overlayScale);
    if (body.overlayX != null) extras.overlayX = clampOverlayAxis(body.overlayX, 0.5);
    if (body.overlayY != null) extras.overlayY = clampOverlayAxis(body.overlayY, 0.045);
    if (body.overlayX != null && body.overlayY != null) {
      extras.overlayPlacement =
        matchingOverlayPlacement(Number(extras.overlayX), Number(extras.overlayY)) || "custom";
    } else if (isOverlayPlacement(body.overlayPlacement)) {
      extras.overlayPlacement = body.overlayPlacement;
    }
    if (Object.keys(extras).length > 0) {
      await setDocumentFields("Event", id, extras);
    }
    const branding = await getEventBranding(id);
    return Response.json({
      event: {
        ...event,
        allowUpload: branding.allowUpload,
        wallTitle: branding.wallTitle,
        showWallTitle: branding.showWallTitle,
        hasLogo: Boolean(branding.wallLogoKey),
        overlayEnabled: branding.overlayEnabled,
        hasOverlayLogo: Boolean(branding.overlayLogoKey),
        overlayPlacement: branding.overlayPlacement,
        overlayScale: branding.overlayScale,
        overlayX: branding.overlayX,
        overlayY: branding.overlayY,
        hasOverlaySample: Boolean(branding.overlaySampleKey),
      },
    });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
