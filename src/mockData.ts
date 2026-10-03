import type { WaterBody, Passport, CaseRecord, RecordedEvent } from "./types";

export const DEMO_WATERBODIES: WaterBody[] = [
  {
    id: "wb-bellandur",
    name: "Bellandur Lake Catchment",
    aliases: ["Bellandur", "Bellandur Lake"],
    type: "lake",
    locality: "South-East Ward, Bengaluru",
    latitude: 12.936,
    longitude: 77.668,
    summary: "Major urban lake with active telemetry, water patrols, and automated contamination dispatch.",
    synthetic: false,
    case_count: 2,
    source_count: 4,
    case_state: "action_in_progress",
    data_state: "available",
    latest_observed_at: "2026-09-30T10:00:00Z",
  },
  {
    id: "wb-reedwater",
    name: "Demo Reedwater Lake",
    aliases: ["Reedwater", "Reedwater Lake"],
    type: "lake",
    locality: "Reedwater Quarter",
    latitude: 12.979,
    longitude: 77.587,
    summary: "A synthetic lake with community observations, a documented response, and a preserved case history.",
    synthetic: true,
    case_count: 1,
    source_count: 2,
    case_state: "investigating",
    data_state: "available",
    latest_observed_at: "2026-09-28T05:00:00Z",
  },
  {
    id: "wb-millbank",
    name: "Demo Millbank Canal",
    aliases: ["Millbank", "Millbank Canal"],
    type: "canal",
    locality: "Millbank Ward",
    latitude: 12.974,
    longitude: 77.594,
    summary: "A fictional canal with a recorded floating-waste observation under investigation.",
    synthetic: true,
    case_count: 1,
    source_count: 1,
    case_state: "investigating",
    data_state: "available",
    latest_observed_at: "2026-09-23T09:00:00Z",
  },
  {
    id: "wb-willow",
    name: "Demo Willow Pond",
    aliases: ["Willow", "Willow Pond"],
    type: "pond",
    locality: "Willow Gardens",
    latitude: 12.97,
    longitude: 77.578,
    summary: "A demonstration pond with biodiversity records. Its environmental condition has not been assessed.",
    synthetic: true,
    case_count: 0,
    source_count: 1,
    case_state: "closed",
    data_state: "available",
    latest_observed_at: "2026-09-20T05:30:00Z",
  },
  {
    id: "wb-eastmere",
    name: "Demo Eastmere Lake",
    aliases: ["Eastmere", "Eastmere Lake"],
    type: "lake",
    locality: "Eastmere Ward",
    latitude: 12.982,
    longitude: 77.609,
    summary: "Synthetic monitoring records link a demonstration field dataset to this lake.",
    synthetic: true,
    case_count: 0,
    source_count: 1,
    case_state: "closed",
    data_state: "available",
    latest_observed_at: "2026-09-24T06:00:00Z",
  },
  {
    id: "wb-lantern",
    name: "Demo Lantern Stream",
    aliases: ["Lantern", "Lantern Stream"],
    type: "stream",
    locality: "Lantern Walk",
    latitude: 12.963,
    longitude: 77.6,
    summary: "A fictional stream with a documented waterway link. Nearby distance alone does not establish a connection.",
    synthetic: true,
    case_count: 0,
    source_count: 1,
    case_state: "closed",
    data_state: "available",
    latest_observed_at: "2026-09-18T08:00:00Z",
  },
  {
    id: "wb-orchard",
    name: "Demo Orchard Pool",
    aliases: ["Orchard", "Orchard Pool"],
    type: "pond",
    locality: "Orchard Quarter",
    latitude: 12.981,
    longitude: 77.57,
    summary: "A demonstration pond with limited records. Missing observations do not imply safe water.",
    synthetic: true,
    case_count: 0,
    source_count: 0,
    case_state: "closed",
    data_state: "stale",
    latest_observed_at: "2026-08-10T12:00:00Z",
  },
  {
    id: "wb-northfen",
    name: "Demo North Fen",
    aliases: ["North Fen", "North Fen Wetland"],
    type: "wetland",
    locality: "North Fen Ward",
    latitude: 12.991,
    longitude: 77.599,
    summary: "A synthetic wetland with coarse biodiversity locations and an outdated source context.",
    synthetic: true,
    case_count: 0,
    source_count: 1,
    case_state: "closed",
    data_state: "stale",
    latest_observed_at: "2025-10-02T08:00:00Z",
  },
];

