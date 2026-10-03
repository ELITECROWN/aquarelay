import { handleMockRoute } from "./mockData";

let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set("X-CSRF-Token", csrf);

  try {
    const fullPath = path.startsWith("/api") ? path : `/api/v1${path}`;
    const response = await fetch(fullPath, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const mock = handleMockRoute<T>(path, options);
      if (mock !== null) return mock;

      let message = `Request failed (${response.status})`;
      try {
        const data = await response.json();
        message =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || data);
      } catch {}
      throw new Error(message);
    }

    if (response.status === 204) return undefined as T;

    const type = response.headers.get("content-type") || "";
    // If response is HTML (e.g. Vercel SPA rewrite returning index.html for API requests), fallback to mock data
    if (!type.includes("json")) {
      const mock = handleMockRoute<T>(path, options);
      if (mock !== null) return mock;
      throw new Error(
        `API endpoint returned non-JSON response (${type || "text/html"})`,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    const mock = handleMockRoute<T>(path, options);
    if (mock !== null) return mock;
    throw err;
  }
}
