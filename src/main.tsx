import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "./session";
import { ToastProvider } from "./ui";
import App from "./App";
import { OfflineDraftSync } from "./features/offline";
import "./styles.css";
import "./lusion-theme.css";
import "./readability.css";
// An open tab can outlive its deployment's hashed lazy-loaded map bundle.
// Refresh once to obtain the current shell, without a reload loop or losing drafts.
window.addEventListener('vite:preloadError', event => {
  try {
    const key = 'aquarelay-chunk-recovery';
    const previous = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - previous < 60000 || !navigator.onLine) return;
    sessionStorage.setItem(key, String(Date.now()));
    event.preventDefault();
    window.location.reload();
  } catch { /* The error boundary remains available when storage is blocked. */ }
});
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <SessionProvider>
          <ToastProvider>
            <OfflineDraftSync />
            <App />
          </ToastProvider>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Offline shell caching is optional; report drafts have their own capability state. */
    });
  });
}
