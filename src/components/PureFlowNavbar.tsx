import { Link, useLocation } from "react-router-dom";
import { Waves } from "lucide-react";
import { openSideMenuDrawer } from "./SideMenuDrawer";
import { useSession } from "../session";

export default function PureFlowNavbar() {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useSession();

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
          {user ? (
            <Link
              to="/settings"
              className="pureflow-profile-chip"
              title={`Signed in as ${user.name} (@${user.username || user.email.split("@")[0]})`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px 4px 6px",
                borderRadius: "30px",
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                textDecoration: "none",
                color: "#1e293b",
                fontSize: "12px",
                fontWeight: 600,
                transition: "all 0.2s ease",
              }}
            >
              <span
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#f59e0b",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                @{user.username || user.email.split("@")[0]}
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="pureflow-login-link"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#475569",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: "8px",
              }}
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
    </div>
  );
}
