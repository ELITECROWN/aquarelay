import { Link, useLocation } from "react-router-dom";
import { Waves } from "lucide-react";
import { openSideMenuDrawer } from "./SideMenuDrawer";

export default function PureFlowNavbar() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="pureflow-nav-fixed-container">
      <header className="pureflow-capsule-nav">
        <div
          className="pureflow-nav-logo logo-clickable"
          onClick={openSideMenuDrawer}
          title="Click to open menu"
        >
          <span className="pureflow-droplet-mark">
            <Waves size={18} />
          </span>
          <span className="pureflow-brand-name">AquaRelay</span>
        </div>

        <nav className="pureflow-nav-links">
          <Link to="/" className={path === "/" ? "active" : ""}>
            Home
          </Link>
          <Link
            to="/dispatch-tracker"
            className={path.startsWith("/dispatch-tracker") ? "active" : ""}
          >
            Track
          </Link>
          <Link
            to="/explore"
            className={
              path.startsWith("/explore") || path.startsWith("/waterbodies")
                ? "active"
                : ""
            }
          >
            Explore
          </Link>
          <Link
            to="/notifications"
            className={path.startsWith("/notifications") ? "active" : ""}
          >
            Updates
          </Link>
          <Link
            to="/organisations"
            className={path.startsWith("/organisations") ? "active" : ""}
          >
            Organisations
          </Link>
        </nav>

        <div className="pureflow-nav-right">
          <Link
            to="/report"
            className={`pureflow-nav-btn ${path.startsWith("/report") ? "active" : ""}`}
          >
            Report Anomaly
          </Link>
        </div>
      </header>
    </div>
  );
}
