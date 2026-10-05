import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, LoaderCircle, LockKeyhole } from "lucide-react";
import { api, retryReadQuery } from "../api";
import { useSession } from "../session";
import "./workflows.css";

export const label = (value?: string) =>
  (value || "not recorded")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
export const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : "Not recorded";
export const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The request could not be completed.";
export function useRecord<T>(path: string, enabled = true) {
  const { user } = useSession();
  const query = useQuery<T>({
    queryKey: [path, user?.id || "public"],
    queryFn: () => api<T>(path),
    enabled,
    retry: retryReadQuery,
  });
  return {
    data: query.data,
    error: query.error ? errorText(query.error) : "",
    loading: enabled && query.isPending,
    reload: () => {
      void query.refetch();
    },
  };
}
export function WorkflowHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="wf-header">
      <div>
        <p className="wf-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`wf-notice ${error ? "wf-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <AlertCircle size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="wf-loading" role="status">
      <LoaderCircle className="wf-spin" size={22} />
      Loading records…
    </div>
  );
}
export function Gate({ manager = false }: { manager?: boolean }) {
  return (
    <div className="wf-panel wf-gate">
      <LockKeyhole size={30} />
      <h2>
        {manager ? "Organisation access required" : "Sign in to continue"}
      </h2>
      <p>
        {manager
          ? "Case handling and data imports require an authorised organisation account. Public records remain available to everyone."
          : "Your account connects this contribution to its original reporter and keeps drafts separate on this device."}
      </p>
      <Link
        className="wf-button"
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
      >
        Sign in
      </Link>
    </div>
  );
}
export function Pill({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`wf-pill ${tone}`}>{children}</span>;
}
