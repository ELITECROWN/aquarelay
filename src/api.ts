let csrf = "";
export function setCsrf(value: string) { csrf = value; }

/** Only committed backend responses may acknowledge application operations. */
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", csrf);
  const read = method === 'GET' || method === 'HEAD';
  let response: Response | undefined;
  for (let attempt = 0; attempt < (read ? 3 : 1); attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, {once:true});
    if (options.signal?.aborted) abort();
    const timer = setTimeout(() => controller.abort(), read ? 25000 : 120000);
    try {
      response = await fetch(path.startsWith("/api") ? path : `/api/v1${path}`, { ...options, headers, credentials: "include", signal: controller.signal });
      if (!read || ![502,503,504].includes(response.status) || attempt === 2) break;
    } catch (error) {
      if (options.signal?.aborted || !read || attempt === 2) {
        if (controller.signal.aborted && !options.signal?.aborted) throw new Error('Connection timed out. Please try again; the server may be starting.');
        throw error;
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
    await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 1000 : 3000));
    if (options.signal?.aborted) throw options.signal.reason;
  }
  if (!response) throw new Error('Unable to connect. Please try again.');
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
