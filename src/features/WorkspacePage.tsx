import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Database,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "../session";
import {
  date,
  Gate,
  label,
  Loading,
  Notice,
  Pill,
  useRecord,
  WorkflowHeader,
} from "./workflowShared";

type AssignedCase = {
  id: string;
  title: string;
  waterbody_name: string;
  state: string;
  review_state: string;
  created_at: string;
  synthetic: boolean;
};
export default function WorkspacePage() {
  const { user, loading } = useSession();
  const manager =
    !!user && ["manager", "admin", "reviewer"].includes(user.role);
  const record = useRecord<{
    cases: AssignedCase[];
    notes: {
      id: string;
      text: string;
      case_id: string;
      created_at: string;
      private: boolean;
    }[];
  }>("/api/v1/workspace", manager);
  if (loading) return <Loading />;
  if (!manager)
    return (
      <div className="wf-page">
        <WorkflowHeader
          eyebrow="Professional workspace"
          title="Document the response"
          description="Review contributions, request evidence and preserve the outcome."
        />
        <Gate manager />
      </div>
    );
  return (
    <div className="wf-page">
      <WorkflowHeader
        eyebrow="Organisation workspace"
        title="Your case desk"
        description={`Signed in as ${user.name}. Changes are scoped to your organisation.`}
      >
        <Link className="wf-button" to="/integrations/import">
          <Database size={16} />
          Import source records
        </Link>
      </WorkflowHeader>
      <div className="wf-workspace-tiles">
        <Link to="/integrations" className="wf-panel">
          <Database size={24} />
          <h3>Sources & integration health</h3>
          <p>Inspect syncs, failures and source freshness.</p>
          <ArrowRight size={18} />
        </Link>
        <div className="wf-panel">
          <ShieldCheck size={24} />
          <h3>Account permissions</h3>
          <p>
            {label(user.role)} · {user.organisation_id}
          </p>
          <small>Organisation decisions are audited server-side.</small>
        </div>
        <div className="wf-panel">
          <ClipboardList size={24} />
          <h3>Assigned cases</h3>
          <p>
            {record.data
              ? `${record.data.cases.length} cases in your organisation`
              : "Loading assigned records"}
          </p>
          <small>Closure requires a dated outcome and supporting record.</small>
        </div>
      </div>
      {record.error && (
        <Notice error>
          {record.error}
          <button className="wf-text-button" onClick={record.reload}>
            Retry
          </button>
        </Notice>
      )}
      {record.loading ? (
        <Loading />
      ) : (
        <>
          <section className="wf-panel">
            <div className="wf-section-head">
              <h2>Assigned cases</h2>
              <Pill>{record.data?.cases.length || 0} records</Pill>
            </div>
            {record.data?.cases.length ? (
              <div className="wf-table-wrap">
                <table className="wf-table">
                  <thead>
                    <tr>
                      <th>Incident</th>
                      <th>Review</th>
                      <th>Case work</th>
                      <th>Received</th>
                      <th>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.data.cases.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link to={`/incidents/${item.id}`}>
                            <strong>{item.title}</strong>
                          </Link>
                          <small>
                            {item.waterbody_name}
                            {item.synthetic ? " · Synthetic demo" : ""}
                          </small>
                        </td>
                        <td>
                          <Pill
                            tone={
                              item.review_state === "unreviewed" ? "amber" : ""
                            }
                          >
                            {label(item.review_state)}
                          </Pill>
                        </td>
                        <td>
                          <Pill tone="blue">{label(item.state)}</Pill>
                        </td>
                        <td>{date(item.created_at)}</td>
                        <td>
                          <Link
                            aria-label={`Open ${item.title}`}
                            to={`/incidents/${item.id}`}
                          >
                            <ArrowRight size={18} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="wf-empty">
                No cases are assigned to this organisation.
              </p>
            )}
          </section>
          <section className="wf-panel">
            <h2>Organisation notes</h2>
            <p className="wf-muted">
              Private notes appear here only for members with permission.
            </p>
            {record.data?.notes.map((item) => (
              <article className="wf-record" key={item.id}>
                <FileText size={18} />
                <div>
                  <p>{item.text}</p>
                  <small>
                    {date(item.created_at)} ·{" "}
                    {item.private ? "Private organisation note" : "Public note"}
                  </small>
                  <Link to={`/incidents/${item.case_id}`}>
                    Open supporting case
                  </Link>
                </div>
              </article>
            ))}
            {!record.data?.notes.length && (
              <p className="wf-muted">No organisation notes recorded.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
