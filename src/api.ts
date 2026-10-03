let csrf = "";
export function setCsrf(value: string) { csrf = value; }

/** Only committed backend responses may acknowledge application operations. */
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", csrf);
  const response = await fetch(path.startsWith("/api") ? path : `/api/v1${path}`, { ...options, headers, credentials: "include" });
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please retry.`;
    try {
      const data = await response.json();
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
    } catch { /* Preserve HTTP failure when a proxy returns HTML. */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`API endpoint returned non-JSON response (${type || "unknown"}). Check the backend deployment.`);
  return await response.json() as T;
}
