import {
  Component,
  useEffect,
  useState,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Waves,
  Search,
  SlidersHorizontal,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Plus,
  Bookmark,
  Share2,
  ChevronRight,
  Clock,
  Database,
  Leaf,
  Check,
  CheckCheck,
  Filter,
  X,
  Map as MapIcon,
  List,
  Info,
  Download,
  ExternalLink,
  Mail,
  Bell,
  LogOut,
  FileJson,
  Compass,
  Plug,
  ShieldAlert,
  Zap,
  ChevronDown,
  ChevronUp,
  Heart,
  Sparkles,
} from "lucide-react";
import { api } from "./api";
import { useSession } from "./session";
import { useToast, PageHeader, Empty, Badge, formatDate, Modal } from "./ui";
import type { WaterBody, Passport, RecordedEvent } from "./types";
const LazyMap = lazy(() => import("./MapView"));
function MapUnavailable() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <div className="map-view map-unavailable" role="status">
      <MapIcon size={32} aria-hidden="true" />
      <strong>Map could not be loaded.</strong>
      <p>The records on this page remain available.</p>
      {online ? (
        <button
          className="button button-secondary"
          onClick={() => window.location.reload()}
        >
          Reload map
        </button>
      ) : (
        <p>Reconnect to load the map.</p>
      )}
    </div>
  );
}
class MapBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <MapUnavailable /> : this.props.children;
  }
}
function MapView(props: {
  items: WaterBody[];
  selected?: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <MapBoundary>
      <Suspense
        fallback={
          <div className="map-view loading" role="status">
            Loading interactive map…
          </div>
        }
      >
        <LazyMap {...props} />
      </Suspense>
    </MapBoundary>
  );
}
import { workflowLabel } from "./labels";
import ShareModal from "./features/ShareModal";
import LakeDeliveryBar from "./components/LakeDeliveryBar";
import RiverCleanCinemaSection from "./components/RiverCleanCinemaSection";
import PureFlowHeroVideo from "./components/PureFlowHeroVideo";
import { openSideMenuDrawer } from "./components/SideMenuDrawer";

