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
const SessionContext = createContext<{
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
}>({ user: null, loading: true, refresh: async () => {} });
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const identity = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  function updateUser(next: User | null) {
    if (identity.current !== (next?.id ?? null)) {
      // Cancel requests before clearing so an earlier account cannot refill its cache.
      void client.cancelQueries();
      client.clear();
      identity.current = next?.id ?? null;
    }
    setUser(next);
  }
  async function refresh() {
    try {
      const data = await api<{ user: User | null; csrf_token: string }>(
        "/auth/session",
      );
      setCsrf(data.csrf_token);
      updateUser(
        data.user ? { ...data.user, csrf_token: data.csrf_token } : null,
      );
    } catch {
      updateUser(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <SessionContext.Provider value={{ user, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}
export const useSession = () => useContext(SessionContext);
