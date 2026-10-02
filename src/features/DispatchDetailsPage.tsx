import { useState } from "react";
import { Link } from "react-router-dom";
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

export default function DispatchDetailsPage() {
  const [activeStepIndex, setActiveStepIndex] = useState(2); // Step 3: Out for delivery

  const trackingSteps = [
    {
      title: "Reported",
      status: "completed",
      date: "Today, 10:24 PM",
      desc: "Citizen alert confirmed at Bellandur Lake with GPS photos.",
    },
    {
      title: "Dispatched",
      status: "completed",
      date: "Today, 10:25 PM",
      desc: "Dispatched from Central Command to Special Enforcement Division.",
    },
    {
      title: "Out for delivery",
      status: "current",
      date: "Today, 10:26 PM",
      desc: "Patrol boat is on the way to the lake catchment coordinates.",
    },
    {
      title: "Arriving at lake",
      status: "pending",
      date: "Today",
      desc: "On-site forensic water sampling and chemical neutralization.",
    },
  ];

  const trackingHistory = [
    {
      time: "Today, 10:26 PM",
      event: "Out for delivery",
      location: "Bengaluru Central Station",
      detail: "Inspector Ananya Sen & Team in Eco-Patrol Boat #04 are en route to target coordinates.",
    },
    {
      time: "Today, 10:25 PM",
      event: "Incident Dispatched",
      location: "State Pollution Control Board",
      detail: "Level 4 priority cryptographic protocol signed and assigned to Enforcement Wing.",
    },
    {
      time: "Today, 10:24 PM",
      event: "Incident Report Received",
      location: "AquaRelay Cloud Telemetry",
      detail: "Verified citizen alert at 12.9352° N, 77.6710° E with evidence photos.",
    },
  ];

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
          Tracking ID: <strong style={{ color: "#1e293b", fontFamily: "monospace" }}>#AUTH-LK-8942-CPCB</strong>
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
            <span>Out for delivery</span>
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: "800", color: "#065f46", margin: "0 0 6px", letterSpacing: "-1px" }}>
            Arriving Today
          </h1>
          <p style={{ color: "#475569", fontSize: "14px", margin: 0 }}>
            Your emergency lake enforcement unit is on the way to <strong>Bellandur Catchment (North Inflow Drain)</strong>.
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
                  width: "66%",
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
              Bellandur Catchment North Drain
            </strong>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              12.9352° N, 77.6710° E · Bengaluru Urban
            </span>
          </div>

          <div>
            <span style={{ fontSize: "11px", fontWeight: "750", letterSpacing: "0.8px", color: "#8c6e75", display: "block", marginBottom: "4px" }}>
              ASSIGNED DISPATCH CARRIER
            </span>
            <strong style={{ fontSize: "14px", color: "#1e293b", display: "block" }}>
              Special Lake Enforcement Division
            </strong>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Officer: Insp. Ananya Sen · Patrol Boat #04
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              type="button"
              className="button secondary"
              style={{ width: "100%", minHeight: "38px", fontSize: "12px", gap: "6px" }}
              onClick={() => alert("Connecting to Official Lake Enforcement Desk\nHotline: 1800-LAKE-PROTECT")}
            >
              <Phone size={14} /> Contact Response Desk
            </button>
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
          Water Contamination Readings for Incident #AUTH-LK-8942-CPCB
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
              <Droplet size={13} /> DISSOLVED OXYGEN
            </span>
            <strong style={{ fontSize: "20px", color: "#dc2626", display: "block", margin: "4px 0" }}>1.4 mg/L</strong>
            <small style={{ color: "#dc2626", fontWeight: "600" }}>Critical Hypoxia</small>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: "14px", background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "10px", fontWeight: "750", color: "#7c3aed", display: "flex", alignItems: "center", gap: "5px" }}>
              <Flame size={13} /> pH LEVEL
            </span>
            <strong style={{ fontSize: "20px", color: "#7c3aed", display: "block", margin: "4px 0" }}>9.8 pH</strong>
            <small style={{ color: "#7c3aed", fontWeight: "600" }}>Alkaline Effluent</small>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: "14px", background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "10px", fontWeight: "750", color: "#d97706", display: "flex", alignItems: "center", gap: "5px" }}>
              <Zap size={13} /> TURBIDITY
            </span>
            <strong style={{ fontSize: "20px", color: "#d97706", display: "block", margin: "4px 0" }}>84 NTU</strong>
            <small style={{ color: "#d97706", fontWeight: "600" }}>Toxic Foam</small>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: "14px", background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "10px", fontWeight: "750", color: "#059669", display: "flex", alignItems: "center", gap: "5px" }}>
              <ShieldAlert size={13} /> REGULATORY SLA
            </span>
            <strong style={{ fontSize: "20px", color: "#059669", display: "block", margin: "4px 0" }}>Today</strong>
            <small style={{ color: "#059669", fontWeight: "600" }}>Emergency Action</small>
          </div>
        </div>

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