function useRegistry(query = "") {
  return useQuery({
    queryKey: ["waterbodies", query],
    queryFn: () =>
      api<{ items: WaterBody[]; total: number }>(
        `/waterbodies${query ? "?" + query : ""}`,
      ),
  });
}
function QueryState({
  loading,
  error,
}: {
  loading: boolean;
  error: Error | null;
}) {
  return loading ? (
    <div className="loading" role="status">
      <span className="spinner" />
      Loading committed records…
    </div>
  ) : error ? (
    <Empty title="Records could not be loaded">
      {error.message}. Please check the server connection and retry.
    </Empty>
  ) : null;
}
function DemoLabel({ synthetic = false }: { synthetic?: boolean }) {
  return synthetic ? (
    <span className="record-demo">Synthetic demo record</span>
  ) : null;
}
function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => api<{ demo_mode: boolean }>("/config"),
    staleTime: Infinity,
  });
}
function WaterCard({
  water,
  onSelect,
  selected = false,
}: {
  water: WaterBody;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const content = (
    <>
      <div className="water-card-head">
        <span className={`water-symbol water-${water.type}`}>
          <Waves size={20} />
        </span>
        <span className="water-type">{water.type}</span>
        {selected && <Check size={16} />}
      </div>
      <h3>{water.name}</h3>
      <p className="locality">
        <MapPin size={12} />
        {water.locality}
      </p>
      <div className="water-card-meta">
        <Badge state={water.case_count ? "open" : "neutral"}>
          {water.case_count
            ? `${water.case_count} open ${water.case_count === 1 ? "case" : "cases"}`
            : "No open cases"}
        </Badge>
        <span>{water.source_count} sources</span>
      </div>
      <div className="water-card-foot">
        <DemoLabel synthetic={water.synthetic} />
        <ChevronRight size={15} />
      </div>
    </>
  );
  return onSelect ? (
    <button
      className={`water-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      {content}
    </button>
  ) : (
    <Link className="water-card" to={`/waterbodies/${water.id}`}>
      {content}
    </Link>
  );
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || ""),
    [type, setType] = useState(""),
    [state, setState] = useState(""),
    [availability, setAvailability] = useState(""),
    [filters, setFilters] = useState(false),
    [mode, setMode] = useState("map"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selected, setSelected] = useState("");
  useEffect(() => setSearch(params.get("q") || ""), [params]);
  const query = new URLSearchParams({
    q: search,
    type,
    state,
    availability,
    start: from,
    end: to,
  }).toString();
  const registry = useRegistry(query);
  const items = registry.data?.items || [];
  const passport = useQuery({
    queryKey: ["passport", selected],
    queryFn: () => api<Passport>(`/waterbodies/${selected}`),
    enabled: !!selected,
  });
  const [share, setShare] = useState(false);
  const { user } = useSession(),
    toast = useToast();
  async function follow() {
    if (!user) {
      toast("Sign in to follow places across devices.");
      return;
    }
    try {
      await api(`/following/${selected}`, { method: "POST" });
      toast("Water body followed. Updates will appear in Following.");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <div className="explore-page">
      <PageHeader
        eyebrow="THE WATER-BODY REGISTRY"
        title="A little closer to your waters."
        description="Explore places, follow their history, and see what’s been recorded."
      >
        <Link className="button primary" to="/report">
          <Plus size={17} />
          Report an observation
        </Link>
      </PageHeader>
      <div className="explorer">
        <section
          className="results-panel"
          aria-label="Accessible water-body results"
        >
          <div className="results-search">
            <Search size={18} />
            <input
              placeholder="Name, alias, or locality"
              aria-label="Filter water-body results"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setParams(e.target.value ? { q: e.target.value } : {});
              }}
            />
            <button
              className={`icon-button ${filters ? "active" : ""}`}
              aria-label="Toggle filters"
              aria-expanded={filters}
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
          {filters && (
            <div className="filters">
              <label>
                Water-body type
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">All types</option>
                  {["lake", "pond", "canal", "stream", "wetland"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Case workflow
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">All activity</option>
                  {[
                    "new",
                    "acknowledged",
                    "investigating",
                    "action_in_progress",
                    "closed",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {workflowLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data availability
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                >
                  <option value="">All sources</option>
                  <option value="available">Recorded observations</option>
                  <option value="stale">Outdated</option>
                </select>
              </label>
              <div className="date-pair">
                <label>
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setType("");
                  setState("");
                  setAvailability("");
                  setFrom("");
                  setTo("");
                  setSearch("");
                  setParams({});
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
          <div className="results-heading">
            <span>{registry.data?.total ?? "…"} registered water bodies</span>
            <div className="view-toggle">
              <button
                className={mode === "map" ? "active" : ""}
                aria-label="Map view"
                aria-pressed={mode === "map"}
                onClick={() => setMode("map")}
              >
                <MapIcon size={16} />
              </button>
              <button
                className={mode === "list" ? "active" : ""}
                aria-label="List view"
                aria-pressed={mode === "list"}
                onClick={() => setMode("list")}
              >
                <List size={16} />
              </button>
            </div>
          </div>
          <QueryState loading={registry.isPending} error={registry.error} />
          <div className="water-results">
            {items.map((w) => (
              <WaterCard
                key={w.id}
                water={w}
                selected={selected === w.id}
                onSelect={() => setSelected(w.id)}
              />
            ))}
            {!registry.isPending && !registry.error && !items.length && (
              <Empty title="No matching waters">
                Try another name or clear the filters.
              </Empty>
            )}
          </div>
          <div className="results-note">
            <Info size={16} />
            <span>
              Activity is a record of cases.
              <br />
              It is not an assessment of water condition.
            </span>
          </div>
        </section>
        <section className={`map-region ${mode === "list" ? "list-mode" : ""}`}>
          <MapView items={items} selected={selected} onSelect={setSelected} />
          {!selected && (
            <div className="map-intro">
              <span className="small-icon">
                <Compass size={20} />
              </span>
              <div>
                <strong>Find a place. Discover its story.</strong>
                <p>Select a marker or a water body to open its record.</p>
              </div>
            </div>
          )}
          {selected && passport.data && (
            <aside className="map-passport" aria-label="Selected water body">
              <div className="passport-mini-cover">
                <span>
                  <Waves size={30} />
                </span>
                <button
                  className="icon-button"
                  aria-label="Close selected water body"
                  onClick={() => setSelected("")}
                >
                  <X size={19} />
                </button>
                <div className="cover-lines" />
                <p>
                  {passport.data.waterbody.synthetic
                    ? "SYNTHETIC DEMONSTRATION PLACE"
                    : "PUBLIC WATER-BODY RECORD"}
                </p>
              </div>
              <div className="mini-body">
                <div className="overline">
                  {passport.data.waterbody.type} · WATER-BODY PASSPORT
                </div>
                <h2>{passport.data.waterbody.name}</h2>
                <p className="locality">
                  <MapPin size={14} />
                  {passport.data.waterbody.locality}
                </p>
                <Badge
                  state={
                    passport.data.waterbody.case_count ? "open" : "neutral"
                  }
                >
                  {workflowLabel(
                    passport.data.waterbody.case_state,
                    passport.data.waterbody.case_count,
                  )}
                </Badge>
                <p className="mini-description">
                  {passport.data.waterbody.summary}
                </p>
                <div className="mini-stats">
                  <div>
                    <strong>{passport.data.waterbody.source_count}</strong>
                    <span>Connected sources</span>
                  </div>
                  <div>
                    <strong>{passport.data.cases.length}</strong>
                    <span>Recorded cases</span>
                  </div>
                </div>
                <div className="mini-latest">
                  <span className="overline">LATEST RECORDED ACTIVITY</span>
                  {passport.data.events[0] ? (
                    <>
                      <h4>{passport.data.events[0].title}</h4>
                      <p>
                        {formatDate(passport.data.events[0].created_at)}
                        {passport.data.events[0].synthetic
                          ? " · Synthetic"
                          : ""}
                      </p>
                    </>
                  ) : (
                    <p>No recorded events</p>
                  )}
                </div>
                <div className="mini-cases">
                  <span className="overline">ALL OPEN CASES</span>
                  {passport.data.cases
                    .filter((c) => c.state !== "closed" && !c.merged_into)
                    .map((c) => (
                      <Link key={c.id} to={`/incidents/${c.id}`}>
                        {c.title}
                        <Badge state={c.state}>{workflowLabel(c.state)}</Badge>
                      </Link>
                    ))}
                  {!passport.data.cases.some(
                    (c) => c.state !== "closed" && !c.merged_into,
                  ) && <p>No open cases — condition not assessed.</p>}
                </div>
                <Link
                  className="button primary full"
                  to={`/waterbodies/${selected}`}
                >
                  Open water-body passport
                  <ArrowRight size={16} />
                </Link>
                <div className="mini-actions">
                  <button onClick={follow}>
                    <Bookmark size={16} />
                    Follow
                  </button>
                  <button onClick={() => setShare(true)}>
                    <Share2 size={16} />
                    Share record
                  </button>
                </div>
              </div>
            </aside>
          )}
          {selected && passport.isPending && (
            <div className="map-message">Loading passport…</div>
          )}
          {selected && passport.error && (
            <div className="map-message" role="alert">
              {passport.error.message}
            </div>
          )}
        </section>
      </div>
      {share && passport.data && (
        <ShareModal
          open={share}
          onClose={() => setShare(false)}
          waterbody={passport.data.waterbody}
        />
      )}
    </div>
  );
}

const tabs = [
  "Overview",
  "History",
  "Biodiversity",
  "Monitoring",
  "Incidents",
  "Actions",
  "Connections",
  "Sources",
];
function EventTimeline({ events }: { events: RecordedEvent[] }) {
  return (
    <div className="timeline">
      {events.map((e) => (
        <article className="timeline-event" id={e.id} key={e.id}>
          <span className={`timeline-icon ${e.kind}`}>
            <Clock size={16} />
          </span>
          <div>
            <div className="event-meta">
              <span>{formatDate(e.created_at)}</span>
              <DemoLabel synthetic={e.synthetic} />
            </div>
            <h3>
              {e.case_id ? (
                <Link to={`/incidents/${e.case_id}`}>
                  {e.title}
                  <ArrowUpRight size={14} />
                </Link>
              ) : (
                e.title
              )}
            </h3>
            <p>{e.description}</p>
            <small>
              Record {e.id}
              {e.source_id && ` · Source ${e.source_id}`}
            </small>
          </div>
        </article>
      ))}
      {!events.length && <Empty title="No recorded history" />}
    </div>
  );
}
export function PassportPage() {
  const [passportParams] = useSearchParams();
  const requestedTab = passportParams.get("tab") || "Overview";
  const { id } = useParams(),
    [tab, setTab] = useState(passportParams.get("tab") || "Overview"),
    [date, setDate] = useState(""),
    [share, setShare] = useState(false);
  const { user } = useSession(),
    toast = useToast();
  const since = localStorage.getItem(`visit:${id}`) || "";
  useEffect(() => {
    setTab(requestedTab);
  }, [requestedTab, id]);
  const query = useQuery({
    queryKey: ["passport", id, date],
    queryFn: () =>
      api<Passport>(
        `/waterbodies/${id}?as_of=${date}&since=${encodeURIComponent(since)}`,
      ),
  });
  useEffect(
    () => () => {
      if (id) localStorage.setItem(`visit:${id}`, new Date().toISOString());
    },
    [id],
  );
  async function follow() {
    if (!user) {
      toast("Sign in to follow places across devices.");
      return;
    }
    try {
      await api(`/following/${id}`, { method: "POST" });
      toast("Following this water body.");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  if (!query.data)
    return (
      <div className="page">
        <QueryState loading={query.isPending} error={query.error} />
      </div>
    );
  const d = query.data,
    w = d.waterbody;
  return (
    <div className="page passport-page">
      <Link className="back-link" to="/explore">
        ← All water bodies
      </Link>
      <div className="passport-heading">
        <div>
          <div className="eyebrow">
            {w.type.toUpperCase()} · {w.id}
            {w.synthetic ? " · SYNTHETIC DEMO" : ""}
          </div>
          <h1>{w.name}</h1>
          <p className="locality">
            <MapPin size={15} />
            {w.locality} · {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
            {w.synthetic ? " (synthetic)" : ""}
          </p>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={follow}>
            <Bookmark size={16} />
            Follow
          </button>
          <button className="button secondary" onClick={() => setShare(true)}>
            <Share2 size={16} />
            Share
          </button>
          <Link className="button primary" to={`/report?waterbody=${id}`}>
            <Plus size={16} />
            Report
          </Link>
        </div>
      </div>
      <div className="passport-overview">
        <div className="overview-copy">
          <Badge state={w.case_count ? "open" : "neutral"}>
            {workflowLabel(w.case_state, w.case_count)}
          </Badge>
          <p>{w.summary}</p>
          <div className="record-facts">
            <div>
              <Clock size={17} />
              <span>
                Latest observation
                <strong>{formatDate(w.latest_observed_at)}</strong>
              </span>
            </div>
            <div>
              <Database size={17} />
              <span>
                Connected sources
                <strong>{w.source_count} recorded sources</strong>
              </span>
            </div>
            <div>
              <Info size={17} />
              <span>
                Environmental condition
                <strong>Not assessed by AquaRelay</strong>
              </span>
            </div>
          </div>
        </div>
        <MapView items={[w]} selected={w.id} onSelect={() => {}} compact />
      </div>
      <div
        className="passport-tabs"
        role="tablist"
        aria-label="Passport sections"
      >
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            id={`passport-tab-${t}`}
            aria-controls="passport-tabpanel"
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(event) => {
              const index = tabs.indexOf(t);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              setTab(tabs[next]);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus();
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="history-date">
        <label>
          <Clock size={15} />
          View recorded history as of{" "}
          <input
            type="date"
            aria-label="Historical date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {date && (
          <>
            <strong>Viewing history as of {formatDate(date)}</strong>
            <button className="text-button" onClick={() => setDate("")}>
              Return to present
            </button>
          </>
        )}
      </div>
      <section
        role="tabpanel"
        id="passport-tabpanel"
        aria-labelledby={`passport-tab-${tab}`}
        className="passport-content"
      >
        {tab === "Overview" && (
          <div className="two-column">
            <div>
              <div className="section-title">
                <h2>The latest in this place</h2>
                <button
                  className="text-button"
                  onClick={() => setTab("History")}
                >
                  Full history <ArrowRight size={15} />
                </button>
              </div>
              <EventTimeline events={d.events.slice(0, 4)} />
            </div>
            <aside>
              <div className="info-panel">
                <div className="panel-icon">
                  <Leaf size={19} />
                </div>
                <h3>What changed since your last visit?</h3>
                {d.changes?.length ? (
                  <ul className="change-list">
                    {d.changes.slice(0, 5).map((e) => (
                      <li key={e.record_id || e.id}>
                        <Link
                          to={
                            e.case_id
                              ? `/incidents/${e.case_id}`
                              : e.href?.startsWith("/incidents/")
                                ? e.href
                                : `/waterbodies/${id}?tab=History#${e.record_id || e.id}`
                          }
                        >
                          {e.title}
                          <ArrowUpRight size={14} />
                        </Link>
                        <small>
                          Record {e.record_id || e.id} ·{" "}
                          {formatDate(e.created_at)}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No new recorded events since your last visit.</p>
                )}
                <p className="fine-print">
                  Rules-based summary. Each item comes from a stored record.
                </p>
              </div>
              <div className="info-panel">
                <h3>A record, with its origins.</h3>
                <p>
                  Source dates, observations, responses, and outcomes stay
                  connected. An incident’s closure does not establish water
                  safety or ecological recovery.
                </p>
                <button
                  className="text-button"
                  onClick={() => setTab("Sources")}
                >
                  Inspect the sources <ArrowRight size={14} />
                </button>
              </div>
            </aside>
          </div>
        )}
        {tab === "History" && <EventTimeline events={d.events} />}
        {tab === "Incidents" && (
          <div className="record-list">
            {d.cases.map((c) => (
              <Link className="record-row" key={c.id} to={`/incidents/${c.id}`}>
                <span className="panel-icon">
                  <Info size={20} />
                </span>
                <div>
                  <h3>{c.title}</h3>
                  <p>
                    {formatDate(c.observed_at)} · {c.id}
                    {c.synthetic ? " · Synthetic demo" : ""}
                  </p>
                  <Badge state={c.state}>{workflowLabel(c.state)}</Badge>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))}
            {!d.cases.length && (
              <Empty title="No recorded cases">Condition not assessed.</Empty>
            )}
          </div>
        )}
        {tab === "Monitoring" && (
          <>
            <div className="section-title">
              <h2>Recorded measurements</h2>
              <span>Values preserve their source and method.</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Value / unit</th>
                    <th>Observed</th>
                    <th>Method / source</th>
                    <th>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {d.observations.map((o) => (
                    <tr key={o.id}>
                      <td>{o.parameter}</td>
                      <td>
                        {o.value} {o.unit}
                      </td>
                      <td>{formatDate(o.observed_at)}</td>
                      <td>
                        {o.method || "Not supplied"}
                        <small>{o.source_name || o.source_id}</small>
                      </td>
                      <td>
                        {o.id}
                        {o.synthetic && <small>Synthetic demo</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!d.observations.length && (
              <Empty title="No measurements recorded" />
            )}
          </>
        )}
        {tab === "Biodiversity" && (
          <>
            <p className="section-note">
              These are recorded observations. An absence of records is not
              evidence that a species is absent.
            </p>
            <div className="record-list">
              {d.biodiversity.map((b) => (
                <article className="record-row" key={b.id}>
                  <span className="panel-icon">
                    <Leaf size={22} />
                  </span>
                  <div>
                    <h3>{b.common_name || b.species || b.name}</h3>
                    <p>
                      {b.qualification ||
                        b.scientific_name ||
                        "Identification supplied by source"}{" "}
                      · {formatDate(b.observed_at)}
                    </p>
                    <small>
                      {b.source_name || b.source_id} · {b.id}
                      {b.synthetic ? " · Synthetic demo" : ""}
                    </small>
                  </div>
                </article>
              ))}
              {!d.biodiversity.length && (
                <Empty title="No species observations recorded" />
              )}
            </div>
          </>
        )}
        {tab === "Actions" && (
          <div className="record-list">
            {d.actions.map((a) => (
              <article className="record-row" key={a.id}>
                <span className="panel-icon">
                  <CheckCheck size={21} />
                </span>
                <div>
                  <h3>{a.title}</h3>
                  <p>{a.description}</p>
                  <small>
                    {a.organisation_name || a.organisation_id} ·{" "}
                    {formatDate(a.completed_at || a.created_at)}
                    {a.synthetic ? " · Synthetic demo" : ""}
                  </small>
                  {a.case_id && (
                    <Link className="text-link" to={`/incidents/${a.case_id}`}>
                      Supporting case <ArrowUpRight size={14} />
                    </Link>
                  )}
                </div>
              </article>
            ))}
            {!d.actions.length && <Empty title="No documented activities" />}
            <p className="section-note">
              Documented activity completion is separate from any qualified
              environmental finding.
            </p>
          </div>
        )}
        {tab === "Connections" && (
          <div className="two-column">
            <div>
              <h2>Nearby water bodies</h2>
              <p className="section-note">
                Straight-line distances from stored coordinates; not walking
                routes.
              </p>
              {d.nearby.map((n) => (
                <Link
                  className="connection-row"
                  to={`/waterbodies/${n.id}`}
                  key={n.id}
                >
                  <Waves size={20} />
                  <span>
                    <strong>{n.name}</strong>
                    <small>
                      {((n.distance_m || 0) / 1000).toFixed(2)} km
                      {n.synthetic ? " · Synthetic geography" : ""}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
            <div>
              <h2>Documented relationships</h2>
              <p className="section-note">
                Proximity alone does not establish a hydrological connection.
              </p>
              {d.relationships.map((r) => (
                <article className="connection-row" key={r.id}>
                  <Plug size={19} />
                  <span>
                    <strong>
                      {["waterbody", "organisation"].includes(r.target_type) ? (
                        <Link
                          to={
                            r.target_type === "waterbody"
                              ? `/waterbodies/${r.target_id}`
                              : `/organisations/${r.target_id}`
                          }
                        >
                          {r.target_name || r.target_id}
                          <ArrowUpRight size={14} />
                        </Link>
                      ) : (
                        r.target_name || r.target_id
                      )}
                    </strong>
                    <small>
                      {(r.kind || r.relationship_type).replaceAll("_", " ")}
                      {r.synthetic ? " · Synthetic" : ""}
                    </small>
                    <p>{r.description}</p>
                    {r.source_id ? (
                      <a
                        className="text-link"
                        href={`/api/v1/sources/${r.source_id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Supporting source: {r.source_id}
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <small>Supporting source not supplied</small>
                    )}
                  </span>
                </article>
              ))}
              {!d.relationships.length && (
                <Empty title="No sourced relationships recorded" />
              )}
            </div>
          </div>
        )}
        {tab === "Sources" && (
          <div className="record-list">
            {d.sources.map((s) => (
              <article className="record-row" key={s.id}>
                <span className="panel-icon">
                  <Database size={20} />
                </span>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <small>
                    Licence: {s.license || s.licence || "Not supplied"} ·
                    Updated {formatDate(s.source_updated_at || s.observed_at)} ·{" "}
                    {s.id}
                    {s.synthetic ? " · Synthetic" : ""}
                  </small>
                </div>
                <Badge state={s.state || "neutral"}>
                  {s.state || "Recorded"}
                </Badge>
              </article>
            ))}
          </div>
        )}
      </section>
      {share && (
        <ShareModal
          open={share}
          onClose={() => setShare(false)}
          waterbody={w}
        />
      )}
    </div>
  );
}

export function LandingPage() {
  const registry = useRegistry(),
    config = useConfig();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [donationFrequency, setDonationFrequency] = useState<"once" | "monthly">("monthly");
  const [donationAmount, setDonationAmount] = useState<number>(50);

  const faqs = [
    {
      q: "How Does Citizen Reporting Provide Clean Water?",
      a: "Every report you contribute feeds directly into GPS-verified forensics, alerting State Pollution Control Boards and deploying rapid cleanup boats with legally documented response SLAs."
    },
    {
      q: "How Do You Ensure The Water Stays Flowing Long-Term?",
      a: "Access to water is more than a basic need; it's the foundation for health, education, and economic growth. We design projects with community ownership at the core, ensuring every sensor system is maintained, protected, and sustained for years to come."
    },
    {
      q: "Where Does Your Organization Work?",
      a: "AquaRelay operates across key freshwater basins, urban catchment lakes, and rural irrigation networks, coordinating active cleanup machinery and eco-patrol squads across vulnerable waterways."
    },
    {
      q: "Can I Choose Which Catchment Project Needs Immediate Action?",
      a: "Yes. Through the Explore Water Map, you can review live cleanliness scores, dissolved oxygen levels, and active contamination cases to direct watchdog attention where it is needed most."
    },
    {
      q: "How Do Automated Cleanup Machines Save Our Waters?",
      a: "Floating solar-powered trash barriers, micro-bubble oxygenators, and autonomous skimmer boats physically extract floating debris and restore biological oxygen levels before contaminants spread downstream."
    }
  ];

  return (
    <div className="pureflow-page-root">
      {/* 1. Hero with 3D Video Background & Capsule Header */}
      <PureFlowHeroVideo />

      {/* 2. Amazon-Style Live Delivery Tracking Bar */}
      <div className="pureflow-tracker-strip">
        <LakeDeliveryBar />
      </div>

      {/* 3. PureFlow "About Us" Section matching the uploaded design */}
      <section className="pureflow-about-section">
        <div className="pureflow-container">
          <div className="pureflow-about-grid">
            <div className="about-left">
              <span className="pureflow-section-tag">
                <span className="pureflow-dot-amber" /> ABOUT US
              </span>
              <h2 className="pureflow-heading-huge">
                Together, We<br />
                Restore Access<br />
                to Clean Water.
              </h2>
            </div>
            <div className="about-right">
              <p className="about-lead-text">
                Every community deserves reliable, safe water. At AquaRelay, we transform unsafe sources into sustainable systems through smart engineering, citizen reporting, and rapid cleanup partnerships. By combining innovation with community vigilance, we create long-term solutions that empower families.
              </p>
              <Link to="/explore" className="pureflow-pill-btn">
                Our Mission <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Numbers / Impact Stats Row (from the image) */}
          <div className="pureflow-stats-row">
            <div className="pureflow-stat-card">
              <span className="stat-number">50<sup>+</sup></span>
              <span className="stat-label">Protected Catchments</span>
            </div>
            <div className="pureflow-stat-card">
              <span className="stat-number">1.2M<sup>+</sup></span>
              <span className="stat-label">Citizens Vigilant</span>
            </div>
            <div className="pureflow-stat-card">
              <span className="stat-number">150K<sup>+</sup></span>
              <span className="stat-label">Forensic Readings Logged</span>
            </div>
            <div className="pureflow-stat-card">
              <span className="stat-number">98%</span>
              <span className="stat-label">Restoration SLA Rate</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Golden Yellow Impact & Initiative Cards (matching top-right of image) */}
      <section className="pureflow-yellow-section">
        <div className="pureflow-container">
          <div className="yellow-section-header">
            <div>
              <span className="feature-amber-pill">
                <Sparkles size={13} /> ACTIVE WATER INITIATIVES
              </span>
              <h3 className="yellow-title">Make a Meaningful Impact Today</h3>
            </div>
            <p className="yellow-sub">
              Transparent telemetry. Real impact. Every contribution and citizen observation moves a community forward.
            </p>
          </div>

          <div className="pureflow-yellow-grid">
            <div className="pureflow-yellow-card highlight-bar">
              <div className="card-top">
                <span className="card-badge">EDUCATIONAL INITIATIVE</span>
                <h4>Water Education & Watchdog Initiative</h4>
                <p>Teach hygiene, sampling procedures, and safe observation practices in rural and urban catchment communities.</p>
              </div>
              <div className="card-progress">
                <div className="progress-labels">
                  <span>Active Watchdogs: <strong>$98,090</strong></span>
                  <span>Goal: <strong>$260,000</strong></span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: "68%" }} />
                </div>
              </div>
              <Link to="/explore" className="yellow-btn-dark">
                View Program <ArrowRight size={14} />
              </Link>
            </div>

            <div className="pureflow-yellow-card highlight-bar">
              <div className="card-top">
                <span className="card-badge">ECO-PATROL FLEET</span>
                <h4>Health & Sanitation Machine Drive</h4>
                <p>Deploy rapid eco-patrol machinery and floating solar barriers to prevent industrial sludge contamination.</p>
              </div>
              <div className="card-progress">
                <div className="progress-labels">
                  <span>Machines Deployed: <strong>$75,980</strong></span>
                  <span>Goal: <strong>$120,000</strong></span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: "82%" }} />
                </div>
              </div>
              <Link to="/report" className="yellow-btn-dark">
                View Program <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. River Clean Cinema (High-Impact Cleanup Machines Theater) */}
      <RiverCleanCinemaSection />

      {/* 6. PureFlow Impact & Accordion FAQ (matching right-middle of image) */}
      <section className="pureflow-impact-faq-section">
        <div className="pureflow-container">
          <div className="impact-faq-grid">
            <div className="impact-left-card">
              <span className="pureflow-section-tag">
                <span className="pureflow-dot-amber" /> OUR IMPACT
              </span>
              <h2 className="pureflow-heading-mid">
                Building Systems That Last for Generations.
              </h2>
              <p>
                Access to water is more than a basic need; it's the foundation for health, education, and economic growth. We design projects with community ownership at the core, ensuring every system is maintained, protected, and sustained for years to come.
              </p>
              <Link to="/explore" className="pureflow-pill-btn">
                See Our Impact <ArrowRight size={14} />
              </Link>
            </div>

            <div className="faq-right-column">
              <div className="pureflow-accordion">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={faq.q}
                      className={`accordion-item ${isOpen ? "open" : ""}`}
                    >
                      <button
                        type="button"
                        className="accordion-header"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                      >
                        <span>{faq.q}</span>
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      {isOpen && (
                        <div className="accordion-body">
                          <p>{faq.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Community Giving & Report CTA Card (matching bottom-right of image) */}
      <section className="pureflow-action-section">
        <div className="pureflow-container">
          <div className="action-card-grid">
            <div className="action-form-side">
              <span className="pureflow-section-tag">
                <span className="pureflow-dot-amber" /> TAKE ACTION
              </span>
              <h3>Stand Up for Living Waters.</h3>
              <p>Join thousands of active citizens safeguarding catchments and protecting communities.</p>

              <div className="donation-tabs">
                <button
                  type="button"
                  className={`tab-btn ${donationFrequency === "once" ? "active" : ""}`}
                  onClick={() => setDonationFrequency("once")}
                >
                  Give Once
                </button>
                <button
                  type="button"
                  className={`tab-btn ${donationFrequency === "monthly" ? "active" : ""}`}
                  onClick={() => setDonationFrequency("monthly")}
                >
                  Monthly
                </button>
              </div>

              <div className="amount-pills">
                {[25, 50, 100, 250].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`amount-pill ${donationAmount === amt ? "active" : ""}`}
                    onClick={() => setDonationAmount(amt)}
                  >
                    ${amt} <small>USD/{donationFrequency === "monthly" ? "mo" : "once"}</small>
                  </button>
                ))}
              </div>

              <div className="action-submit-row">
                <Link to="/report" className="pureflow-btn-amber full-width">
                  Report Lake Incident Today <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="action-image-side">
              <div className="pureflow-water-tap-card">
                <div className="tap-badge">
                  <Heart size={14} className="text-amber-500 fill-amber-500" />
                  <span>COMMUNITY MONITORED SAFE TAP</span>
                </div>
                <h4>Pure Water for Every Child</h4>
                <p>Real-time forensics ensure zero industrial runoff reaches municipal wells.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. PureFlow Sleek Dark Editorial Footer (matching bottom of image) */}
      <footer className="pureflow-footer">
        <div className="pureflow-container">
          <div className="pureflow-footer-top">
            <div className="footer-col-brand">
              <div className="footer-logo">
                <Waves size={24} className="footer-wave-icon" />
                <span>AquaRelay<small>.</small></span>
              </div>
              <p>
                Transforming compromised freshwater sources into living, protected ecosystems through citizen vigilance and rapid intervention.
              </p>
            </div>

            <div className="footer-col">
              <h5>Quick Links</h5>
              <ul>
                <li><Link to="/report">Report Anomaly</Link></li>
                <li><Link to="/explore">Explore Water Map</Link></li>
                <li><Link to="/dispatch-tracker">Track Dispatches</Link></li>
                <li><Link to="/organisations">Organisations</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h5>Programs</h5>
              <ul>
                <li><Link to="/explore">Catchment Sensors</Link></li>
                <li><Link to="/explore">Eco-Patrol Boats</Link></li>
                <li><Link to="/notifications">Citizen Forensics</Link></li>
                <li><Link to="/settings">Community Registry</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h5>Legal & Policy</h5>
              <ul>
                <li><Link to="/developers">Open Data API</Link></li>
                <li><Link to="/settings">Privacy Policy</Link></li>
                <li><Link to="/settings">Terms of Service</Link></li>
                <li><Link to="/notifications">Authority Dispatch SLAs</Link></li>
              </ul>
            </div>
          </div>

          <div className="pureflow-footer-bottom">
            <span>© 2026 AquaRelay PureFlow Initiative. All rights reserved.</span>
            <div className="footer-social-links">
              <span>Living Waters</span> · <span>GPS Verified</span> · <span>Automated SLAs</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function FollowingPage() {
  const { user } = useSession();
  const client = useQueryClient(),
    toast = useToast();
  const following = useQuery({
    queryKey: ["following", user?.id],
    queryFn: () =>
      api<{ waterbodies: WaterBody[]; areas: any[] }>("/following"),
    enabled: !!user,
  });
  const [area, setArea] = useState(false);
  if (!user)
    return (
      <AuthNeeded
        title="Keep your waters close."
        text="Sign in to follow water bodies and save areas across devices."
      />
    );
  async function unfollow(id: string) {
    try {
      await api(`/following/${id}`, { method: "DELETE" });
      await client.invalidateQueries({ queryKey: ["following", user?.id] });
      toast("Removed from Following.");
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <div className="page">
      <PageHeader
        eyebrow="YOUR PERSONAL REGISTRY"
        title="Following"
        description="Recorded updates from the places you choose to follow."
      >
        <button className="button secondary" onClick={() => setArea(true)}>
          <MapPin size={17} />
          Save an area
        </button>
      </PageHeader>
      <QueryState loading={following.isPending} error={following.error} />
      <div className="card-grid">
        {following.data?.waterbodies.map((w) => (
          <div className="follow-card" key={w.id}>
            <WaterCard water={w} />
            <button className="text-button" onClick={() => unfollow(w.id)}>
              Unfollow
            </button>
          </div>
        ))}
      </div>
      {following.data && !following.data.waterbodies.length && (
        <Empty title="Your next connection starts with a place">
          <Link className="button primary" to="/explore">
            Explore waters <ArrowRight size={16} />
          </Link>
        </Empty>
      )}
      <h2 className="section-heading">Saved areas</h2>
      {following.data?.areas.map((a) => (
        <article className="info-panel" key={a.id}>
          <h3>{a.name}</h3>
          <p>
            {a.latitude}, {a.longitude} · {a.radius_m} m radius
          </p>
          <small>Explicitly saved area. No continuous location tracking.</small>
        </article>
      ))}
      {!following.data?.areas.length && (
        <p className="muted">No saved areas.</p>
      )}
      <Modal open={area} onClose={() => setArea(false)} title="Save an area">
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api("/areas", {
                method: "POST",
                body: JSON.stringify({
                  name: f.get("name"),
                  latitude: Number(f.get("latitude")),
                  longitude: Number(f.get("longitude")),
                  radius_m: Number(f.get("radius_m")),
                }),
              });
              setArea(false);
              await client.invalidateQueries({
                queryKey: ["following", user?.id],
              });
              toast("Area saved.");
            } catch (error) {
              toast((error as Error).message);
            }
          }}
        >
          <label>
            Area name
            <input name="name" required />
          </label>
          <div className="date-pair">
            <label>
              Latitude
              <input
                name="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                required
              />
            </label>
            <label>
              Longitude
              <input
                name="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                required
              />
            </label>
          </div>
          <label>
            Radius, metres
            <input
              name="radius_m"
              type="number"
              min="100"
              max="50000"
              defaultValue="2000"
              required
            />
          </label>
          <button className="button primary">Save area</button>
        </form>
      </Modal>
    </div>
  );
}
function AuthNeeded({ title, text }: { title: string; text: string }) {
  return (
    <div className="page">
      <div className="auth-needed">
        <span className="large-icon">
          <Bookmark size={28} />
        </span>
        <h1>{title}</h1>
        <p>{text}</p>
        <Link className="button primary" to="/login">
          Sign in <ArrowRight size={17} />
        </Link>
        <Link className="text-link" to="/explore">
          Continue exploring public records
        </Link>
      </div>
    </div>
  );
}
export function NotificationsPage() {
  const { user } = useSession(),
    toast = useToast(),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", user?.id || "public"],
    queryFn: () =>
      api<{ items: any[]; unread: number; scheduled: number }>(
        "/notifications",
      ),
    refetchInterval: 5000,
  });
  async function mark(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      await client.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <div className="page">
      <PageHeader
        eyebrow="YOUR PLACES, AS THEY CHANGE"
        title="Updates"
        description={`${query.data?.unread ?? 0} unread updates · live lake activity`}
      >
        <Link className="button secondary" to="/settings">
          <Bell size={16} />
          Preferences
        </Link>
      </PageHeader>
      {!user && (
        <div
          className="section-note highlight-bar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.75)",
            border: "1px solid rgba(116, 196, 118, 0.35)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#74C476",
                boxShadow: "0 0 8px #74C476",
              }}
            />
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#192e1d" }}>
              Viewing real-time public waterbody updates and automated authority dispatches.
            </span>
          </div>
          <Link
            to="/login"
            className="button secondary"
            style={{ fontSize: "11px", padding: "6px 14px", minHeight: "32px" }}
          >
            Sign in to personalize alerts
          </Link>
        </div>
      )}
      <QueryState loading={query.isPending} error={query.error} />
      {!!query.data?.scheduled && (
        <div className="section-note" role="status">
          {query.data.scheduled} stored updates are scheduled according to your
          quiet hours or digest preference.
        </div>
      )}
      <div className="notification-list">
        {query.data?.items.map((n) => (
          <article
            className={`notification ${n.read_at || n.read ? "" : "unread"}`}
            key={n.id}
          >
            <span className="panel-icon">
              <Bell size={18} />
            </span>
            <div>
              <h3>
                <Link
                  to={
                    n.href ||
                    n.url ||
                    n.link ||
                    `/waterbodies/${n.waterbody_id}`
                  }
                >
                  {n.title}
                </Link>
              </h3>
              <p>{n.description || n.message}</p>
              <small>
                {formatDate(n.created_at)} ·{" "}
                {n.synthetic ? "Synthetic demo update" : "Recorded event"} ·{" "}
                {n.event_id}
              </small>
            </div>
            {!n.read_at && !n.read && (
              <button
                className="icon-button"
                aria-label={`Mark ${n.title} as read`}
                onClick={() => mark(n.id)}
              >
                <Check size={20} />
              </button>
            )}
          </article>
        ))}
      </div>
      {query.data && !query.data.items.length && (
        <Empty
          title={
            query.data.scheduled
              ? "No delivered updates yet"
              : "You’re all caught up"
          }
        >
          {query.data.scheduled
            ? "Your scheduled updates will appear when their delivery time arrives."
            : "Follow a water body to receive its recorded updates."}
        </Empty>
      )}
      <div className="section-note">
        In-app updates are available. Email and browser push require configured
        adapters and consent.
      </div>
    </div>
  );
}
export function OrganisationsPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["organisations", id],
    queryFn: () => api<any>(`/organisations${id ? "/" + id : ""}`),
  });
  const items =
    id && query.data
      ? [query.data.organisation || query.data]
      : query.data?.items || [];
  return (
    <div className="page">
      <PageHeader
        eyebrow="PEOPLE BEHIND THE RECORDS"
        title="The organisation directory"
        description="Published roles, contributed datasets, and documented activities. Synthetic organisations are labelled individually."
      />
      <QueryState loading={query.isPending} error={query.error} />
      <div className="organisation-grid">
        {items.map((o: any) => (
          <article className="organisation-card" key={o.id}>
            <span className="organisation-icon">
              <Leaf size={25} />
            </span>
            <DemoLabel synthetic={o.synthetic} />
            <h2>{o.name}</h2>
            <p>{o.description}</p>
            <dl>
              <dt>Published role</dt>
              <dd>
                {o.role || o.kind || "See sourced responsibility records below"}
              </dd>
              <dt>Responsibility source</dt>
              <dd>
                {o.responsibility_source ? (
                  <a
                    className="text-link"
                    href={`/api/v1/sources/${o.responsibility_source}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {o.responsibility_source}
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  "Not supplied"
                )}
              </dd>
              <dt>Account metadata</dt>
              <dd>{o.verification || "No verification claim"}</dd>
            </dl>
            {!id && (
              <Link className="text-link" to={`/organisations/${o.id}`}>
                Organisation record <ArrowUpRight size={15} />
              </Link>
            )}
            {(o.contact || o.email) && (
              <a className="text-link" href={`mailto:${o.contact || o.email}`}>
                <Mail size={15} />
                {o.contact || o.email}
              </a>
            )}
          </article>
        ))}
      </div>
      {id && (
        <>
          <h2 className="section-heading">Sourced responsibilities</h2>
          {query.data?.relationships?.map((r: any) => (
            <article className="record-row" key={r.id}>
              <div>
                <h3>{r.kind.replaceAll("_", " ")}</h3>
                <p>{r.description}</p>
                <Link
                  className="text-link"
                  to={`/waterbodies/${r.waterbody_id}`}
                >
                  Water-body record <ArrowUpRight size={14} />
                </Link>
                {r.source_id && (
                  <a
                    className="text-link"
                    href={`/api/v1/sources/${r.source_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Supporting source {r.source_id}
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </article>
          ))}
          {!query.data?.relationships?.length && (
            <p className="muted">
              No sourced responsibility records published.
            </p>
          )}
          <h2 className="section-heading">Contributed datasets</h2>
          {query.data?.sources?.map((s: any) => (
            <article className="record-row" key={s.id}>
              <Database size={20} />
              <div>
                <DemoLabel synthetic={s.synthetic} />
                <h3>{s.name}</h3>
                <small>
                  Licence: {s.license || "Not supplied"} · Updated{" "}
                  {formatDate(s.source_updated_at || s.observed_at)}
                </small>
                <a
                  className="text-link"
                  href={`/api/v1/sources/${s.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source metadata <ExternalLink size={14} />
                </a>
              </div>
            </article>
          ))}
          {!query.data?.sources?.length && (
            <p className="muted">No contributed datasets published.</p>
          )}
          <h2 className="section-heading">Documented actions</h2>
          {query.data?.actions?.map((a: any) => (
            <Link
              className="record-row"
              to={`/incidents/${a.case_id}`}
              key={a.id}
            >
              <div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                <small>
                  {formatDate(a.completed_at)}
                  {a.synthetic ? " · Synthetic demo" : ""}
                </small>
              </div>
              <ArrowUpRight size={18} />
            </Link>
          ))}
          {!query.data?.actions?.length && (
            <p className="muted">No documented actions published.</p>
          )}
        </>
      )}
    </div>
  );
}
export function DevelopersPage() {
  const [id, setId] = useState("wb-reedwater");
  return (
    <div className="page developer-page">
      <PageHeader
        eyebrow="INTEROPERABILITY, WITH ITS ORIGINS INTACT"
        title="Open records. Clear contracts."
        description="A versioned, privacy-filtered API and explicit adapters for environmental observations."
      />
      <div className="two-column">
        <div>
          <section className="info-panel">
            <Badge>PUBLIC READ-ONLY API · v1</Badge>
            <h2>Build on a shared water-body identity.</h2>
            <p>
              Water bodies, public cases, documented actions, and source
              metadata are paginated. Private notes, reporter contact
              information, credentials, and private originals are excluded.
            </p>
            <pre>
              <code>{`GET /api/v1/waterbodies?page=1&page_size=20\nGET /api/v1/waterbodies/${id}\nGET /api/v1/cases\nGET /api/v1/actions\nGET /api/v1/sources`}</code>
            </pre>
            <a
              className="button secondary"
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
            >
              Interactive OpenAPI docs <ExternalLink size={16} />
            </a>
          </section>
          <section className="info-panel" id="standards">
            <h2>Supported standards, scoped honestly.</h2>
            <p>
              SensorThings API 1.1 subset: Things, Locations, Sensors,
              ObservedProperties, Datastreams, FeaturesOfInterest, and
              Observations. Citizen ownership/licensing metadata follows the
              supported STAplus 1.0 extension fields.
            </p>
            <p>
              FHIR R4 4.0.1 demonstration: one synthetic environmental
              measurement in a Bundle with Location, Observation, and
              Provenance. A local coding system is used; there are no patients
              or clinical interpretations.
            </p>
            <p className="section-note">
              Structural checks are reported separately from profile and
              terminology validation. This implementation does not claim full
              standards conformance.
            </p>
            <div className="button-row">
              <a
                className="button secondary"
                href={`/api/v1/standards/${id}/fhir`}
                target="_blank"
                rel="noreferrer"
              >
                <FileJson size={16} />
                FHIR example
              </a>
              <a
                className="button secondary"
                href={`/api/v1/standards/${id}/sensorthings`}
                target="_blank"
                rel="noreferrer"
              >
                SensorThings example
              </a>
            </div>
          </section>
        </div>
        <aside>
          <section className="info-panel">
            <h3>Embed a public passport</h3>
            <label>
              Permanent water-body ID
              <input value={id} onChange={(e) => setId(e.target.value)} />
            </label>
            <pre>
              <code>{`<iframe title="Water-body record"\n src="${window.location.origin}/api/v1/embed/${encodeURIComponent(id)}"\n width="360" height="240">\n</iframe>`}</code>
            </pre>
            <iframe
              title="Public water-body card preview"
              src={`/api/v1/embed/${encodeURIComponent(id)}`}
              className="embed-preview"
            />
            <p className="fine-print">
              Live record; synthetic label travels with the embed.
            </p>
          </section>
          <section className="info-panel">
            <h3>Assistance without the fiction</h3>
            <Badge>RULES-BASED ASSISTANCE</Badge>
            <p>
              Mapping suggestions, related-case candidates, and changed
              summaries use deterministic rules and stored records. No AI model
              is configured. Manual workflows remain available.
            </p>
          </section>
          <section className="info-panel">
            <h3>Source & licence register</h3>
            <p>
              All demonstration geography, organisations, incidents,
              measurements, and biodiversity records are synthetic fixtures
              created for AquaRelay.
            </p>
            <p>
              No generated photograph is represented as incident evidence. Icons
              are Lucide (ISC); the system font requires no remote asset
              requests.
            </p>
            <a
              className="text-link"
              href="https://maplibre.org/maplibre-gl-js/docs/"
              target="_blank"
              rel="noreferrer"
            >
              MapLibre reference <ExternalLink size={14} />
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
export function LoginPage() {
  const config = useConfig();
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const { user, refresh } = useSession(),
    navigate = useNavigate();
  return (
    <div className="page">
      <div className="login-panel">
        <span className="brand-mark">
          <Waves size={28} />
        </span>
        <p className="eyebrow">YOUR RECORDS, CONNECTED</p>
        <h1>
          {user
            ? "You’re signed in."
            : register
              ? "Join AquaRelay."
              : "Welcome to AquaRelay."}
        </h1>
        <p>
          {user
            ? `Signed in as ${user.name}`
            : "Explore publicly. Sign in to contribute, follow places, or work with your organisation."}
        </p>
        {user ? (
          <Link className="button primary" to="/explore">
            Explore waters <ArrowRight size={17} />
          </Link>
        ) : (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                await api(`/auth/${register ? "register" : "login"}`, {
                  method: "POST",
                  body: JSON.stringify({
                    email: f.get("email"),
                    password: f.get("password"),
                    name: f.get("name"),
                  }),
                });
                await refresh();
                navigate("/explore");
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {register && (
              <label>
                Name
                <input name="name" autoComplete="name" required />
              </label>
            )}
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={register ? 10 : 1}
                autoComplete={register ? "new-password" : "current-password"}
                required
              />
            </label>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? "Signing in…" : register ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setRegister(!register)}
            >
              {register
                ? "Already have an account? Sign in"
                : "Create a citizen account"}
            </button>
            {config.data?.demo_mode && (
              <div className="demo-accounts">
                <Badge>DEMO IDENTITIES</Badge>
                <p>
                  Citizen: citizen@demo.aquarelay.local
                  <br />
                  Manager: manager@demo.aquarelay.local
                  <br />
                  Password: DemoPass123!
                </p>
                <small>
                  Separate seeded identities. Organisation actions are enforced
                  by the server.
                </small>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
export function SettingsPage() {
  const { user, refresh } = useSession(),
    toast = useToast(),
    navigate = useNavigate();
  const query = useQuery({
    queryKey: ["preferences", user?.id],
    queryFn: () => api<any>("/preferences"),
    enabled: !!user,
  });
  const [preferences, setPreferences] = useState<any>({
    digest: "immediate",
    quiet_start: "",
    quiet_end: "",
    reports: true,
    case_updates: true,
    biodiversity: true,
  });
  useEffect(() => {
    setPreferences(
      query.data || {
        digest: "immediate",
        quiet_start: "",
        quiet_end: "",
        reports: true,
        case_updates: true,
        actions: true,
        evidence_requests: true,
        biodiversity: true,
      },
    );
  }, [query.data, user?.id]);
  if (!user)
    return (
      <AuthNeeded
        title="Make your updates useful."
        text="Sign in to set notification preferences and manage your account."
      />
    );
  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="ACCOUNT & PREFERENCES"
        title="AquaRelay, at your pace."
        description="Choose which recorded updates matter to you."
      />
      <div className="two-column">
        <form
          className="info-panel form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/preferences", {
                method: "PUT",
                body: JSON.stringify(preferences),
              });
              toast("Preferences saved.");
            } catch (error) {
              toast((error as Error).message);
            }
          }}
        >
          <h2>In-app notifications</h2>
          {[
            "reports",
            "case_updates",
            "actions",
            "evidence_requests",
            "biodiversity",
          ].map((k) => (
            <label className="checkbox-row" key={k}>
              <input
                type="checkbox"
                checked={preferences[k] !== false}
                onChange={(e) =>
                  setPreferences({ ...preferences, [k]: e.target.checked })
                }
              />
              {k.replaceAll("_", " ")}
            </label>
          ))}
          <label>
            Delivery preference
            <select
              value={preferences.digest || "immediate"}
              onChange={(e) =>
                setPreferences({ ...preferences, digest: e.target.value })
              }
            >
              <option value="immediate">As events are recorded</option>
              <option value="daily">Daily digest</option>
            </select>
          </label>
          <div className="date-pair">
            <label>
              Quiet from (Asia/Kolkata)
              <input
                type="time"
                value={preferences.quiet_start || ""}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    quiet_start: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Quiet until (Asia/Kolkata)
              <input
                type="time"
                value={preferences.quiet_end || ""}
                onChange={(e) =>
                  setPreferences({ ...preferences, quiet_end: e.target.value })
                }
              />
            </label>
          </div>
          <button className="button primary">Save preferences</button>
        </form>
        <aside>
          <div className="info-panel">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <Badge>{user.role.replaceAll("_", " ")}</Badge>
            <p>
              Account-scoped offline drafts remain on this device. Synced
              records remain in the database.
            </p>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await api("/auth/logout", { method: "POST" });
                  await refresh();
                  navigate("/login");
                } catch (error) {
                  toast((error as Error).message);
                }
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
          <div className="info-panel">
            <h3>Optional delivery channels</h3>
            <p>Email: unavailable — adapter not configured.</p>
            <p>
              Browser push: unavailable — adapter not configured or consented.
            </p>
            <p className="fine-print">
              AquaRelay does not claim external delivery from in-app updates.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
