import { Link } from "react-router-dom";
import { ArrowRight, Package, Truck, CheckCircle2 } from "lucide-react";

export default function LakeDeliveryBar() {
  return (
    <div className="delivery-bar-wrapper">
      <Link
        to="/dispatch-tracker"
        className="lake-delivery-bar highlight-bar"
        title="Click to track dispatch status"
      >
        <div className="delivery-bar-left">
          <div className="amazon-delivery-status-pill">
            <span className="amazon-live-dot" />
            <Truck size={14} style={{ color: "#ef4444" }} />
            <span>Out for delivery</span>
          </div>
          <span className="delivery-bar-divider" />
          <div className="delivery-bar-text">
            <strong>Arriving Today</strong>
            <span className="delivery-bar-sub">
              Bellandur Lake Catchment · Patrol Boat Unit #04
            </span>
          </div>
        </div>

        <div className="delivery-bar-center">
          <div className="amazon-mini-track">
            <div className="amazon-mini-fill" style={{ width: "75%" }} />
          </div>
          <span className="mini-step-label">Arriving Today · In Transit</span>
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
