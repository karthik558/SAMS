import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_PROXY_URL = (import.meta.env.VITE_SUPABASE_PROXY_URL as string | undefined) || 
  (typeof window !== 'undefined' ? `${window.location.origin}/api/proxy-supabase` : "/api/proxy-supabase");
const USE_SUPABASE_PROXY = (import.meta.env.VITE_USE_SUPABASE_PROXY as any) !== 'false';

export const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function shouldProxy(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.protocol === "https:") &&
      (u.hostname.endsWith(".supabase.co") || u.hostname.endsWith(".supabase.in"))
    );
  } catch {
    return false;
  }
}

const nativeFetch: typeof fetch | undefined = typeof globalThis !== "undefined" ? globalThis.fetch.bind(globalThis) : undefined;

function abToBase64(ab: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(ab);
  const chunkSize = 0x8000; // 32KB chunks to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return typeof btoa === "function" ? btoa(binary) : "";
}

function strToBase64(s: string): string {
  try {
    return typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : "";
  } catch {
    return "";
  }
}

export const supabase = hasSupabaseEnv
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        // Route Supabase network calls through a same-origin proxy to avoid enterprise CORS/proxy issues
        fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          try {
            const isReqObj = typeof Request !== "undefined" && input instanceof Request;
            const url = isReqObj
              ? (input as Request).url
              : (typeof input === "string" ? input : (input as URL).toString());
            if (!USE_SUPABASE_PROXY || !shouldProxy(url) || !nativeFetch) {
              return nativeFetch ? nativeFetch(input as any, init) : fetch(input as any, init);
            }

            // Normalize headers to a simple object
            const hdrsObj: Record<string, string> = {};
            const srcHeaders = new Headers(undefined);
            // Merge headers from Request object (if any) then override with init.headers
            if (isReqObj) {
              (input as Request).headers.forEach((v, k) => { srcHeaders.set(k, v); });
            }
            if (init?.headers) {
              new Headers(init.headers).forEach((v, k) => { srcHeaders.set(k, v); });
            }
            srcHeaders.forEach((v, k) => { hdrsObj[k] = v; });

            // Prepare body as base64 to pass through JSON
            let bodyBase64: string | null = null;
            const hasInitBody = init && typeof init.body !== 'undefined' && init.body !== null;
            const bAny: any = hasInitBody ? (init as any).body : null;
            if (bAny) {
              const b: any = bAny as any;
              if (typeof b === "string") {
                bodyBase64 = strToBase64(b);
              } else if (b instanceof ArrayBuffer) {
                bodyBase64 = abToBase64(b);
              } else if (ArrayBuffer.isView(b)) {
                const buf = b.buffer as ArrayBuffer | SharedArrayBuffer;
                const start = b.byteOffset;
                const end = b.byteOffset + b.byteLength;
                const segment = buf instanceof ArrayBuffer ? buf.slice(start, end) : new Uint8Array(buf as SharedArrayBuffer).slice(start, end).buffer;
                bodyBase64 = abToBase64(segment);
              } else if (b instanceof Blob) {
                const ab = await b.arrayBuffer();
                bodyBase64 = abToBase64(ab);
              } else {
                // As a last resort, try JSON-stringify
                try { bodyBase64 = strToBase64(JSON.stringify(b)); } catch {}
              }
            }

            const resp = await nativeFetch(SUPABASE_PROXY_URL, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                url,
                method: init?.method || (isReqObj ? (input as Request).method : "GET"),
                headers: hdrsObj,
                bodyBase64,
              }),
            });
            // If proxy is unavailable (404) or returns non-OK, try direct as a best-effort fallback
            if (!resp.ok) {
              try { console.warn("Supabase proxy returned status", resp.status); } catch {}
              return nativeFetch(input as any, init);
            }
            return resp;
          } catch {
            // Fallback to direct fetch if proxy path fails in unexpected contexts
            return nativeFetch ? nativeFetch(input as any, init) : fetch(input as any, init);
          }
        },
      },
    })
  : (null as any);

export const supabaseConfigStatus = {
  urlPresent: Boolean(SUPABASE_URL),
  keyPresent: Boolean(SUPABASE_ANON_KEY),
  hasEnv: hasSupabaseEnv,
};

if (!hasSupabaseEnv && typeof window !== 'undefined') {
  // Helpful console hint during development
  // eslint-disable-next-line no-console
  console.warn("Supabase env not set: ", {
    urlPresent: Boolean(SUPABASE_URL),
    keyPresent: Boolean(SUPABASE_ANON_KEY),
  });
}
