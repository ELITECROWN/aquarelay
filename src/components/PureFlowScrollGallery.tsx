import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, MapPin, Users, ShieldCheck, ChevronRight } from "lucide-react";

export type GalleryItem = {
  src: string;
  title: string;
  location: string;
  stat: string;
  badge: string;
};

const GALLERY_DATA: GalleryItem[] = [
  {
    src: "/gallery/cleanup-boat-unload.png",
    title: "River Catchment Debris Unloading",
    location: "Yamuna Basin · Station #04",
    stat: "14,200 kg Extracted",
    badge: "HEAVY DREDGING",
  },
  {
    src: "/gallery/cleanup-bridge.png",
    title: "Bridge Pylon Debris Interception",
    location: "City Overpass Waterway",
    stat: "42 Citizen Responders",
    badge: "VOLUNTEER BRIGADE",
  },
  {
    src: "/gallery/cleanup-crowd-event.png",
    title: "Massive River Cleanup Mobilization",
    location: "Central Urban Canal",
    stat: "850+ Registered Volunteers",
    badge: "COMMUNITY ALLIANCE",
  },
  {
    src: "/gallery/cleanup-ghat-river.png",
    title: "Shoreline Dredging & Sacred Ghats",
    location: "Historic Riverfront Basin",
    stat: "96.4% Trash Clear Rate",
    badge: "WATERFRONT RECOVERY",
  },
  {
    src: "/gallery/cleanup-hands-sunset.png",
    title: "Sunset Plastic Bottle Interception",
    location: "Bellandur Wetland Fringe",
    stat: "2,300 Bottles Prevented",
    badge: "PLASTIC PATROL",
  },
  {
    src: "/gallery/cleanup-river-dredge.png",
    title: "Shallow-Water Bamboo Dredging",
    location: "Irrigation Feeder Canal",
    stat: "Sub-surface Sludge Cleared",
    badge: "DIRECT EXCAVATION",
  },
  {
    src: "/gallery/cleanup-shore-bags.png",
    title: "Shoreline Plastic Interception Drive",
    location: "Coastal Marsh Reserve",
    stat: "120 Large Sacks Logged",
    badge: "COASTAL DEFENSE",
  },
  {
    src: "/gallery/cleanup-stream-bluebag.png",
    title: "Stream Revival & Debris Bagging",
    location: "Forest Feeder Creek",
    stat: "Restoring Flow & Flora",
    badge: "BIODIVERSITY SQUAD",
  },
  {
    src: "/gallery/cleanup-volunteers-stream.png",
    title: "Youth Community Clean Stream Day",
    location: "Community Lake Park",
    stat: "35 Youth Environmentalists",
    badge: "CITIZEN VIGILANCE",
  },
];

export default function PureFlowScrollGallery() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (sectionRef.current) {
            const rect = sectionRef.current.getBoundingClientRect();
            const total = rect.height - window.innerHeight;
            if (total > 0) {
              const current = -rect.top;
              const p = Math.max(0, Math.min(1, current / total));
              setProgress(p);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Split images into two dynamic sliding rows
  const rowTop = GALLERY_DATA.slice(0, 5);
  const rowBottom = GALLERY_DATA.slice(4);

  // Top rail moves from right to left
  const topTranslate = -progress * 42;
  // Bottom rail moves from left to right
  const bottomTranslate = (progress - 0.5) * 42;

  const currentCount = Math.min(9, Math.floor(progress * 8) + 1);

  return (
    <div ref={sectionRef} className="scroll-gallery-outer">
      {/* Sticky full-screen stage */}
      <div className="scroll-gallery-sticky">
        {/* Subtle Ambient Background Lighting */}
        <div className="scroll-gallery-glow" />

        {/* Section Header */}
        <div className="scroll-gallery-header">
          <div className="scroll-gallery-header-inner">
            <span className="scroll-gallery-pill">
              <span className="live-amber-dot" />
              GROUND ZERO FORENSICS & ACTION
            </span>
            <h2 className="scroll-gallery-heading">
              Living Proof of Clean Waters in Motion.
            </h2>
            <p className="scroll-gallery-sub">
              Scroll down to navigate through frontline community cleanup operations and real recovery missions.
            </p>
          </div>

          <div className="scroll-gallery-meta">
            <div className="scroll-gallery-counter">
              <span className="counter-curr">0{currentCount}</span>
              <span className="counter-sep">/</span>
              <span className="counter-total">09</span>
              <small>Missions Active</small>
            </div>
          </div>
        </div>

        {/* Full-Screen Scroll Interactive Gallery Rails */}
        <div className="scroll-gallery-viewport">
          {/* Top Rail */}
          <div
            className="scroll-gallery-rail rail-top"
            style={{
              transform: `translate3d(${topTranslate}%, 0, 0)`,
            }}
          >
            {rowTop.map((item, idx) => (
              <div
                key={`top-${item.title}-${idx}`}
                className="scroll-gallery-card"
                style={{
                  transform: `perspective(1000px) rotateY(${(0.5 - progress) * 8}deg)`,
                }}
              >
                <div className="card-img-wrap">
                  <img
                    src={item.src}
                    alt={item.title}
                    loading="lazy"
                    draggable={false}
                  />
                  <span className="card-badge-amber">{item.badge}</span>
                </div>
                <div className="card-details">
                  <h4>{item.title}</h4>
                  <div className="card-meta-row">
                    <span>
                      <MapPin size={12} className="text-amber-600 inline mr-1" />
                      {item.location}
                    </span>
                    <strong className="text-amber-700">{item.stat}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Rail */}
          <div
            className="scroll-gallery-rail rail-bottom"
            style={{
              transform: `translate3d(${bottomTranslate}%, 0, 0)`,
            }}
          >
            {rowBottom.map((item, idx) => (
              <div
                key={`bottom-${item.title}-${idx}`}
                className="scroll-gallery-card"
                style={{
                  transform: `perspective(1000px) rotateY(${-(0.5 - progress) * 8}deg)`,
                }}
              >
                <div className="card-img-wrap">
                  <img
                    src={item.src}
                    alt={item.title}
                    loading="lazy"
                    draggable={false}
                  />
                  <span className="card-badge-amber">{item.badge}</span>
                </div>
                <div className="card-details">
                  <h4>{item.title}</h4>
                  <div className="card-meta-row">
                    <span>
                      <MapPin size={12} className="text-amber-600 inline mr-1" />
                      {item.location}
                    </span>
                    <strong className="text-amber-700">{item.stat}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="scroll-gallery-footer">
          <div className="scroll-progress-indicator">
            <span className="progress-hint">
              <span className="scroll-wheel-icon">↓</span> Scroll down to glide through gallery
            </span>
            <div className="progress-track-amber">
              <div
                className="progress-fill-amber"
                style={{ width: `${Math.max(8, progress * 100)}%` }}
              />
            </div>
          </div>

          <Link to="/report" className="scroll-cta-pill">
            <span>Report a Polluted Site</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
