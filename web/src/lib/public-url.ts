function hostnameOf(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

export function isLocalHostUrl(value: string) {
  const host = hostnameOf(value);
  return host === "localhost" || host === "127.0.0.1";
}

function cleanUrl(value?: string | null) {
  return String(value || "").trim().replace(/\/$/, "");
}

/** Public origin for links, webhooks, and Auth.js. Never localhost in production. */
export function publicAppUrl() {
  const candidates = [
    process.env.APP_URL,
    process.env.AUTH_URL,
    process.env.RENDER_EXTERNAL_URL,
  ];
  const production = process.env.NODE_ENV === "production";
  for (const candidate of candidates) {
    const url = cleanUrl(candidate);
    if (!url) continue;
    if (production && isLocalHostUrl(url)) continue;
    return url;
  }
  return production ? "" : "http://localhost:3000";
}

export function applyProductionAuthUrl() {
  if (process.env.NODE_ENV !== "production") return;
  const url = publicAppUrl();
  if (!url || isLocalHostUrl(url)) return;
  process.env.AUTH_URL = url;
  process.env.NEXTAUTH_URL = url;
  if (!process.env.APP_URL || isLocalHostUrl(process.env.APP_URL)) {
    process.env.APP_URL = url;
  }
}
