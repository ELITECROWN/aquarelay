import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("authoritative API responses", () => {
  it('keeps waiting through a 50-second cold start instead of failing after four seconds',async()=>{
    vi.useFakeTimers();const start=Date.now();
    const fetcher=vi.fn(async()=>Date.now()-start<50000
      ? new Response('Server starting',{status:502})
      : new Response('{"ready":true}',{headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetcher);
    const result=expect(api('/config')).resolves.toEqual({ready:true});
    await vi.runAllTimersAsync();await result;
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it("recovers a read when a sleeping server initially returns a proxy error", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('Starting', {status:502})).mockResolvedValueOnce(new Response('{"items":[]}', {headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch', fetcher);
    const request = api('/waterbodies');
    await vi.runAllTimersAsync();
    await expect(request).resolves.toEqual({items:[]});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not automatically replay a failed report submission", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('Unavailable', {status:502}));
    vi.stubGlobal('fetch', fetcher);
    await expect(api('/reports', {method:'POST', body:'{}'})).rejects.toThrow('502');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not replace an unavailable registry with invented records", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ detail: "Database unavailable" }), { status: 503, headers: { "content-type": "application/json" } }));
    const result = expect(api("/waterbodies")).rejects.toThrow("Database unavailable");
    await vi.runAllTimersAsync(); await result;
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
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => { throw new TypeError("Network unavailable"); });
    const result = expect(api("/notifications")).rejects.toThrow("Network unavailable");
    await vi.runAllTimersAsync(); await result;
  });
});
