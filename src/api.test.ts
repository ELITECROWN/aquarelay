import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("authoritative API responses", () => {
  it("does not replace an unavailable registry with invented records", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ detail: "Database unavailable" }), { status: 503, headers: { "content-type": "application/json" } }));
    await expect(api("/waterbodies")).rejects.toThrow("Database unavailable");
  });
  it("does not acknowledge a report rejected by the server", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ detail: "Please sign in" }), { status: 401, headers: { "content-type": "application/json" } }));
    await expect(api("/reports", { method: "POST", body: "{}" })).rejects.toThrow("Please sign in");
  });
  it("rejects a frontend HTML rewrite instead of pretending the API is live", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>SPA</html>", { headers: { "content-type": "text/html" } }));
    await expect(api("/reports", { method: "POST", body: "{}" })).rejects.toThrow("non-JSON");
  });
  it("never exposes personal mock notifications after a network failure", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("Network unavailable"); });
    await expect(api("/notifications")).rejects.toThrow("Network unavailable");
  });
});
