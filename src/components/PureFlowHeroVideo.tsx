import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Waves, VolumeX, Volume2 } from "lucide-react";
import { openSideMenuDrawer } from "./SideMenuDrawer";

export default function PureFlowHeroVideo() {
  const [videoFailed, setVideoFailed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Maintain precise 0.00s to 10.00s video loop
  useEffect(() => {
    let animId: number;
    const checkTime = () => {
      const vid = videoRef.current;
      if (vid) {
        // When reaching 10.0 seconds, loop back to 0.0
        if (vid.currentTime >= 10.0 || vid.currentTime < 0) {
          vid.currentTime = 0;
        }
      }
      animId = requestAnimationFrame(checkTime);
    };
    animId = requestAnimationFrame(checkTime);
    return () => cancelAnimationFrame(animId);
  }, []);

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
            onTimeUpdate={(e) => {
              if (e.currentTarget.currentTime >= 10.0) {
                e.currentTarget.currentTime = 0;
              }
            }}
            onEnded={(e) => {
              e.currentTarget.currentTime = 0;
              e.currentTarget.play().catch(() => {});
            }}
            onError={() => setVideoFailed(true)}
            className="pureflow-bg-video"
            src="/videos/cleanup-machines.mp4#t=0,10"
          />
        ) : (
          <iframe
            className="pureflow-bg-video youtube-fallback"
            src="https://www.youtube-nocookie.com/embed/XWcHTmvIaPA?autoplay=1&mute=1&loop=1&playlist=XWcHTmvIaPA&start=0&end=10&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1"
            title="Ocean and River Cleanup Machines in Action"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        )}

        {/* Soft Cinematic Vignette & Light Gradient Overlay */}
        <div className="pureflow-hero-overlay" />
      </div>


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
            Connect freshwater observations, evidence and documented recovery in one living record.
          </p>
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
