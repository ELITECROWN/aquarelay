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
            <span className="brand-mark">
              <Waves size={25} />
            </span>
            AquaRelay<span className="brand-period">.</span>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            aria-label="Close navigation menu"
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation List: Identical to Sidebar */}
        <nav aria-label="Main navigation">
          {MENU_OPTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={isActive ? "active" : ""}
                onClick={handleClose}
              >
                <Icon size={18} />
                <span>{item.title}</span>
                {item.to === "/report" && <span className="nav-plus">+</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
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
            className="account"
            onClick={handleClose}
          >
            <span className="avatar">{user ? user.name.charAt(0) : "G"}</span>
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
