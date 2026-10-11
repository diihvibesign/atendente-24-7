"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@atendente/contracts";
import { api, ClientError, errorMessage } from "../lib/api";
const Context = createContext<{
  session: Session | null;
  setSession: (session: Session | null) => void;
  error: string;
}>({ session: null, setSession: () => {}, error: "" });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const publicRoute = pathname === "/login" || pathname === "/ativar";
  useEffect(() => {
    if (publicRoute || session) return;
    let active = true;
    api<Session>("/auth/me")
      .then((result) => {
        if (active) setSession(result);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ClientError && error.status === 401)
          router.replace("/login");
        else setError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [publicRoute, session, router]);
  return (
    <Context.Provider value={{ session, setSession, error }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
