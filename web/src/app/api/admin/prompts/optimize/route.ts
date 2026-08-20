import { requireAdmin, unauthorized } from "@/lib/admin";
import { optimizeQwenPrompt } from "@/lib/optimize-qwen-prompt";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  const body = (await request.json()) as {
    prompt?: unknown;
    look?: unknown;
    hint?: unknown;
    adaptLook?: unknown;
  };
  try {
    const prompt = await optimizeQwenPrompt({
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      look: typeof body.look === "string" ? body.look : "",
      hint: typeof body.hint === "string" ? body.hint : "",
      adaptLook: body.adaptLook === true,
    });
    return Response.json({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not optimize prompt";
    const status = message.includes("OPENAI_API_KEY") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
