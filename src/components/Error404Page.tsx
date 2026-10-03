import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Home, Compass, RotateCw, WifiOff, AlertTriangle } from "lucide-react";

export default function Error404Page({
  title,
  message,
  isOffline = false,
}: {
  title?: string;
  message?: string;
  isOffline?: boolean;
}) {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const offlineActive = isOffline || !online;

  return (
    <div className="error-404-container">
      <div className="error-404-card">
        <div className="error-404-image-wrapper">
          <img
            src="/images/error-404.png"
            alt="Sorry - Error 404 Page Not Found"
            className="error-404-penguin-img"
          />
        </div>

        <div className="error-404-content">
          <div className="error-404-badge">
            {offlineActive ? (
              <>
                <WifiOff size={14} className="text-amber-600" />
                <span>CONNECTION DISRUPTED</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} className="text-emerald-700" />
                <span>ERROR 404 · MISSING WATER RECORD</span>
              </>
            )}
          </div>

          <h1 className="error-404-title">
            {title || (offlineActive ? "Internet Connection Lost" : "Page Not Found")}
          </h1>

          <p className="error-404-desc">
            {message ||
              (offlineActive
                ? "Your network connection seems to be interrupted. Please check your internet or Wi-Fi settings."
                : "The waterbody passport, incident dispatch, or record you requested could not be located in the AquaRelay registry.")}
          </p>

          <div className="error-404-actions">
            <Link to="/" className="button primary">
              <Home size={16} />
              Return Home
            </Link>

            <Link to="/explore" className="button secondary">
              <Compass size={16} />
              Explore Waters
            </Link>

            <button
              type="button"
              className="button secondary"
              onClick={() => window.location.reload()}
            >
              <RotateCw size={15} />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
