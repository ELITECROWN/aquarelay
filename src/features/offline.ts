import { api } from "../api";
import { useEffect } from "react";
import { useSession } from "../session";

export type DraftStatus = "draft" | "pending" | "failed" | "synced";
export interface ReportValues {
  waterbody_id: string;
  observation_type: string;
  observed_at: string;
  latitude: number;
  longitude: number;
  description: string;
  count_estimate: string;
  language: string;
  synthetic: boolean;
  related_case_id?: string;
}
export interface LocalDraft {
  id: string;
  accountId: string;
  status: DraftStatus;
  updatedAt: string;
  values: ReportValues;
  media: File[];
  evidenceIds: string[];
  error?: string;
  caseId?: string;
  reportId?: string;
}
const databaseName = "aquarelay-account-drafts-v1";
const running = new Map<string, Promise<LocalDraft>>();
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis))
      return reject(
        new Error(
          "Local drafts are unavailable in this browser. Keep this page open or submit online.",
        ),
      );
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("drafts", {
        keyPath: "id",
      });
      store.createIndex("accountId", "accountId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Local storage is unavailable or full. Your report has not been saved locally.",
        ),
      );
  });
}
export async function saveDraft(draft: LocalDraft): Promise<LocalDraft> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite");
    transaction.objectStore("drafts").put(draft);
    transaction.oncomplete = () => {
      db.close();
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("aquarelay-drafts-changed"));
      resolve(draft);
    };
    transaction.onerror = transaction.onabort = () => {
      db.close();
      reject(
        new Error(
          "Could not save the local draft. Browser storage may be full.",
        ),
      );
    };
  });
}

/** Mount once inside SessionProvider so reconnect retries work on every route. */
export function OfflineDraftSync() {
  const { user } = useSession();
  useEffect(() => {
    if (!user) return;
    let active = true;
    const reconnect = async () => {
      if (!navigator.onLine || !active) return;
      try {
        const drafts = await listDrafts(user.id);
        for (const draft of drafts) {
          if (!active) break;
          if (canRetryDraft(draft, user.id)) {
            try {
              await syncDraft(draft, user.id);
            } catch {
              /* Saved failure remains available under this account. */
            }
          }
        }
      } catch {
        /* Browser storage limitations are explained by the report page. */
      }
    };
    window.addEventListener("online", reconnect);
    void reconnect();
    return () => {
      active = false;
      window.removeEventListener("online", reconnect);
    };
  }, [user?.id]);
  return null;
}
export async function listDrafts(accountId: string): Promise<LocalDraft[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("drafts")
      .objectStore("drafts")
      .index("accountId")
      .getAll(accountId);
    request.onsuccess = () => {
      db.close();
      resolve(
        request.result.sort((a: LocalDraft, b: LocalDraft) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    };
    request.onerror = () => {
      db.close();
      reject(new Error("Could not read local drafts."));
    };
  });
}
export async function removeDraft(id: string, accountId: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite"),
      store = transaction.objectStore("drafts"),
      request = store.get(id);
    request.onsuccess = () => {
      if (request.result?.accountId === accountId) store.delete(id);
    };
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(new Error("Could not delete the local draft."));
    };
  });
}
export const canRetryDraft = (draft: LocalDraft, accountId: string) =>
  draft.accountId === accountId && ["failed", "pending"].includes(draft.status);
export const reportPayload = (draft: LocalDraft) => ({
  ...draft.values,
  client_id: draft.id,
  evidence_ids: draft.evidenceIds,
});
export function syncDraft(
  draft: LocalDraft,
  accountId: string,
): Promise<LocalDraft> {
  if (draft.accountId !== accountId)
    return Promise.reject(
      new Error("Sign in to the account that saved this report."),
    );
  if (draft.status === "synced") return Promise.resolve(draft);
  if (running.has(draft.id)) return running.get(draft.id)!;
  const task = (async () => {
    let next: LocalDraft = {
      ...draft,
      status: "pending",
      error: undefined,
      updatedAt: new Date().toISOString(),
    };
    await saveDraft(next);
    try {
      const assertAccount = async () => {
        const session = await api<{ user: { id: string } | null }>(
          "/api/v1/auth/session",
        );
        if (session.user?.id !== accountId)
          throw new Error(
            "Sync stopped because the signed-in account changed. Return to the original account to retry.",
          );
      };
      for (
        let index = next.evidenceIds.length;
        index < next.media.length;
        index++
      ) {
        await assertAccount();
        const body = new FormData();
        body.append("file", next.media[index]);
        body.append("synthetic", String(next.values.synthetic));
        body.append(
          "caption",
          next.values.synthetic
            ? "Synthetic demonstration evidence supplied by the reporter."
            : "Reporter-provided evidence.",
        );
        const evidence = await api<{ id: string }>("/api/v1/evidence", {
          method: "POST",
          body,
        });
        next = { ...next, evidenceIds: [...next.evidenceIds, evidence.id] };
        await saveDraft(next);
      }
      await assertAccount();
      const result = await api<{ report: { id: string }; case_id: string }>(
        "/api/v1/reports",
        { method: "POST", body: JSON.stringify(reportPayload(next)) },
      );
      next = {
        ...next,
        status: "synced",
        caseId: result.case_id,
        reportId: result.report.id,
        updatedAt: new Date().toISOString(),
      };
      await saveDraft(next);
      return next;
    } catch (error) {
      next = {
        ...next,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Submission failed. Try Sync now after reconnecting.",
      };
      await saveDraft(next);
      throw error;
    }
  })().finally(() => running.delete(draft.id));
  running.set(draft.id, task);
  return task;
}
