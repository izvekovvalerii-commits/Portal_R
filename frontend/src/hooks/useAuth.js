import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import { TOKEN_KEY } from "../constants";

export function useAuth() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState(null);

  const fetchProfile = useCallback(async (authToken) => {
    try {
      const user = await apiRequest("/users/me", { token: authToken });
      setProfile(user);
    } catch {
      setToken(null);
      setProfile(null);
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch { /* noop */ }
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    }
  }, [token, fetchProfile]);

  const login = useCallback((authToken) => {
    try {
      localStorage.setItem(TOKEN_KEY, authToken);
    } catch { /* noop */ }
    setToken(authToken);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch { /* noop */ }
    setToken(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(() => {
    if (token) fetchProfile(token);
  }, [token, fetchProfile]);

  return { token, profile, setProfile, login, logout, refreshProfile };
}
