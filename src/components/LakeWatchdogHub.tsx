import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Send,
  Building,
  ShieldAlert,
  Flame,
  Droplet,
  Fish,
  Radio,
  FileCheck2,
  Clock,
  Compass,
  ArrowRight,
  Sparkles,
  Zap,
} from "lucide-react";

interface LakeInfo {
  id: string;
  name: string;
  location: string;
  coordinates: string;
  baselineWQI: number;
  threatLevel: "Low" | "Moderate" | "Critical";
  assignedAuthority: string;
  secondaryAuthority: string;
}

const FEATURED_LAKES: LakeInfo[] = [
  {
    id: "lake-bellandur",
    name: "Bellandur Lake Catchment",
    location: "South-East Wetland Basin",
    coordinates: "12.9352° N, 77.6710° E",
    baselineWQI: 31,
    threatLevel: "Critical",
    assignedAuthority: "Central & State Pollution Control Board (CPCB)",
    secondaryAuthority: "Municipal Lake Development & Bio-Reserve Authority",
  },
  {
    id: "wb-reedwater",
    name: "Reedwater Nature Reserve",
    location: "Eastern Wetland Corridor",
    coordinates: "52.1284° N, 0.4519° E",
    baselineWQI: 68,
    threatLevel: "Moderate",
    assignedAuthority: "National Water Resources & Catchment Board",
    secondaryAuthority: "Wetlands Ecological Protection Bureau",
  },
  {
    id: "lake-emerald",
    name: "Emerald Basin Reservoir",
    location: "Northern Alpine Drainage",
    coordinates: "46.8523° N, 8.2241° E",
    baselineWQI: 84,
    threatLevel: "Low",
    assignedAuthority: "Regional Clean Water & Sanitation Agency",
    secondaryAuthority: "Forestry & Watershed Directorate",
  },
  {
    id: "lake-silver",
    name: "Silver Bay Estuary",
    location: "Coastal Urban Inflow",
    coordinates: "37.7749° N, -122.4194° W",
    baselineWQI: 54,
    threatLevel: "Moderate",
    assignedAuthority: "Maritime & Estuary Environmental Police",
    secondaryAuthority: "Department of Environmental Quality Enforcement",
  },
];

interface SuspiciousActivity {
  id: string;
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  severity: "High" | "Critical" | "Emergency";
  simulatedDO: string;
  simulatedPH: string;
  simulatedTurbidity: string;
}

const ACTIVITIES: SuspiciousActivity[] = [
  {
    id: "chemical-effluent",
    icon: Flame,
    title: "Toxic Chemical Foam & Effluent",
    description: "Thick chemical froth, pungent caustic odor, unnatural white/colored scum spreading from inlet.",
    severity: "Critical",
    simulatedDO: "1.4 mg/L (Severe Hypoxia)",
    simulatedPH: "9.8 (Corrosive Alkali)",
    simulatedTurbidity: "84 NTU (Heavy Contamination)",
  },
  {
    id: "algal-bloom",
    icon: Droplet,
    title: "Dense Cyanobacteria / Algae Bloom",
    description: "Pea-soup emerald green or reddish slime layer choking water surface, oxygen depletion.",
    severity: "High",
    simulatedDO: "2.1 mg/L (Critical Drop)",
    simulatedPH: "8.6 (Alkaline Drift)",
    simulatedTurbidity: "62 NTU (High Slime Density)",
  },
  {
    id: "fish-mortality",
    icon: Fish,
    title: "Mass Fish Kill & Wildlife Distress",
    description: "Multiple fish species surfacing or dead along shoreline; birds avoiding the water body.",
    severity: "Emergency",
    simulatedDO: "0.8 mg/L (Acute Anoxia)",
    simulatedPH: "5.4 (Acidic Discharge)",
    simulatedTurbidity: "95 NTU (Extreme Toxicity)",
  },
  {
    id: "illegal-dumping",
    icon: AlertTriangle,
    title: "Unauthorized Sludge / Waste Dumping",
    description: "Direct tanker discharge, illegal drainage bypass pipes, visible oily sheen or heavy black sludge.",
    severity: "Critical",
    simulatedDO: "2.8 mg/L (Stressed)",
    simulatedPH: "6.1 (Organic Overload)",
    simulatedTurbidity: "120 NTU (Severe Sediment)",
  },
];

