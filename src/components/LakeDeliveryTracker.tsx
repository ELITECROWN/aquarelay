import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  MapPin,
  ShieldAlert,
  Zap,
  Phone,
  Radio,
  Sparkles,
  ArrowRight,
  Flame,
  Droplet,
  Compass,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

interface TrackingStep {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  status: "completed" | "current" | "pending";
  iconText: string;
  accentColor: string;
  badge: string;
}

const DEFAULT_STEPS: TrackingStep[] = [
  {
    id: "step-1",
    title: "Citizen Alert Received",
    subtitle: "GPS: 12.9352° N, 77.6710° E · 3 Photos & Video Uploaded",
    time: "10:24 PM",
    status: "completed",
    iconText: "📸",
    accentColor: "#10b981", // Neon Emerald
    badge: "VERIFIED CITIZEN REPORT",
  },
  {
    id: "step-2",
    title: "AI Water Contamination Triage",
    subtitle: "Dissolved Oxygen 1.4 mg/L · Toxic Chemical Foam Detected",
    time: "10:25 PM",
    status: "completed",
    iconText: "⚡",
    accentColor: "#06b6d4", // Electric Cyan
    badge: "LEVEL 4 SEVERITY",
  },
  {
    id: "step-3",
    title: "Dispatched to State Pollution Board",
    subtitle: "Case Ref #AUTH-LK-8942-CPCB assigned to Enforcement Division",
    time: "10:26 PM",
    status: "completed",
    iconText: "🚨",
    accentColor: "#f97316", // Radiant Sunset Orange
    badge: "PROTOCOL SIGNED",
  },
  {
    id: "step-4",
    title: "Rapid Response Flying Squad En Route",
    subtitle: "Inspector Ananya Sen & Team in Eco-Patrol Boat #04 (1.2 km away)",
    time: "LIVE (ETA 8 mins)",
    status: "current",
    iconText: "🚤",
    accentColor: "#3b82f6", // Electric Royal Blue
    badge: "DISPATCH IN TRANSIT",
  },
  {
    id: "step-5",
    title: "On-Site Quarantine & Water Sampling",
    subtitle: "Automated chain of custody, chemical neutralization & legal citation",
    time: "Estimated 10:42 PM",
    status: "pending",
    iconText: "🧪",
    accentColor: "#8b5cf6", // Hyper Violet
    badge: "DESTINATION LAKE",
  },
];

