import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Truck,
  Compass,
  Plus,
  Bell,
  Building2,
  Leaf,
  Settings,
  Waves,
  X,
  User,
  ChevronRight,
  LogOut,
  LogIn,
} from "lucide-react";
import { useSession } from "../session";
import { api } from "../api";

export function openSideMenuDrawer() {
  window.dispatchEvent(new CustomEvent("aquarelay-open-drawer"));
}

const MENU_OPTIONS = [
  { to: "/", title: "Home", icon: Home },
  { to: "/following", title: "Following", icon: Truck },
  { to: "/integrations", title: "Integrations", icon: Building2 },
  { to: "/explore", title: "Explore Waters", icon: Compass },
  { to: "/report", title: "Report Observation", icon: Plus, badge: "+ Report" },
  { to: "/notifications", title: "Updates & Alerts", icon: Bell },
  { to: "/workspace", title: "Case Workspace", icon: Building2 },
  { to: "/registry", title: "Registry & Field Records", icon: Building2 },
  { to: "/organisations", title: "Organisations", icon: Leaf },
];

export default function SideMenuDrawer(props?: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const { user, refresh, setUser } = useSession();
  const location = useLocation();
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = props?.isOpen !== undefined ? props.isOpen : internalOpen;
  const handleClose = () => {
    setInternalOpen(false);
    props?.onClose?.();
  };

  // Listen to global open event
  useEffect(() => {
    const handleOpen = () => setInternalOpen(true);
    window.addEventListener("aquarelay-open-drawer", handleOpen);
    return () => window.removeEventListener("aquarelay-open-drawer", handleOpen);
  }, []);

  // Close on route change
  useEffect(() => {
    handleClose();
  }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Backdrop Scrim */}
      <div
        className={`drawer-backdrop ${isOpen ? "open" : ""}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <aside
        className={`side-menu-drawer pureflow-wide-drawer ${isOpen ? "drawer-open" : ""}`}
        aria-label="AquaRelay Navigation"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {/* Drawer Header with Logo & Close button */}
        <div className="drawer-header">
          <div
            className="brand logo-clickable"
            onClick={handleClose}
            title="AquaRelay Home"
          >
            <span className="brand-mark pureflow-mark">
              <Waves size={20} />
            </span>
            <span className="pureflow-drawer-title">
              AquaRelay<span className="brand-period">.</span>
            </span>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            aria-label="Close navigation menu"
            onClick={handleClose}
          >
            <X size={19} />
          </button>
        </div>

        {/* Profile Section at Top with Settings & Profile Logo */}
        <div className="drawer-profile-card">
          <Link
            to="/settings"
            className="drawer-profile-main"
            onClick={handleClose}
            style={{ textDecoration: "none", color: "inherit", flex: 1, display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
            title="View & Edit Profile"
          >
            <span className="drawer-profile-avatar">
              {user?.name ? (
                user.name.charAt(0).toUpperCase()
              ) : (
                <User size={19} />
              )}
            </span>
            <div className="drawer-profile-info">
              <span className="drawer-profile-name">{user?.name || "Public Visitor"}</span>
              <span className="drawer-profile-handle" style={{ fontSize: "11px", color: "#d97706", fontWeight: 700 }}>
                @{user?.username || (user?.email ? user.email.split("@")[0] : "visitor")}
                {user?.age ? ` · ${user.age} yrs` : ""}
              </span>
              <span className="drawer-profile-role" style={{ fontSize: "11px", color: "#64748b" }}>
                {user?.role ? user.role.replaceAll("_", " ") : "Citizen Watchdog"}
              </span>
            </div>
          </Link>
          <Link
            to="/settings"
            className="drawer-settings-btn"
            onClick={handleClose}
            title="Edit Profile & Settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </Link>
        </div>

        {/* Navigation List: High-contrast Yellow Theme */}
        <nav className="pureflow-drawer-nav" aria-label="Main navigation">
          {MENU_OPTIONS.filter(item=>!["/integrations","/workspace","/registry"].includes(item.to)||user?.role==="admin"||!!user?.organisation_id).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`drawer-nav-item ${isActive ? "active" : ""}`}
                onClick={handleClose}
              >
                <span className="drawer-nav-icon-box">
                  <Icon size={18} />
                </span>
                <span className="drawer-nav-title">{item.title}</span>
                {item.badge && (
                  <span className="drawer-plus-badge">{item.badge}</span>
                )}
                <ChevronRight size={15} className="drawer-nav-arrow" />
              </Link>
            );
          })}
        </nav>

        {/* Drawer Bottom Actions */}
        <div className="drawer-bottom-card">
          {user ? (
            <button
              type="button"
              className="drawer-session-btn"
              onClick={async () => {
                try {
                  await api("/auth/logout", { method: "POST" });
                } catch {}
                setUser(null);
                await refresh();
                handleClose();
              }}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="drawer-session-btn"
              onClick={handleClose}
            >
              <LogIn size={16} />
              <span>Sign in / Access Org</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
