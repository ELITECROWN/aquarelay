import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  reportPayload,
  canRetryDraft,
  listDrafts,
  saveDraft,
  syncDraft,
  type LocalDraft,
} from "./offline";

const draft: LocalDraft = {
  id: "client-report-123",
  accountId: "citizen-1",
  status: "failed",
  updatedAt: "2026-10-02T12:00:00Z",
  values: {
    waterbody_id: "water-1",
    observation_type: "fish_mortality",
    description: "Approximately 5–10 fish; unsure of cause.",
    observed_at: "2026-10-02T11:30:00Z",
    latitude: 12,
    longitude: 77,
    count_estimate: "5–10",
    language: "English",
    synthetic: true,
  },
  media: [],
  evidenceIds: ["ev-1"],
};
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
describe("offline report acknowledgement and retry", () => {
  it("keeps the same client identity and original estimated range on retry", () => {
    const original = reportPayload(draft);
    const retried = reportPayload({ ...draft, status: "pending" });
    expect(retried).toEqual(original);
    expect(retried.client_id).toBe("client-report-123");
    expect(retried.count_estimate).toBe("5–10");
    expect(retried.evidence_ids).toEqual(["ev-1"]);
  });
  it("never retries another account or a report already acknowledged by the server", () => {
    expect(canRetryDraft(draft, "citizen-2")).toBe(false);
    expect(
      canRetryDraft(
        { ...draft, status: "synced", caseId: "case-1" },
        "citizen-1",
      ),
    ).toBe(false);
    expect(canRetryDraft(draft, "citizen-1")).toBe(true);
  });
  it("retains pending state until the server acknowledges and hides other account drafts", async () => {
    let acknowledge!: (response: Response) => void;
    let started!: () => void;
    const reportStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal("fetch", async (path: string) => {
      if (path.endsWith("/auth/session"))
        return Response.json({ user: { id: draft.accountId } });
      started();
      return new Promise<Response>((resolve) => {
        acknowledge = resolve;
      });
    });
    await saveDraft(draft);
    const submitted = syncDraft(draft, draft.accountId);
    await reportStarted;
    expect((await listDrafts(draft.accountId))[0].status).toBe("pending");
    expect(await listDrafts("citizen-2")).toEqual([]);
    acknowledge(
      Response.json({
        report: { id: "server-report-1" },
        case_id: "server-case-1",
      }),
    );
    expect((await submitted).status).toBe("synced");
    expect((await listDrafts(draft.accountId))[0].reportId).toBe(
      "server-report-1",
    );
  });
  it("keeps a failed report and its client ID for safe replay after a network failure", async () => {
    let failing = true;
    const identities: string[] = [];
    vi.stubGlobal("fetch", async (path: string, options: RequestInit) => {
      if (path.endsWith("/auth/session"))
        return Response.json({ user: { id: draft.accountId } });
      identities.push(JSON.parse(options.body as string).client_id);
      if (failing) throw new TypeError("Network disconnected");
      return Response.json({
        report: { id: "server-report-1" },
        case_id: "server-case-1",
      });
    });
    await expect(syncDraft(draft, draft.accountId)).rejects.toThrow(
      "Network disconnected",
    );
    const saved = (await listDrafts(draft.accountId))[0];
    expect(saved.status).toBe("failed");
    expect(saved.reportId).toBeUndefined();
    failing = false;
    expect((await syncDraft(saved, draft.accountId)).status).toBe("synced");
    expect(identities).toEqual([draft.id, draft.id]);
  });
  it("stops a queued contribution when the server session has changed accounts", async () => {
    const mutations: string[] = [];
    vi.stubGlobal("fetch", async (path: string) => {
      if (path.endsWith("/auth/session"))
        return Response.json({ user: { id: "citizen-2" } });
      mutations.push(path);
      return Response.json({});
    });
    await expect(syncDraft(draft, draft.accountId)).rejects.toThrow(
      "signed-in account changed",
    );
    expect(mutations).toEqual([]);
    expect((await listDrafts(draft.accountId))[0].status).toBe("failed");
  });
  it("retains media and completed evidence IDs when an upload fails, then resumes only remaining uploads", async () => {
    const mediaDraft: LocalDraft = {
      ...draft,
      evidenceIds: [],
      media: [
        new File(["synthetic-first"], "demo-1.png", { type: "image/png" }),
        new File(["synthetic-second"], "demo-2.png", { type: "image/png" }),
      ],
    };
    const uploaded: string[] = [];
    let secondAttemptFails = true;
    let reportBody: Record<string, unknown> | undefined;
    vi.stubGlobal("fetch", async (path: string, options: RequestInit) => {
      if (path.endsWith("/auth/session"))
        return Response.json({ user: { id: draft.accountId } });
      if (path.endsWith("/evidence")) {
        const file = (options.body as FormData).get("file") as Blob;
        const content = await file.text();
        uploaded.push(content);
        if (content === "synthetic-second" && secondAttemptFails)
          throw new TypeError("Upload interrupted");
        return Response.json({
          id: content === "synthetic-first" ? "ev-first" : "ev-second",
        });
      }
      reportBody = JSON.parse(options.body as string);
      return Response.json({
        report: { id: "server-report-1" },
        case_id: "server-case-1",
      });
    });
    await expect(syncDraft(mediaDraft, draft.accountId)).rejects.toThrow(
      "Upload interrupted",
    );
    const saved = (await listDrafts(draft.accountId))[0];
    expect(saved.evidenceIds).toEqual(["ev-first"]);
    expect(saved.media).toHaveLength(2);
    secondAttemptFails = false;
    expect((await syncDraft(saved, draft.accountId)).status).toBe("synced");
    expect(uploaded).toEqual([
      "synthetic-first",
      "synthetic-second",
      "synthetic-second",
    ]);
    expect(reportBody).toMatchObject({
      client_id: draft.id,
      evidence_ids: ["ev-first", "ev-second"],
    });
  });
});