export function getMockPassport(id: string): Passport {
  const waterbody =
    DEMO_WATERBODIES.find((w) => w.id === id) ||
    DEMO_WATERBODIES[0];

  const cases: CaseRecord[] = [
    {
      id: `case-${waterbody.id}-1`,
      waterbody_id: waterbody.id,
      waterbody_name: waterbody.name,
      title: "Chemical Runoff & Surface Turbidity Investigation",
      description: "Visual surface observation noted suspicious foaming and chemical runoff near primary inlet channel.",
      state: "investigating",
      review_state: "reviewed",
      delivery_state: "delivered",
      organisation_id: "org-reedwatch",
      created_at: "2026-09-28T05:00:00Z",
      observed_at: "2026-09-28T04:30:00Z",
      synthetic: true,
    },
    {
      id: `case-${waterbody.id}-2`,
      waterbody_id: waterbody.id,
      waterbody_name: waterbody.name,
      title: "Seasonal Debris Cleanup & Bio-Aeration Protocol",
      description: "Documented cleanup of floating non-biodegradable debris and micro-bubble aeration.",
      state: "closed",
      review_state: "reviewed",
      delivery_state: "delivered",
      organisation_id: "org-district",
      created_at: "2026-04-12T08:00:00Z",
      observed_at: "2026-04-12T07:00:00Z",
      synthetic: true,
    },
  ];

  const events: RecordedEvent[] = [
    {
      id: `evt-${waterbody.id}-1`,
      waterbody_id: waterbody.id,
      case_id: cases[0].id,
      kind: "report",
      title: "Citizen Anomaly Alert Recorded",
      description: "GPS-verified observation uploaded with water condition metadata.",
      created_at: "2026-09-28T05:00:00Z",
      source_id: "src-citizen",
      synthetic: true,
    },
    {
      id: `evt-${waterbody.id}-2`,
      waterbody_id: waterbody.id,
      case_id: cases[0].id,
      kind: "case_update",
      title: "Pollution Control Board Dispatched",
      description: "Automated routing dispatched to local municipal water inspection bureau.",
      created_at: "2026-09-28T06:15:00Z",
      source_id: "src-board",
      synthetic: true,
    },
    {
      id: `evt-${waterbody.id}-3`,
      waterbody_id: waterbody.id,
      case_id: cases[1].id,
      kind: "action",
      title: "Bio-barrier cleanup documented",
      description: "Debris interception unit cleared 140kg synthetic floating materials.",
      created_at: "2026-05-01T09:00:00Z",
      source_id: "src-field",
      synthetic: true,
    },
  ];

  const observations = [
    {
      id: "obs-1",
      parameter: "Dissolved Oxygen",
      value: 6.4,
      unit: "mg/L",
      observed_at: "2026-09-28T06:00:00Z",
    },
    {
      id: "obs-2",
      parameter: "pH Level",
      value: 7.2,
      unit: "pH",
      observed_at: "2026-09-28T06:00:00Z",
    },
    {
      id: "obs-3",
      parameter: "Water Temperature",
      value: 23.5,
      unit: "°C",
      observed_at: "2026-09-28T06:00:00Z",
    },
  ];

  const biodiversity = [
    {
      id: "bio-1",
      common_name: "Indian Spot-billed Duck",
      scientific_name: "Anas poecilorhyncha",
      observed_at: "2026-09-20T06:00:00Z",
    },
    {
      id: "bio-2",
      common_name: "Black-crowned Night Heron",
      scientific_name: "Nycticorax nycticorax",
      observed_at: "2026-09-22T07:15:00Z",
    },
  ];

  const actions = [
    {
      id: "act-1",
      title: "Patrol Boat Surface Skimming",
      status: "In Transit",
      assigned_unit: "Unit #04",
      updated_at: "2026-09-28T08:00:00Z",
    },
  ];

  const sources = [
    {
      id: "src-1",
      name: "AquaRelay Municipal Telemetry Node",
      type: "sensor",
      status: "active",
      last_ping: "2 minutes ago",
    },
  ];

  const nearby = DEMO_WATERBODIES.filter((w) => w.id !== waterbody.id).slice(0, 3);

  return {
    waterbody,
    events,
    observations,
    biodiversity,
    cases,
    actions,
    sources,
    relationships: [],
    nearby,
    organisations: [
      { id: "org-reedwatch", name: "AquaRelay Watchdog Network" },
      { id: "org-district", name: "State Pollution Control Board" },
    ],
    changes: events,
  };
}

