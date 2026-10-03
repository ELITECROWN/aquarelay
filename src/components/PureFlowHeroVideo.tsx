import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRight, Zap, Shield, Waves, Play, VolumeX, Volume2, Compass } from "lucide-react";
import { openSideMenuDrawer } from "./SideMenuDrawer";

export default function PureFlowHeroVideo() {
  const [videoFailed, setVideoFailed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Subtle 3D mouse parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseOffset({ x: x * 18, y: y * 14 });
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <div
      ref={heroRef}
      className="pureflow-hero-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMouseOffset({ x: 0, y: 0 })}
    >
      {/* 3D Moving Video Background */}
      <div
        className="pureflow-video-canvas"
        style={{
          transform: `scale(1.06) translate3d(${mouseOffset.x * 0.4}px, ${mouseOffset.y * 0.4}px, 0)`,
        }}
      >
        {!videoFailed ? (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            onError={() => setVideoFailed(true)}
            className="pureflow-bg-video"
            src="/videos/cleanup-machines.mp4"
          />
        ) : (
          <iframe
            className="pureflow-bg-video youtube-fallback"
            src="https://www.youtube-nocookie.com/embed/XWcHTmvIaPA?autoplay=1&mute=1&loop=1&playlist=XWcHTmvIaPA&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1"
            title="Ocean and River Cleanup Machines in Action"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        )}

        {/* Soft Cinematic Vignette & Light Gradient Overlay */}
        <div className="pureflow-hero-overlay" />
      </div>

      {/* Floating PureFlow Glass Capsule Top Navigation */}
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
          <Link to="/" className="active">Home</Link>
          <Link to="/dispatch-tracker">Track</Link>
          <Link to="/explore">Explore</Link>
          <Link to="/notifications">Updates</Link>
          <Link to="/organisations">Organisations</Link>
        </nav>

        <div className="pureflow-nav-right">
          <Link to="/report" className="pureflow-nav-btn">
            Report Anomaly
          </Link>
        </div>
      </header>

      {/* Hero Content matching the PureFlow reference image */}
      <div
        className="pureflow-hero-content"
        style={{
          transform: `translate3d(${mouseOffset.x * -0.6}px, ${mouseOffset.y * -0.6}px, 0)`,
        }}
      >
        <div className="pureflow-hero-copy">
          <h1 className="pureflow-hero-title">
            Clean Water,<br />
            Brighter Futures.
          </h1>
          <p className="pureflow-hero-sub">
            When citizens, volunteers, and automated cleanup machines unite, our lakes and rivers regain life, clarity, and safety.
          </p>

          <div className="pureflow-cta-row">
            <Link to="/report" className="pureflow-btn-amber">
              Report Anomaly <Plus size={18} />
            </Link>
            <Link to="/dispatch-tracker" className="pureflow-btn-glass">
              <Zap size={16} /> Track Dispatches
            </Link>
          </div>
        </div>

        {/* Floating 3D Telemetry Badges */}
        <div className="pureflow-floating-badges">
          <div className="pureflow-3d-badge badge-top">
            <span className="live-amber-dot" />
            <strong>Clean Machines Active</strong>
            <small>Catchment Unit #04 In Transit</small>
          </div>
          <div className="pureflow-3d-badge badge-bottom">
            <Shield size={16} className="text-amber-500" />
            <strong>Real-Time Watchdog</strong>
            <small>Citizen GPS Forensics</small>
          </div>
        </div>
      </div>

      {/* Subtle Video Control Pill */}
      <div className="pureflow-video-ctrl">
        <button
          type="button"
          onClick={toggleMute}
          className="pureflow-mute-btn"
          title={isMuted ? "Unmute video audio" : "Mute video audio"}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          <span>{isMuted ? "Sound Off" : "Sound On"}</span>
        </button>
      </div>
    </div>
  );
}
