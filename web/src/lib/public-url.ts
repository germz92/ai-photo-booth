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

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Public origin for links, webhooks, and Auth.js. Local stays local; production never uses localhost. */
export function publicAppUrl() {
  if (!isProduction()) {
    const local = cleanUrl(process.env.APP_URL);
    if (local && isLocalHostUrl(local)) return local;
    return "http://localhost:3000";
  }

  const candidates = [process.env.APP_URL, process.env.AUTH_URL, process.env.RENDER_EXTERNAL_URL];
  for (const candidate of candidates) {
    const url = cleanUrl(candidate);
    if (!url || isLocalHostUrl(url)) continue;
    return url;
  }
  return "";
}

export function applyAuthUrlForEnvironment() {
  const url = publicAppUrl();
  if (!url) return;
  process.env.AUTH_URL = url;
  process.env.NEXTAUTH_URL = url;
  if (isProduction() && (!process.env.APP_URL || isLocalHostUrl(process.env.APP_URL))) {
    process.env.APP_URL = url;
  }
}
