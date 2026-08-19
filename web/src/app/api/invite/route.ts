import { acceptInvite, creditErrorResponse, lookupInvite } from "@/lib/users";

export const runtime = "nodejs";

const TOKEN = /^[a-f0-9]{64}$/;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!TOKEN.test(token)) {
    return Response.json({ error: "Invalid or expired invite" }, { status: 400 });
  }
  const user = await lookupInvite(token);
  if (!user) {
    return Response.json({ error: "Invalid or expired invite" }, { status: 400 });
  }
  return Response.json({ email: user.email, name: user.name });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
    name?: string;
  };
  const token = String(body.token || "");
  if (!TOKEN.test(token)) {
    return Response.json({ error: "Invalid or expired invite" }, { status: 400 });
  }
  try {
    const user = await acceptInvite(token, String(body.password || ""), body.name);
    return Response.json({ ok: true, email: user?.email });
  } catch (error) {
    return creditErrorResponse(error);
  }
}
