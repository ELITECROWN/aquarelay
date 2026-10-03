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
  HelpCircle,
  ChevronDown,
  Waves,
  X,
  ArrowRight,
} from "lucide-react";
import { useSession } from "../session";

export function openSideMenuDrawer() {
  window.dispatchEvent(new CustomEvent("aquarelay-open-drawer"));
}

const MENU_OPTIONS = [
  { to: "/", title: "Home", icon: Home },
  { to: "/dispatch-tracker", title: "Track", icon: Truck },
  { to: "/explore", title: "Explore waters", icon: Compass },
  { to: "/report", title: "Report observation", icon: Plus },
  { to: "/notifications", title: "Updates", icon: Bell },
  { to: "/workspace", title: "Case workspace", icon: Building2 },
  { to: "/organisations", title: "Organisations", icon: Leaf },
];

export default function SideMenuDrawer(props?: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const { user } = useSession();
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

      {/* Slide-out Drawer with IDENTICAL Sidebar Design */}
      <aside
        className={`side-menu-drawer sidebar ${isOpen ? "drawer-open" : ""}`}
        aria-label="Lake Watchdog Navigation"
      >
        <div className="drawer-header">
          <div
            className="brand logo-clickable"
            onClick={handleClose}
            title="Close menu"
          >
            <span className="brand-mark pureflow-mark">
              <Waves size={22} />
            </span>
            <span className="pureflow-drawer-title">AquaRelay<span className="brand-period">.</span></span>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            aria-label="Close navigation menu"
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Featured Impact Card from PureFlow Theme */}
        <div className="drawer-feature-card">
          <span className="feature-eyebrow">
            <span className="feature-amber-dot" /> OUR MISSION
          </span>
          <h4>Building Systems That Last for Generations.</h4>
          <p>Access to safe water is the foundation for healthy, thriving communities.</p>
          <Link to="/explore" onClick={handleClose} className="drawer-feature-link">
            Explore Catchments <ArrowRight size={13} />
          </Link>
        </div>

        {/* Navigation List: PureFlow Pill Style */}
        <nav className="pureflow-drawer-nav" aria-label="Main navigation">
          {MENU_OPTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`drawer-nav-item ${isActive ? "active" : ""}`}
                onClick={handleClose}
              >
                <Icon size={18} />
                <span>{item.title}</span>
                {item.to === "/report" && <span className="drawer-plus-badge">+ Report</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom drawer-footer-pureflow">
          <Link
            className="help-link"
            to="/settings"
            onClick={handleClose}
          >
            <HelpCircle size={17} />
            <span>Account & preferences</span>
          </Link>
          <Link
            to={user ? "/settings" : "/login"}
            className="account drawer-account"
            onClick={handleClose}
          >
            <span className="avatar amber-avatar">{user ? user.name.charAt(0) : "G"}</span>
            <span>
              <strong>{user?.name || "Public visitor"}</strong>
              <small>
                {user?.role.replaceAll("_", " ") ||
                  "Explore without an account"}
              </small>
            </span>
            <ChevronDown size={15} />
          </Link>
        </div>
      </aside>
    </>
  );
}
