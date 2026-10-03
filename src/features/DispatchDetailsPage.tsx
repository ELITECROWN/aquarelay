import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  ShieldAlert,
  Phone,
  Flame,
  Droplet,
  Zap,
  Plus,
  Compass,
  Truck,
  Package,
  Calendar,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

import { useRecord, Loading, Notice, label, date } from "./workflowShared";
import type { CaseRecord, RecordedEvent } from "../types";
export default function DispatchDetailsPage() {
  const [params]=useSearchParams();
  const records=useRecord<{items:CaseRecord[]}>("/cases");
  const selected=records.data?.items.find(c=>c.id===params.get("case")) || records.data?.items[0];
  const detail=useRecord<{events:RecordedEvent[];reports:unknown[];evidence:unknown[];actions:unknown[]}>(`/cases/${selected?.id}`,!!selected);
  const activeStepIndex=selected?.state==="closed"?3:selected?.state==="action_in_progress"?2:selected?.state==="investigating"?1:0;
  const trackingSteps=["Reported","Investigation","Action","Resolution"].map((title,idx)=>({title,date:idx===0?date(selected?.created_at):idx===activeStepIndex?label(selected?.state):"Recorded workflow"}));
  const trackingHistory=(detail.data?.events||[]).map(e=>({time:date(e.created_at),event:e.title,location:selected?.waterbody_name||"",detail:e.description}));
  if(records.loading)return <div className="wf-page amazon-tracker-page"><Loading/></div>;
  if(records.error)return <div className="wf-page amazon-tracker-page"><Notice error>{records.error}</Notice></div>;
  if(!selected)return <div className="wf-page amazon-tracker-page"><Notice>No incidents have been recorded.</Notice><Link to="/explore">Explore water bodies</Link></div>;

  return (
    <div className="wf-page amazon-tracker-page" style={{ maxWidth: "980px", margin: "0 auto", padding: "40px 20px" }}>
      {/* Back button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <Link
          to="/"
          className="wf-back"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#e11d48",
            fontWeight: "600",
            textDecoration: "none",
            fontSize: "14px",
            padding: "8px 16px",
            borderRadius: "9999px",
            background: "rgba(255, 241, 242, 0.7)",
            border: "1px solid #fecdd3",
          }}
        >
          <ArrowLeft size={16} /> Return to Home
        </Link>

        <span style={{ fontSize: "13px", color: "#64748b" }}>
          Tracking ID: <strong style={{ color: "#1e293b", fontFamily: "monospace" }}>{selected.id}</strong>
        </span>
      </div>

      {/* Main Amazon-Style Tracking Card */}
      <div
        className="glass-panel"
        style={{
          padding: "36px",
          borderRadius: "24px",
          marginBottom: "28px",
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(225, 29, 72, 0.2)",
          boxShadow: "0 20px 50px -10px rgba(225, 29, 72, 0.08)",
        }}
      >
        {/* Amazon Delivery Headline */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#059669", fontSize: "13px", fontWeight: "750", marginBottom: "4px" }}>
            <Truck size={17} />
            <span>{label(selected.state)}</span>
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: "800", color: "#065f46", margin: "0 0 6px", letterSpacing: "-1px" }}>
            Incident response records
          </h1>
          <p style={{ color: "#475569", fontSize: "14px", margin: 0 }}>
            Recorded progress for <strong>{selected.waterbody_name}</strong>{selected.synthetic?" · Synthetic demonstration":""}.
          </p>
        </div>

        {/* Amazon Classic 4-Step Progress Bar */}
        <div style={{ margin: "32px 0 40px" }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Connecting Track Line */}
            <div
              style={{
                position: "absolute",
                top: "14px",
                left: "24px",
                right: "24px",
                height: "6px",
                background: "#e2e8f0",
                zIndex: 0,
                borderRadius: "9999px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${activeStepIndex / 3 * 100}%`,
                  background: "#059669",
                  borderRadius: "9999px",
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            {/* 4 Checkpoint Nodes */}
            {trackingSteps.map((step, idx) => {
              const isPassed = idx <= activeStepIndex;
              const isCurrent = idx === activeStepIndex;

              return (
                <div
                  key={step.title}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                    zIndex: 1,
                    width: "25%",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: isPassed ? "#059669" : "#ffffff",
                      border: isPassed ? "3px solid #059669" : "3px solid #cbd5e1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      boxShadow: isCurrent ? "0 0 0 5px rgba(5, 150, 105, 0.2)" : "none",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {isPassed ? <CheckCircle2 size={16} /> : <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#cbd5e1" }} />}
                  </div>
                  <strong
                    style={{
                      fontSize: "13px",
                      color: isPassed ? "#065f46" : "#64748b",
                      marginTop: "10px",
                      fontWeight: isCurrent ? "800" : "650",
                    }}
                  >
                    {step.title}
                  </strong>
                  <small style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    {step.date}
                  </small>
                </div>
              );
            })}
          </div>
        </div>

        {/* Amazon-Style Shipment / Unit Information Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "18px",
            background: "rgba(255, 241, 242, 0.5)",
            border: "1px solid #fecdd3",
            borderRadius: "18px",
            padding: "20px 24px",
            marginBottom: "32px",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: "750", letterSpacing: "0.8px", color: "#8c6e75", display: "block", marginBottom: "4px" }}>
              TARGET LAKE LOCATION
            </span>
            <strong style={{ fontSize: "14px", color: "#1e293b", display: "block" }}>
              {selected.waterbody_name}
            </strong>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {selected.title}
            </span>
          </div>

          <div>
            <span style={{ fontSize: "11px", fontWeight: "750", letterSpacing: "0.8px", color: "#8c6e75", display: "block", marginBottom: "4px" }}>
              RESPONSIBLE ORGANISATION
            </span>
            <strong style={{ fontSize: "14px", color: "#1e293b", display: "block" }}>
              {selected.organisation_id || "Not assigned"}
            </strong>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Delivery status: {label(selected.delivery_state)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <Link to="/organisations" className="button secondary" style={{ width:"100%", minHeight:"38px", fontSize:"12px", gap:"6px" }}><Phone size={14}/> Organisation directory</Link>
          </div>
        </div>

        {/* Amazon-Style "Tracking Updates" Feed */}
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b", marginBottom: "16px" }}>
            Tracking Updates
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {trackingHistory.map((item, idx) => (
              <div
                key={item.time}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  paddingBottom: idx === trackingHistory.length - 1 ? 0 : "14px",
                  borderBottom: idx === trackingHistory.length - 1 ? "none" : "1px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: idx === 0 ? "#059669" : "#cbd5e1",
                    marginTop: "5px",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                    <strong style={{ fontSize: "13px", color: "#1e293b" }}>{item.event}</strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{item.time}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: "600", display: "block", marginBottom: "2px" }}>
                    {item.location}
                  </span>
                  <p style={{ fontSize: "12px", color: "#475569", margin: 0, lineHeight: "1.4" }}>
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Water Telemetry Snapshot */}
        <h2 style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b", marginBottom: "16px" }}>
          Recorded Evidence for Incident {selected.id}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "28px",
          }}
        >
          <div style={{ padding: "14px 16px", borderRadius: "14px", background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "10px", fontWeight: "750", color: "#0284c7", display: "flex", alignItems: "center", gap: "5px" }}>
              <Droplet size={13} /> COMMUNITY REPORTS
            </span>
            <strong style={{ fontSize: "20px", color: "#dc2626", display: "block", margin: "4px 0" }}>{detail.data?.reports.length ?? "—"}</strong>
            <small style={{ color: "#dc2626", fontWeight: "600" }}>Submitted observations</small>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: "14px", background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "10px", fontWeight: "750", color: "#7c3aed", display: "flex", alignItems: "center", gap: "5px" }}>
              <Flame size={13} /> PUBLIC EVIDENCE
            </span>
            <strong style={{ fontSize: "20px", color: "#7c3aed", display: "block", margin: "4px 0" }}>{detail.data?.evidence.length ?? "—"}</strong>
            <small style={{ color: "#7c3aed", fontWeight: "600" }}>Supporting media</small>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: "14px", background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "10px", fontWeight: "750", color: "#d97706", display: "flex", alignItems: "center", gap: "5px" }}>
              <Zap size={13} /> ACTION RECORDS
            </span>
            <strong style={{ fontSize: "20px", color: "#d97706", display: "block", margin: "4px 0" }}>{detail.data?.actions.length ?? "—"}</strong>
            <small style={{ color: "#d97706", fontWeight: "600" }}>Documented actions</small>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: "14px", background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "10px", fontWeight: "750", color: "#059669", display: "flex", alignItems: "center", gap: "5px" }}>
              <ShieldAlert size={13} /> WORKFLOW STATUS
            </span>
            <strong style={{ fontSize: "20px", color: "#059669", display: "block", margin: "4px 0" }}>{label(selected.state)}</strong>
            <small style={{ color: "#059669", fontWeight: "600" }}>Not a water-safety assessment</small>
          </div>
        </div>

        {detail.error && <Notice error>{detail.error}</Notice>}
        <div className="record-list">{records.data?.items.map(c=><Link key={c.id} to={`/dispatch-tracker?case=${encodeURIComponent(c.id)}`}>{c.title} · {label(c.state)}</Link>)}</div>
        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", paddingTop: "20px", borderTop: "1px solid #f1f5f9" }}>
          <Link to="/report" className="button primary" style={{ fontSize: "13px", padding: "10px 20px" }}>
            Report Another Incident <Plus size={15} />
          </Link>
          <Link to="/explore" className="button secondary" style={{ fontSize: "13px", padding: "10px 18px" }}>
            <Compass size={15} /> View Water Registry Map
          </Link>
        </div>
      </div>
    </div>
  );
}
