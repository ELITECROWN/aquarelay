import { Link } from "react-router-dom";
import { ArrowRight, Package, Truck, CheckCircle2 } from "lucide-react";

import { useRecord, label } from "../features/workflowShared";
import type { CaseRecord } from "../types";
export default function LakeDeliveryBar() {
  const records=useRecord<{items:CaseRecord[]}>("/cases?page_size=1");
  const latest=records.data?.items[0];
  const progress=latest?.state==="closed"?100:latest?.state==="action_in_progress"?75:latest?.state==="investigating"?50:latest?25:0;
  return (
    <div className="delivery-bar-wrapper">
      <Link
        to="/dispatch-tracker"
        className="lake-delivery-bar highlight-bar"
        title="Open recorded case progress"
      >
        <div className="delivery-bar-left">
          <div className="amazon-delivery-status-pill">
            <span className="amazon-live-dot" />
            <Truck size={14} style={{ color: "#ef4444" }} />
            <span>{records.loading?"Loading":records.error?"Unavailable":latest?label(latest.state):"No recorded cases"}</span>
          </div>
          <span className="delivery-bar-divider" />
          <div className="delivery-bar-text">
            <strong>Incident response records</strong>
            <span className="delivery-bar-sub">
              {latest ? `${latest.waterbody_name}${latest.synthetic ? " · Synthetic demo" : ""}` : "Explore your local water bodies"}
            </span>
          </div>
        </div>

        <div className="delivery-bar-center">
          <div className="amazon-mini-track">
            <div className="amazon-mini-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="mini-step-label">{latest ? latest.title : records.error ? "Records could not be loaded" : "Follow documented actions"}</span>
        </div>

        <div className="delivery-bar-right">
          <span className="view-details-pill amazon-track-btn">
            <span>Track</span>
            <ArrowRight size={13} className="bar-arrow" />
          </span>
        </div>
      </Link>
    </div>
  );
}
