import { after } from "next/server";
import { requireOwnedJob } from "@/lib/access";
import { completeMockJob, pollRunpodUntilDone, regenerateJob } from "@/lib/jobs";
import { creditErrorResponse, CreditError, withGenerationCredit } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireOwnedJob(id);
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    batch?: number;
  };

  try {
    const result = await withGenerationCredit(access.userId, () =>
      regenerateJob(id, {
        prompt: body.prompt,
        batch: body.batch,
      }),
    );
    after(async () => {
      try {
        if (result.mocked) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await completeMockJob(id);
          return;
        }
        await pollRunpodUntilDone(id);
      } catch (error) {
        console.error("Regenerate finalize failed", error);
      }
    });
    return Response.json({ ok: true, mocked: result.mocked });
  } catch (error) {
    if (error instanceof CreditError) return creditErrorResponse(error);
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Not found" ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
