import { defineConfig } from "@playwright/test";
import path from "node:path";
import base from "./playwright.config";

// A new server-side database and evidence directory for each browser run.
// Nothing resets or deletes the application database or its uploaded files.
const runtime = path.resolve("backend/data", `browser-qa-${Date.now()}`);
const backend = path.resolve("backend");
const python =
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python";
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:5174" },
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8001`,
      cwd: backend,
      url: "http://127.0.0.1:8001/health",
      reuseExistingServer: false,
      env: {
        DATABASE_URL: `sqlite:///${path.join(runtime, "aquarelay.sqlite").replaceAll("\\", "/")}`,
        STORAGE_PATH: path.join(runtime, "files"),
        DEMO_MODE: "true",
        EMBEDDED_WORKER: "true",
        COOKIE_SECURE: "false",
        HANDOFF_RECIPIENTS_JSON: "{}",
        CORS_ORIGINS: "http://127.0.0.1:5174,http://localhost:5174",
      },
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: { AQUARELAY_API_URL: "http://127.0.0.1:8001" },
    },
  ],
});
