import { acceptPasswordReset, creditErrorResponse, lookupReset } from "@/lib/users";

export const runtime = "nodejs";

const TOKEN = /^[a-f0-9]{64}$/;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!TOKEN.test(token)) {
    return Response.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  const user = await lookupReset(token);
  if (!user) {
    return Response.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  return Response.json({ email: user.email });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  const token = String(body.token || "");
  if (!TOKEN.test(token)) {
    return Response.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  try {
    await acceptPasswordReset(token, String(body.password || ""));
    return Response.json({ ok: true });
  } catch (error) {
    return creditErrorResponse(error);
  }
}
