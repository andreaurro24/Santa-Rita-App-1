import { createContext, useContext, useEffect, useState } from 'react';
import { USERS } from '../data/seedUsers';

const STORAGE_KEY = 'santarita_session_v1';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage no disponible: la sesión no persiste entre recargas */
    }
  }, [user]);

  function login(usuario, password) {
    const found = USERS.find((u) => u.usuario === usuario && u.password === password);
    if (!found) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
    const { password: _pw, ...safeUser } = found;
    setUser(safeUser);
    return { ok: true };
  }

  function logout() {
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
