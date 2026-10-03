import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setCsrf } from "./api";
import type { User } from "./types";

const STORAGE_KEY = "aquarelay_user_session";

function getStoredUser(): User | null {
  if (navigator.onLine) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface SessionContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (next: User | null) => void;
  updateProfile: (data: { name: string; username: string; age?: number | null }) => Promise<void>;
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  setUser: () => {},
  updateProfile: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const identity = useRef<string | null>(null);
  const [user, setUserState] = useState<User | null>(getStoredUser);
  const [loading, setLoading] = useState(true);

  function updateUser(next: User | null) {
    if (next) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }

    if (identity.current !== (next?.id ?? null)) {
      void client.cancelQueries();
      client.clear();
      identity.current = next?.id ?? null;
    }
    setUserState(next);
  }

  async function refresh() {
    try {
      const data = await api<{ user: User | null; csrf_token: string }>(
        "/auth/session",
      );
      if (data?.csrf_token) {
        setCsrf(data.csrf_token);
      }
      if (data?.user) {
        updateUser({ ...data.user, csrf_token: data.csrf_token });
      } else {
        updateUser(null);
      }
    } catch (err) {
      console.warn("Session refresh notice:", err);
      // Retain existing session on cold starts/network hiccups
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(data: { name: string; username: string; age?: number | null }) {
    const res = await api<{ user: User }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ ...data, name: data.name.trim(), username: data.username.trim().replace(/^@+/, ""), age: data.age ?? null }),
    });
    if (!res.user) throw new Error("The server did not confirm the profile update.");
    updateUser(res.user);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        refresh,
        setUser: updateUser,
        updateProfile,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
