import { useState, useEffect } from "react";
import { Waves, Sparkles, ShieldCheck, Droplet } from "lucide-react";

export default function BefreakyPreloader() {
  const [hasVisited] = useState(() => {
    try {
      return sessionStorage.getItem("aquarelay_first_open_done") === "true";
    } catch {
      return false;
    }
  });
  const [percent, setPercent] = useState(0);
  const [complete, setComplete] = useState(false);
  const [hidden, setHidden] = useState(hasVisited);

  useEffect(() => {
    if (hasVisited) return;
    try {
      sessionStorage.setItem("aquarelay_first_open_done", "true");
    } catch {}

    const duration = 1800; // 1.8 seconds total loading sequence
    const intervalTime = 30;
    const step = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setPercent((prev) => {
        const next = prev + step + (Math.random() * 2 - 0.5);
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => setComplete(true), 150);
          setTimeout(() => setHidden(true), 900);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [hasVisited]);

  if (hidden) return null;

  const displayPercent = Math.min(Math.floor(percent), 100);
  const tens = Math.floor(displayPercent / 10);
  const ones = displayPercent % 10;

  return (
    <div
      className={`befreaky-preloader preloader ${complete ? "preloader-exit" : ""}`}
      aria-label="Loading screen"
    >
      {/* Central Brand Watermark */}
      <div className="preloader-center-brand">
        <div className="preloader-logo-ring">
          <Waves size={38} className="preloader-wave-icon" />
        </div>
        <h2 className="preloader-brand-title">
          AquaRelay<span>.</span>
        </h2>
        <p className="preloader-brand-sub">Connecting Living Freshwater Records</p>
      </div>

      {/* Floating Animated Badges / Stickers Inspired by BeFreaky */}
      <div className="preloader__stickers__container">
        <div className="preloader-floating-badge badge-1">
          <Droplet size={14} className="text-emerald-600" />
          <span>REAL-TIME TELEMETRY</span>
        </div>
        <div className="preloader-floating-badge badge-2">
          <ShieldCheck size={14} className="text-emerald-700" />
          <span>AUTHORITY DISPATCH</span>
        </div>
        <div className="preloader-floating-badge badge-3">
          <Sparkles size={14} className="text-emerald-500" />
          <span>GPS-VERIFIED FORENSICS</span>
        </div>
      </div>

      {/* Signature BeFreaky Corner Rolling Number Counter */}
      <div className="preloader__square__container">
        {/* Left Digit Square (Tens) */}
        <div className="preloader__square__left__wrapper">
          <div
            className="preloader__number__left"
            style={{
              transform: `translateY(-${tens * 10}%)`,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <span key={n} className="preloader__number__text">
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* Right Digit Square (Ones) */}
        <div className="preloader__square__right__wrapper">
          <div
            className="preloader__number__right"
            style={{
              transform: `translateY(-${ones * 10}%)`,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <span key={n} className="preloader__number__text">
                {n}
              </span>
            ))}
          </div>
        </div>

        <div className="preloader-percent-indicator">
          <span>%</span>
          <small>LOAD</small>
        </div>
      </div>

      {/* Bottom Progress Line */}
      <div className="preloader-bottom-bar">
        <div
          className="preloader-bottom-fill"
          style={{ width: `${displayPercent}%` }}
        />
      </div>
    </div>
  );
}
