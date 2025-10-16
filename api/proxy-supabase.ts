// Note: avoiding @vercel/node type import to prevent local type errors.

// Only allow proxying to Supabase domains to avoid open-proxy abuse
function isAllowedTarget(url: string): boolean {
  try {
    const u = new URL(url);
    const allowedHostSuffixes = [
      ".supabase.co",
      ".supabase.in",
    ];
    return (
      (u.protocol === "https:") &&
      allowedHostSuffixes.some((sfx) => u.hostname.endsWith(sfx))
    );
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  // Basic CORS handling (also for corporate proxies doing strict checks)
  const origin = req.headers?.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  const reqHdrs = req.headers?.["access-control-request-headers"]; // may be string or undefined
  res.setHeader("Access-Control-Allow-Headers", typeof reqHdrs === 'string' && reqHdrs ? reqHdrs : "content-type, authorization, apikey");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const { url, method, headers, bodyBase64 } = (req.body || {}) as {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
      bodyBase64?: string | null;
    };

    if (!url || !method) {
      return res.status(400).json({ error: "Missing url or method" });
    }
    if (!isAllowedTarget(url)) {
      return res.status(403).json({ error: "Target not allowed" });
    }

    // Filter out forbidden/request-specific headers
    const outgoingHeaders = new Headers();
    if (headers && typeof headers === "object") {
      for (const [k, v] of Object.entries(headers)) {
        const key = k.toLowerCase();
        if ([
          "host",
          "content-length",
          "connection",
          "accept-encoding",
          "x-forwarded-for",
          "x-forwarded-host",
          "x-forwarded-proto",
          "via",
          "origin",
          "referer",
        ].includes(key)) {
          continue;
        }
        // Only set string header values
        if (typeof v === "string") outgoingHeaders.set(k, v);
      }
    }

    const body = bodyBase64 ? Buffer.from(bodyBase64, "base64") : undefined;

    const resp = await fetch(url, {
      method,
      headers: outgoingHeaders,
      body,
    });

    // Mirror status and content headers
    const respBuffer = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    res.status(resp.status);
    res.setHeader("Content-Type", contentType);
    // Optionally forward cache headers
    const cacheControl = resp.headers.get("cache-control");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    return res.send(respBuffer);
  } catch (err: any) {
    return res.status(502).json({ error: "Upstream fetch failed", detail: String(err?.message || err) });
  }
}
