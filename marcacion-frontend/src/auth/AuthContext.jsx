// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  me as apiMe,
  getToken,
} from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuth, setIsAuth] = useState(!!getToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Carga el perfil si hay token
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!getToken()) {
        if (alive) { setIsAuth(false); setUser(null); }
        return;
      }
      setLoading(true);
      try {
        const profile = await apiMe();
        if (alive) {
          setUser(profile);
          setIsAuth(true);
        }
      } catch {
        // token inválido → limpiar
        apiLogout();
        if (alive) { setUser(null); setIsAuth(false); }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const value = useMemo(() => ({
    isAuth,
    user,
    loading,
    async login(email, password) {
      await apiLogin(email, password);
      setIsAuth(true);
      try { setUser(await apiMe()); } catch {}
    },
    logout() {
      apiLogout();
      setIsAuth(false);
      setUser(null);
    },
  }), [isAuth, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
