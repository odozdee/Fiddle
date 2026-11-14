"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let subscription;
    try {
      const supabase = getSupabase();
      setClient(supabase);
      if (!supabase) {
        setLoading(false);
        return;
      }
      ({ data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (active) {
          setSession(nextSession);
          setLoading(false);
        }
      }));
      supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError("Your session could not be restored. Please sign in again.");
        setSession(data.session);
        setLoading(false);
      }).catch(() => {
        if (active) {
          setError("Your account could not be reached. Please try again.");
          setLoading(false);
        }
      });
    } catch {
      setError("Accounts are temporarily unavailable.");
      setLoading(false);
    }
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ client, user: session?.user ?? null, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