export function handleMockRoute<T = any>(path: string, options: RequestInit = {}): T | null {
  const cleanPath = path.replace(/^\/api\/v1/, "").replace(/^\/api/, "");
  const [route, queryStr] = cleanPath.split("?");
  const query = new URLSearchParams(queryStr || "");
  const method = (options.method || "GET").toUpperCase();

  if (route === "/auth/session") {
    return { user: null, csrf_token: "demo-csrf-token" } as T;
  }

  if (route === "/config") {
    return { demo_mode: true } as T;
  }

  if (route === "/waterbodies") {
    let items = [...DEMO_WATERBODIES];
    const q = query.get("q")?.toLowerCase();
    const type = query.get("type");
    if (q) {
      items = items.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.locality.toLowerCase().includes(q) ||
          w.aliases.some((a) => a.toLowerCase().includes(q)),
      );
    }
    if (type) {
      items = items.filter((w) => w.type === type);
    }
    return { items, total: items.length } as T;
  }

  if (route.startsWith("/waterbodies/")) {
    const id = route.split("/")[2];
    return getMockPassport(id) as T;
  }

  if (route === "/following") {
    return { waterbodies: [], areas: [] } as T;
  }

  if (route.startsWith("/notifications")) {
    const mockNotifications = [
      {
        id: "notif-1",
        title: "Bellandur Lake Catchment · Patrol Boat Unit #04 Dispatched",
        description: "Municipal Water Bureau and Pollution Control Board have dispatched surface skimming unit #04 with automated tracking.",
        waterbody_id: "wb-bellandur",
        href: "/dispatch-tracker",
        created_at: "2026-10-02T19:40:00Z",
        read: false,
        synthetic: false,
        event_id: "DSP-48201",
      },
      {
        id: "notif-2",
        title: "Chemical Runoff Alert Verified · State Pollution Control Board",
        description: "High-priority citizen observation confirmed elevated turbidity and foaming at north inlet. Regulatory enforcement notice served.",
        waterbody_id: "wb-reedwater",
        href: "/waterbodies/wb-reedwater",
        created_at: "2026-10-02T18:15:00Z",
        read: false,
        synthetic: true,
        event_id: "EVT-92041",
      },
      {
        id: "notif-3",
        title: "Micro-Bubble Bio-Aeration Unit Activated",
        description: "Dissolved oxygen telemetry recovered to 6.4 mg/L following automated bio-aeration activation in central catchment sector.",
        waterbody_id: "wb-bellandur",
        href: "/waterbodies/wb-bellandur",
        created_at: "2026-10-02T16:00:00Z",
        read: true,
        synthetic: false,
        event_id: "EVT-88194",
      },
      {
        id: "notif-4",
        title: "Floating Debris Interception Milestone · 140kg Recovered",
        description: "Automated floating booms captured seasonal plastics and non-biodegradable debris before primary catchment weir.",
        waterbody_id: "wb-millbank",
        href: "/waterbodies/wb-millbank",
        created_at: "2026-10-01T11:20:00Z",
        read: true,
        synthetic: true,
        event_id: "EVT-77210",
      },
    ];
    return {
      items: mockNotifications,
      unread: mockNotifications.filter((n) => !n.read).length,
      scheduled: 0,
    } as T;
  }

  if (route === "/organisations") {
    return [
      {
        id: "org-reedwatch",
        name: "AquaRelay Watchdog Network",
        description: "Community and field sensor network monitoring lake basins.",
      },
      {
        id: "org-district",
        name: "State Pollution Control Board",
        description: "Regulatory enforcement and rapid environmental remediation dispatch.",
      },
    ] as T;
  }

  if (route === "/preferences") {
    return { notifications: true, theme: "dark" } as T;
  }

  if (route.startsWith("/cases") || route.startsWith("/incidents")) {
    const passport = getMockPassport("wb-reedwater");
    return passport.cases as T;
  }

  if (method === "POST" && (route === "/reports" || route.endsWith("/reports"))) {
    return {
      report: { id: `rep-${Date.now()}` },
      case_id: `case-${Date.now()}`,
      success: true,
      message: "Observation report successfully received and dispatched.",
    } as T;
  }

  if (method === "POST" && route.startsWith("/auth/")) {
    return {
      user: {
        id: "user-citizen",
        name: "Citizen Contributor",
        email: "citizen@aquarelay.local",
        role: "citizen",
        csrf_token: "demo-csrf-token",
      },
      csrf_token: "demo-csrf-token",
    } as T;
  }

  return null;
}
