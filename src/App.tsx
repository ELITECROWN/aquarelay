import React, { Component, type ReactNode, useEffect, useState } from "react";
import {
  NavLink,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Home,
  Truck,
  Compass,
  Plus,
  Bell,
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
  FollowingPage,
} from "./pages";
import ReportPage from "./features/ReportPage";
import IncidentPage from "./features/IncidentPage";
import WorkspacePage from "./features/WorkspacePage";
import RegistryWorkspace from "./features/RegistryWorkspace";
import AccountRecovery from './features/AccountRecovery';
import ImportPage from "./features/ImportPage";
import IntegrationsPage from "./features/IntegrationsPage";
import DispatchDetailsPage from "./features/DispatchDetailsPage";
import ThreeDWaterScene from "./components/ThreeDWaterScene";
import WaterSlideTrail from "./components/WaterSlideTrail";
import SideMenuDrawer from "./components/SideMenuDrawer";
import Error404Page from "./components/Error404Page";
import BefreakyPreloader from "./components/BefreakyPreloader";
import PureFlowNavbar from "./components/PureFlowNavbar";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Error404Page
          title="Something went wrong"
          message={
            this.state.error?.message ||
            "An unexpected error occurred while loading this view."
          }
        />
      );
    }
    return this.props.children;
  }
}

const bottomNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dispatch-tracker", label: "Track", icon: Truck },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/report", label: "Report", icon: Plus },
  { to: "/notifications", label: "Updates", icon: Bell },
];

export default function App() {
  const { user } = useSession();
  const location = useLocation(),
    client = useQueryClient();
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
    } catch {}

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
          if (!disposed && (alreadyFetching || dirty)) refresh();
        }
      }, 250);
    };
    const onUpdate = (event: MessageEvent) => {
      if (/^\d{1,20}$/.test(event.lastEventId)) {
        try {
          sessionStorage.setItem(cursorKey, event.lastEventId);
        } catch {}
      }
      refresh();
    };
    try {
      stream = new EventSource(`/api/v1/events/stream?after=${cursor}`, {
        withCredentials: true,
      });
      stream.onmessage = onUpdate;
      stream.addEventListener("update", onUpdate);
      stream.onerror = () => {
        try {
          stream?.close();
        } catch {}
      };
    } catch {}
    const timer = window.setInterval(refresh, 30000);
    return () => {
      disposed = true;
      stream?.close();
      window.clearInterval(timer);
      if (pendingRefresh !== undefined) window.clearTimeout(pendingRefresh);
    };
  }, [client]);

  const isHome = location.pathname === "/";

  return (
    <div className="pureflow-app-root">
      <BefreakyPreloader />
      <ThreeDWaterScene />
      <WaterSlideTrail />
      <SideMenuDrawer />
      <PureFlowNavbar />
      {!isOnline && <div className="section-note" role="status">Offline — you can save report drafts on this device. Server records and submissions require a connection.</div>}
      {config.data?.demo_mode && <div className="section-note" role="status">Demonstration environment — fictional water bodies and records are labelled synthetic.</div>}

      <ErrorBoundary>
        <main
          id="main"
          className={isHome ? "pureflow-home-main" : "pureflow-inner-main"}
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/dispatch-tracker" element={<DispatchDetailsPage />} />
            <Route path="/waterbodies/:id" element={<PassportPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/incidents/:id" element={<IncidentPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/registry" element={<RegistryWorkspace />} />
            <Route path="/account/recovery" element={<AccountRecovery />} />
            <Route path="/account/verify" element={<AccountRecovery />} />
            <Route path="/following" element={<FollowingPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/integrations/import" element={<ImportPage />} />
            <Route path="/integrations/:id" element={<IntegrationsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/organisations" element={<OrganisationsPage />} />
            <Route path="/organisations/:id" element={<OrganisationsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Error404Page />} />
          </Routes>
        </main>
      </ErrorBoundary>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {bottomNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
