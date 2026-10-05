let csrf = "";
export function setCsrf(value: string) { csrf = value; }
export class ApiConnectionError extends Error {}
export const retryReadQuery = (count: number, error: unknown) => !(error instanceof ApiConnectionError) && count < 1;
let recoveringReads = 0;
export function backendRecovering() { return recoveringReads > 0; }
function recoveryChanged() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('aquarelay-connection-change')); }
const startupDelays = [2000, 5000, 10000, 15000, 20000, 20000];
function waitToRetry(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const finish = () => { signal?.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal?.reason); };
    signal?.addEventListener('abort', abort, {once:true});
  });
}

/** Only committed backend responses may acknowledge application operations. */
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", csrf);
  const read = method === 'GET' || method === 'HEAD';
  let response: Response | undefined;
  const deadline = Date.now() + 90000;
  let recovering = false;
  try {
  for (let attempt = 0; attempt < (read ? 7 : 1); attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, {once:true});
    if (options.signal?.aborted) abort();
    const timer = setTimeout(() => controller.abort(), read ? Math.max(1,Math.min(25000,deadline-Date.now())) : 120000);
    try {
      response = await fetch(path.startsWith("/api") ? path : `/api/v1${path}`, { ...options, headers, credentials: "include", signal: controller.signal });
      if (!read || ![502,503,504].includes(response.status) || attempt === 6 || Date.now() >= deadline) break;
    } catch (error) {
      if (options.signal?.aborted || !read || attempt === 6 || Date.now() >= deadline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        if (controller.signal.aborted && !options.signal?.aborted) throw new ApiConnectionError('Connection timed out. Please try again; the server may be starting.');
        if (read && !options.signal?.aborted) throw new ApiConnectionError(error instanceof Error ? error.message : 'Unable to connect. Please retry.');
        throw error;
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
    if (!recovering) { recovering=true; recoveringReads++; recoveryChanged(); }
    await waitToRetry(Math.min(startupDelays[attempt], Math.max(0,deadline-Date.now())), options.signal);
  }
  if (!response) throw new Error('Unable to connect. Please try again.');
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please retry.`;
    try {
      const data = await response.json();
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
    } catch { /* Preserve HTTP failure when a proxy returns HTML. */ }
    throw read && [502,503,504].includes(response.status) ? new ApiConnectionError(message) : new Error(message);
  }
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`API endpoint returned non-JSON response (${type || "unknown"}). Check the backend deployment.`);
  return await response.json() as T;
  } finally { if (recovering) { recoveringReads--; recoveryChanged(); } }
}
