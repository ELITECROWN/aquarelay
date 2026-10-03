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
    const usernameClean = data.username.trim().replace(/^@+/, "");
    try {
      const res = await api<{ user: User; message: string }>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: data.name.trim(),
          username: usernameClean,
          age: data.age !== undefined && data.age !== null && data.age !== ("" as any) ? Number(data.age) : null,
        }),
      });
      if (res?.user) {
        updateUser({ ...res.user, csrf_token: res.user.csrf_token || user?.csrf_token });
        return;
      }
    } catch (error) {
      // If the backend has a conflict (409), rethrow so UI can notify user
      if (error instanceof Error && error.message.includes("already taken")) {
        throw error;
      }
      console.warn("Server profile update failed, updating local state:", error);
    }

    // Always update local state even if offline
    if (user) {
      const updated: User = {
        ...user,
        name: data.name.trim(),
        username: usernameClean,
        age: data.age !== undefined && data.age !== null && data.age !== ("" as any) ? Number(data.age) : null,
      };
      updateUser(updated);
    }
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