export default function LakeDeliveryTracker() {
  const [activeStepIndex, setActiveStepIndex] = useState(3);
  const [etaSeconds, setEtaSeconds] = useState(492); // ~8m 12s
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedLake, setSelectedLake] = useState("Bellandur Catchment");

  // Countdown timer for live delivery ETA
  useEffect(() => {
    const timer = setInterval(() => {
      setEtaSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatEta = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? "0" : ""}${s}s`;
  };

  const handleSimulateNew = () => {
    setIsSimulating(true);
    setActiveStepIndex(0);
    setEtaSeconds(720);

    let current = 0;
    const interval = setInterval(() => {
      current++;
      if (current <= 3) {
        setActiveStepIndex(current);
      } else {
        clearInterval(interval);
        setIsSimulating(false);
      }
    }, 1200);
  };

  return (
    <section className="delivery-tracking-section" id="delivery-tracker">
      {/* Dynamic colorful neon ambient mesh */}
      <div className="delivery-neon-glow" aria-hidden="true" />

      {/* Header with vibrant live order tracking badge */}
      <div className="delivery-header">
        <div className="delivery-live-tag">
          <span className="live-dot-pulse" />
          <Radio size={14} className="text-emerald-400 animate-pulse" />
          <span>LIVE AUTHORITY DISPATCH TRACKER</span>
          <span className="live-order-id font-mono">TICKET #LK-9921-URGENT</span>
        </div>

        <h2 className="delivery-title">
          Live Lake Incident Delivery & Dispatch
        </h2>

        <p className="delivery-desc">
          Watch your suspicious lake report move in real time from citizen alert to automated environmental authority intervention.
        </p>
      </div>

      <div className="delivery-main-card">
        {/* Top Status Banner with vibrant gradient */}
        <div className="delivery-top-banner">
          <div className="eta-block">
            <span className="eta-label">ESTIMATED ENFORCEMENT SQUAD ARRIVAL</span>
            <div className="eta-counter">
              <strong>{formatEta(etaSeconds)}</strong>
              <span className="eta-badge">On Schedule · High Priority</span>
            </div>
            <p className="eta-target">
              Target: <strong>{selectedLake} (North Inflow Drain)</strong>
            </p>
          </div>

          <div className="delivery-driver-card">
            <div className="driver-avatar">
              <span className="avatar-img">👮‍♀️</span>
              <span className="verified-check">✓</span>
            </div>
            <div className="driver-details">
              <strong>Insp. Ananya Sen</strong>
              <small>Special Lake Enforcement Wing</small>
              <div className="driver-stats">
                <span className="rating">★ 4.9</span>
                <span>• Rapid Eco-Boat #04</span>
                <span className="speed">42 km/h</span>
              </div>
            </div>
            <button
              type="button"
              className="call-dispatch-btn"
              onClick={() => alert("Connecting to Central Dispatch Hotline (Toll-Free 1800-LAKE-SEC)...")}
            >
              <Phone size={15} />
              <span>Contact Unit</span>
            </button>
          </div>
        </div>

        {/* Live Delivery Progress Route Bar */}
        <div className="delivery-route-visualizer">
          <div className="route-header">
            <span>
              <MapPin size={14} className="text-emerald-400" /> Citizen Point (12.93° N)
            </span>
            <span className="transit-text">
              <span className="boat-icon animate-bounce">🚤</span> Patrol Boat Moving across Catchment
            </span>
            <span>
              <ShieldAlert size={14} className="text-blue-400" /> State Authority Command
            </span>
          </div>

          <div className="route-track-bar">
            <div
              className="route-fill-bar"
              style={{
                width: `${((activeStepIndex + 1) / DEFAULT_STEPS.length) * 100}%`,
              }}
            >
              <div className="route-beacon-glow" />
            </div>
          </div>
        </div>

        {/* The 5 Delivery-Style Tracking Stages */}
        <div className="delivery-steps-track">
          {DEFAULT_STEPS.map((step, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isCurrent = idx === activeStepIndex;
            const isPending = idx > activeStepIndex;

            return (
              <div
                key={step.id}
                className={`delivery-step-card ${
                  isCurrent ? "current-stage" : isCompleted ? "completed-stage" : "pending-stage"
                }`}
                style={{
                  borderColor: isCurrent ? step.accentColor : isCompleted ? "#10b981" : "rgba(255, 255, 255, 0.15)",
                }}
              >
                <div
                  className="step-icon-bubble"
                  style={{
                    backgroundColor: isCompleted ? "#10b981" : isCurrent ? step.accentColor : "#374151",
                    color: "#ffffff",
                    boxShadow: isCurrent ? `0 0 18px ${step.accentColor}` : "none",
                  }}
                >
                  {isCompleted ? <CheckCircle2 size={20} /> : <span style={{ fontSize: "17px" }}>{step.iconText}</span>}
                </div>

                <div className="step-body">
                  <div className="step-time-badge">
                    <span
                      className="stage-pill"
                      style={{
                        backgroundColor: `${step.accentColor}22`,
                        color: step.accentColor,
                        border: `1px solid ${step.accentColor}55`,
                      }}
                    >
                      {step.badge}
                    </span>
                    <span className="step-timestamp">
                      <Clock size={11} /> {step.time}
                    </span>
                  </div>

                  <strong className="step-title">{step.title}</strong>
                  <p className="step-subtitle">{step.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Lake Health Telemetry in Vibrant Cards */}
        <div className="delivery-telemetry-grid">
          <div className="vibrant-stat-card oxygen-card">
            <div className="stat-top">
              <Droplet size={18} className="text-cyan-400" />
              <span>DISSOLVED OXYGEN</span>
            </div>
            <strong>1.4 mg/L</strong>
            <span className="status-crit-pill">CRITICAL HYPOXIA</span>
          </div>

          <div className="vibrant-stat-card ph-card">
            <div className="stat-top">
              <Flame size={18} className="text-violet-400" />
              <span>pH LEVEL</span>
            </div>
            <strong>9.8 pH</strong>
            <span className="status-alkali-pill">ALKALINE SPIKE</span>
          </div>

          <div className="vibrant-stat-card turbidity-card">
            <div className="stat-top">
              <Zap size={18} className="text-amber-400" />
              <span>TURBIDITY</span>
            </div>
            <strong>84 NTU</strong>
            <span className="status-toxic-pill">CHEMICAL EFFLUENT</span>
          </div>

          <div className="vibrant-stat-card authority-card">
            <div className="stat-top">
              <ShieldAlert size={18} className="text-emerald-400" />
              <span>REGULATORY RELAY</span>
            </div>
            <strong>State PCB & Police</strong>
            <span className="status-sla-pill">SLA &lt; 2 HOURS</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="delivery-actions-footer">
          <button
            type="button"
            className="simulate-new-btn"
            disabled={isSimulating}
            onClick={handleSimulateNew}
          >
            <RotateCcw size={16} className={isSimulating ? "animate-spin" : ""} />
            <span>{isSimulating ? "Simulating Live Dispatch Pipeline…" : "Simulate New Incident Dispatch"}</span>
          </button>

          <Link to="/report" className="official-report-link">
            <span>Submit Official Citizen Lake Report</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