export default function LakeWatchdogHub() {
  const [selectedLake, setSelectedLake] = useState<LakeInfo>(FEATURED_LAKES[0]);
  const [selectedActivity, setSelectedActivity] = useState<SuspiciousActivity>(ACTIVITIES[0]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [dispatchedTicket, setDispatchedTicket] = useState<{
    id: string;
    timestamp: string;
    authorityName: string;
    routingTimeMs: number;
    protocolHash: string;
  } | null>(null);

  const handleDispatch = () => {
    setIsTransmitting(true);
    setDispatchedTicket(null);

    // Simulate instant automated encrypted protocol transmission to authority
    setTimeout(() => {
      setIsTransmitting(false);
      setDispatchedTicket({
        id: `AUTH-LK-${Math.floor(1000 + Math.random() * 9000)}-${selectedActivity.severity.toUpperCase()}`,
        timestamp: new Date().toLocaleTimeString(),
        authorityName: selectedLake.assignedAuthority,
        routingTimeMs: Math.floor(280 + Math.random() * 190),
        protocolHash: `0x${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      });
    }, 1200);
  };

  return (
    <section className="lusion-watchdog-hub" id="watchdog-hub">
      {/* Background ambient red glow aura */}
      <div className="watchdog-ambient-glow" aria-hidden="true" />

      <div className="watchdog-header">
        <div className="watchdog-badge">
          <span className="radar-pulse" />
          <Radio size={14} className="text-rose-500 animate-pulse" />
          <span>AUTOMATED CITIZEN-TO-AUTHORITY DISPATCH</span>
        </div>
        <h2>
          Suspicious Activity Watchdog<span>.</span>
        </h2>
        <p>
          Witnessed unusual water discoloration, chemical foaming, or wildlife distress?
          Select the lake below — our system calculates instant contamination metrics and{" "}
          <strong>automatically transmits a verified escalation packet to the environmental authorities</strong>.
        </p>
      </div>

      <div className="watchdog-grid">
        {/* Step 1: Lake Selector */}
        <div className="watchdog-card glass-panel interactive">
          <div className="step-tag">
            <span>STEP 01</span>
            <strong>Select Target Lake</strong>
          </div>

          <div className="lake-select-list">
            {FEATURED_LAKES.map((lake) => {
              const isSelected = selectedLake.id === lake.id;
              return (
                <button
                  key={lake.id}
                  type="button"
                  onClick={() => {
                    setSelectedLake(lake);
                    setDispatchedTicket(null);
                  }}
                  className={`lake-item-btn ${isSelected ? "selected" : ""}`}
                >
                  <div className="lake-item-top">
                    <span className="lake-name">{lake.name}</span>
                    <span
                      className={`lake-threat-pill ${
                        lake.threatLevel === "Critical"
                          ? "threat-critical"
                          : lake.threatLevel === "Moderate"
                            ? "threat-moderate"
                            : "threat-low"
                      }`}
                    >
                      {lake.threatLevel} Risk
                    </span>
                  </div>
                  <div className="lake-meta">
                    <span>
                      <Compass size={12} /> {lake.location}
                    </span>
                    <span>WQI {lake.baselineWQI}/100</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lake-authority-preview">
            <small>DESIGNATED JURISDICTION & RESPONDER</small>
            <div className="authority-box">
              <Building size={16} className="text-rose-600 flex-shrink-0" />
              <div>
                <strong>{selectedLake.assignedAuthority}</strong>
                <p>Primary Environmental Enforcement Bureau</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Suspicious Activity Choice */}
        <div className="watchdog-card glass-panel interactive">
          <div className="step-tag">
            <span>STEP 02</span>
            <strong>Identify Suspicious Activity</strong>
          </div>

          <div className="activity-options">
            {ACTIVITIES.map((act) => {
              const isSelected = selectedActivity.id === act.id;
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setSelectedActivity(act);
                    setDispatchedTicket(null);
                  }}
                  className={`activity-item-btn ${isSelected ? "selected" : ""}`}
                >
                  <div className="activity-icon-wrap">
                    <Icon size={18} />
                  </div>
                  <div className="activity-content">
                    <div className="activity-title-row">
                      <strong>{act.title}</strong>
                      <span className={`act-sev-badge ${act.severity.toLowerCase()}`}>
                        {act.severity}
                      </span>
                    </div>
                    <p>{act.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Automated Authority Dispatch Transmission Engine */}
        <div className="watchdog-card glass-panel dispatch-console interactive">
          <div className="step-tag">
            <span>STEP 03</span>
            <strong>Real-Time Authority Protocol</strong>
          </div>

          {/* Simulated Sensor Telemetry */}
          <div className="telemetry-banner">
            <span className="telemetry-title">
              <Sparkles size={14} style={{ color: "#ef4444" }} /> REAL-TIME SENSOR TELEMETRY ANALYSIS
            </span>
            <div className="telemetry-stats">
              <div className="telemetry-stat">
                <small>Dissolved Oxygen</small>
                <strong>{selectedActivity.simulatedDO}</strong>
              </div>
              <div className="telemetry-stat">
                <small>pH Anomaly</small>
                <strong>{selectedActivity.simulatedPH}</strong>
              </div>
              <div className="telemetry-stat">
                <small>Turbidity Level</small>
                <strong>{selectedActivity.simulatedTurbidity}</strong>
              </div>
            </div>
          </div>

          {/* Automated Pipeline Visualizer */}
          <div className="pipeline-flow">
            <div className="pipeline-node node-citizen">
              <div className="node-icon">👤</div>
              <span>Citizen Observer</span>
            </div>

            <div className={`pipeline-track ${isTransmitting ? "animating" : dispatchedTicket ? "active" : ""}`}>
              <div className="data-packet" />
            </div>

            <div className="pipeline-node node-triage">
              <div className="node-icon">⚡</div>
              <span>Rapid Triage</span>
            </div>

            <div className={`pipeline-track ${isTransmitting ? "animating" : dispatchedTicket ? "active" : ""}`}>
              <div className="data-packet" />
            </div>

            <div className="pipeline-node node-authority">
              <div className="node-icon">🚨</div>
              <span>Higher Authority</span>
            </div>
          </div>

          {/* Trigger Dispatch Action */}
          {!dispatchedTicket ? (
            <div className="dispatch-action-area">
              <button
                type="button"
                className="dispatch-trigger-btn"
                disabled={isTransmitting}
                onClick={handleDispatch}
              >
                {isTransmitting ? (
                  <>
                    <span className="spinner-rose" />
                    <span>Encrypting & Transmitting to Authority…</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Transmit Report & Dispatch Authorities</span>
                    <Zap size={16} className="text-amber-300 ml-1" />
                  </>
                )}
              </button>
              <small className="dispatch-disclaimer">
                Transmits authenticated GPS coordinates, water health anomaly vector, and priority notification to {selectedLake.assignedAuthority}.
              </small>
            </div>
          ) : (
            <div className="dispatched-receipt animate-fade-in">
              <div className="receipt-header">
                <FileCheck2 size={24} className="text-emerald-500 flex-shrink-0" />
                <div>
                  <strong>AUTOMATED DISPATCH CONFIRMED</strong>
                  <p>Escalation packet logged and delivered to higher command.</p>
                </div>
              </div>

              <div className="receipt-details">
                <div className="receipt-row">
                  <span>Case Ticket ID:</span>
                  <span className="font-mono text-rose-600 font-bold">{dispatchedTicket.id}</span>
                </div>
                <div className="receipt-row">
                  <span>Target Authority:</span>
                  <span>{dispatchedTicket.authorityName}</span>
                </div>
                <div className="receipt-row">
                  <span>Routing Latency:</span>
                  <span>{dispatchedTicket.routingTimeMs} ms (Automated Relay)</span>
                </div>
                <div className="receipt-row">
                  <span>Status:</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <Clock size={13} /> Field Inspection Unit Notified
                  </span>
                </div>
              </div>

              <div className="receipt-buttons">
                <Link
                  to={`/report?waterbody=${selectedLake.id}`}
                  className="button primary full"
                >
                  Attach Photos / Formal Report <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  className="button secondary full"
                  onClick={() => setDispatchedTicket(null)}
                >
                  Test Another Activity
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
