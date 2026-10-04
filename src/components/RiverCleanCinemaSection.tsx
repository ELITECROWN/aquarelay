import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Waves,
  Droplet,
  Trash2,
  Zap,
  ArrowRight,
  Compass,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function RiverCleanCinemaSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 (half) to 1 (full big screen)

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // When the top of the container reaches the upper portion of screen
      // Calculate smooth progress across the scroll container
      const totalScrollableDistance = rect.height - windowHeight * 0.35;
      const currentScroll = windowHeight * 0.65 - rect.top;

      if (currentScroll <= 0) {
        setScrollProgress(0);
      } else if (currentScroll >= totalScrollableDistance) {
        setScrollProgress(1);
      } else {
        const rawProgress = currentScroll / totalScrollableDistance;
        setScrollProgress(Math.min(Math.max(rawProgress, 0), 1));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Naturally driven by scroll progress
  const isBigScreen = scrollProgress > 0.42;
  const expansionFactor = Math.min(Math.max((scrollProgress - 0.15) / 0.55, 0), 1);

  const cleanSteps = [
    {
      icon: Trash2,
      tag: "PHASE 1 · DEBRIS INTERCEPTION",
      title: "Automated Floating Trash Barriers",
      desc: "Capturing non-biodegradable plastics, synthetic foams, and municipal solid waste before reaching primary catchment channels.",
    },
    {
      icon: Droplet,
      tag: "PHASE 2 · BIO-AERATION",
      title: "Micro-Bubble Oxygenation",
      desc: "Injecting dissolved oxygen to reverse anaerobic hypoxia, reducing hydrogen sulfide sludge and harmful toxic algae blooms.",
    },
    {
      icon: Zap,
      tag: "PHASE 3 · COMMUNITY PATROLLING",
      title: "Real-Time Watchdog Citations",
      desc: "Citizen observations can be reviewed by responsible organisations and connected to documented actions.",
    },
  ];

  return (
    <section
      ref={containerRef}
      className="river-clean-cinema-container highlight-bar"
      id="river-clean-cinema"
    >
      <div className="cinema-header-strip">
        <div className="cinema-eyebrow">
          <Waves size={16} style={{ color: "#ef4444" }} className="animate-pulse" />
          <span>CINEMATIC RIVER CLEANING & RESTORATION IN ACTION</span>
        </div>
        <h2 className="cinema-heading">
          Restoring Living Waters<span>.</span>
        </h2>
        <p className="cinema-sub">
          Illustrative restoration footage, not evidence of an AquaRelay case or a deployed fleet.
        </p>
      </div>

      {/* Main Dynamic Split/Full Stage */}
      <div
        className={`river-stage ${
          isBigScreen ? "stage-big-screen" : "stage-half-split"
        }`}
      >
        {/* Video Player Box with dynamic width and scale */}
        <div
          className="river-video-wrapper"
          style={{
            width: isBigScreen ? "100%" : "54%",
            transform: `scale(${1 + expansionFactor * 0.02})`,
          }}
        >
          <div className="video-glow-underlay" />
          <div className="video-aspect-container">
            <iframe
              className="youtube-cinema-iframe"
              src="https://www.youtube-nocookie.com/embed/SvFAB4J2Csw?autoplay=1&mute=1&loop=1&playlist=SvFAB4J2Csw&controls=1&modestbranding=1&rel=0&playsinline=1"
              title="River Clean Rejuvenation & Water Health Operations"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <div className="video-live-overlay-tag">
              <span className="live-ping-dot" />
              <span>ILLUSTRATIVE RESTORATION FOOTAGE</span>
            </div>
          </div>
        </div>

        {/* Small River Clean Details Panel */}
        <div
          className="river-details-panel"
          style={{
            opacity: isBigScreen ? 0.95 : 1,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            width: isBigScreen ? "100%" : "44%",
          }}
        >
          <div className="details-header-badge">
            <Sparkles size={14} className="text-amber-400" />
            <span>ECOLOGICAL RIVER RESTORATION PROTOCOLS</span>
          </div>

          <div className="river-clean-cards-list">
            {cleanSteps.map((step) => (
              <div key={step.title} className="clean-detail-card highlight-bar">
                <div className="clean-detail-icon-box">
                  <step.icon size={18} />
                </div>
                <div className="clean-detail-content">
                  <span className="clean-detail-tag">{step.tag}</span>
                  <strong>{step.title}</strong>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="clean-action-row">
            <Link
              to="/report"
              className="button primary"
              style={{ fontSize: "13px", padding: "10px 18px", background: "#ef4444", borderColor: "#dc2626", color: "#ffffff" }}
            >
              Report River Waste Influx <ArrowRight size={14} />
            </Link>
            <Link
              to="/explore"
              className="button secondary"
              style={{ fontSize: "13px", padding: "10px 16px", background: "#ffffff", borderColor: "#e5e7eb", color: "#1f2937" }}
            >
              <Compass size={14} style={{ color: "#ef4444" }} /> Catchment Cleanliness Index
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
