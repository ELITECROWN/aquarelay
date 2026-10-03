import { useEffect, useState } from "react";
import {
  NavLink,
  Link,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Home,
  Truck,
  Waves,
  Compass,
  Plus,
  Bell,
  Building2,
  Search,
  ArrowUpRight,
  HelpCircle,
  ChevronDown,
  Leaf,
  Menu,
  X,
  Radio,
} from "lucide-react";
import { api } from "./api";
import { useSession } from "./session";
import {
  ExplorePage,
  PassportPage,
  LandingPage,
  NotificationsPage,
  OrganisationsPage,
  LoginPage,
  SettingsPage,
} from "./pages";
import ReportPage from "./features/ReportPage";
import IncidentPage from "./features/IncidentPage";
import WorkspacePage from "./features/WorkspacePage";
import DispatchDetailsPage from "./features/DispatchDetailsPage";
import { Empty } from "./ui";
import FluidWaterCanvas from "./components/FluidWaterCanvas";
import ThreeDWaterScene from "./components/ThreeDWaterScene";
import WaterSlideTrail from "./components/WaterSlideTrail";
import SideMenuDrawer, { openSideMenuDrawer } from "./components/SideMenuDrawer";
import LusionCursor from "./components/LusionCursor";
import Error404Page from "./components/Error404Page";
import BefreakyPreloader from "./components/BefreakyPreloader";
const mainNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dispatch-tracker", label: "Track", icon: Truck },
  { to: "/explore", label: "Explore waters", icon: Compass },
  { to: "/report", label: "Report observation", icon: Plus },
  { to: "/notifications", label: "Updates", icon: Bell },
  { to: "/workspace", label: "Case workspace", icon: Building2 },
  { to: "/organisations", label: "Organisations", icon: Leaf },
];
const bottomNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dispatch-tracker", label: "Track", icon: Truck },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/report", label: "Report", icon: Plus },
  { to: "/notifications", label: "Updates", icon: Bell },
];
export default function App() {
  const { user } = useSession();
  const navigate = useNavigate(),
    location = useLocation(),
    client = useQueryClient();
  const [search, setSearch] = useState(""),
    [menu, setMenu] = useState(false),
    [live, setLive] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<{ demo_mode: boolean }>("/config"),
    staleTime: Infinity,
  });
  useEffect(() => {
    setMenu(false);
    document.title = `AquaRelay · ${location.pathname.split("/")[1] || "Every water body has a history"}`;
  }, [location.pathname]);
  useEffect(() => {
    let stream: EventSource | undefined;
    let pendingRefresh: number | undefined;
    let refreshing = false;
    let dirty = false;
    let disposed = false;
    const cursorKey = "aquarelay-public-event-cursor";
    let cursor = "0";
    try {
      const stored = sessionStorage.getItem(cursorKey);
      if (stored && /^\d{1,20}$/.test(stored)) cursor = stored;
    } catch {
      // Live updates also work when browser storage is unavailable.
    }
    const filters = {
      predicate: (q: { queryKey: readonly unknown[] }) =>
        !["session", "config"].includes(String(q.queryKey[0])),
    };
    const refresh = () => {
      dirty = true;
      if (disposed || refreshing || pendingRefresh !== undefined) return;
      pendingRefresh = window.setTimeout(async () => {
        pendingRefresh = undefined;
        refreshing = true;
        dirty = false;
        const alreadyFetching = client
          .getQueryCache()
          .findAll(filters)
          .some((q) => q.isActive() && q.state.fetchStatus === "fetching");
        try {
          await client.invalidateQueries(filters, { cancelRefetch: false });
        } finally {
          refreshing = false;
          // An older in-flight response can clear invalidation. Fetch once more
          // after it settles, and also preserve events received during refresh.
          if (!disposed && (alreadyFetching || dirty)) refresh();
        }
      }, 250);
    };
    const onUpdate = (event: MessageEvent) => {
      if (/^\d{1,20}$/.test(event.lastEventId)) {
        try {
          sessionStorage.setItem(cursorKey, event.lastEventId);
        } catch {
          // EventSource retains its own reconnect cursor for this connection.
        }
      }
      // A replay batch can contain hundreds of committed events. Refresh each
      // active query once per burst, without cancelling an in-flight fetch.
      refresh();
    };
    const isStaticDeployment = window.location.hostname.includes("vercel.app");
    if (!isStaticDeployment) {
      try {
        stream = new EventSource(`/api/v1/events/stream?after=${cursor}`, {
          withCredentials: true,
        });
        stream.onopen = () => setLive(true);
        stream.onmessage = onUpdate;
        stream.addEventListener("update", onUpdate);
        stream.onerror = () => {
          setLive(false);
          try {
            stream?.close();
          } catch {}
        };
      } catch {
        setLive(false);
      }
    }
    const timer = window.setInterval(refresh, 30000);
    return () => {
      disposed = true;
      stream?.close();
      window.clearInterval(timer);
      if (pendingRefresh !== undefined) window.clearTimeout(pendingRefresh);
    };
  }, [client]);
  if (!isOnline) {
    return (
      <>
        <LusionCursor />
        <Error404Page isOffline={true} />
      </>
    );
  }
  if (location.pathname === "/")
    return (
      <>
        <BefreakyPreloader />
        <LusionCursor />
        <ThreeDWaterScene />
        <WaterSlideTrail />
        <SideMenuDrawer />
        <LandingPage />
      </>
    );
  return (
    <div className="app-shell">
      <BefreakyPreloader />
      <LusionCursor />
      <ThreeDWaterScene />
      <WaterSlideTrail />
      <SideMenuDrawer />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <div
          className="brand logo-clickable"
          onClick={openSideMenuDrawer}
          title="Click to open menu drawer"
        >
          <span className="brand-mark">
            <Waves size={25} />
          </span>
          AquaRelay<span className="brand-period">.</span>
        </div>
        <button
          className="sidebar-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <nav aria-label="Main navigation">
          {mainNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={18} />
              {label}
              {to === "/report" && <span className="nav-plus">+</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note">
            <span className="small-icon">
              <Leaf size={18} />
            </span>
            <h3>
              A shared record.
              <br />A clearer picture.
            </h3>
            <p>Every observation adds to a place’s documented history.</p>
            <Link to="/explore">
              Explore water records <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link className="help-link" to="/settings">
            <HelpCircle size={17} />
            Account & preferences
          </Link>
          <Link to={user ? "/settings" : "/login"} className="account">
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
      {menu && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-content">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            <span>AquaRelay</span>
            <span>/</span>
            <strong>
              {location.pathname.includes("waterbodies")
                ? "Water-body passport"
                : location.pathname.includes("incidents")
                  ? "Incident record"
                  : location.pathname.split("/")[1].replaceAll("-", " ")}
            </strong>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/explore?q=${encodeURIComponent(search)}`);
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search water bodies"
              placeholder="Search a water body or locality"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <span className="live-label">
            <Radio size={14} />
            {live ? "Live updates" : "Updates every 30s"}
          </span>
          <Link
            to="/notifications"
            className="icon-button"
            aria-label="Open notifications"
          >
            <Bell size={19} />
          </Link>
        </header>
        {config.data?.demo_mode && (
          <div className="demo-banner">
            <span className="demo-tag">DEMO</span>
            <span>
              Fictional places. Synthetic records. A real, working workflow.
            </span>
            <Link to="/explore">
              Explore the demo <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
        <main id="main">
          <Routes>
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/dispatch-tracker" element={<DispatchDetailsPage />} />
            <Route path="/waterbodies/:id" element={<PassportPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/incidents/:id" element={<IncidentPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/organisations" element={<OrganisationsPage />} />
            <Route path="/organisations/:id" element={<OrganisationsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Error404Page />} />
          </Routes>
        </main>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {bottomNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
