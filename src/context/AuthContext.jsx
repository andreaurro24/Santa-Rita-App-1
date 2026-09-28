import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mensajeError } from '../lib/errores';

const AuthContext = createContext(null);

const ROL_LABEL = {
  dueno: 'Dueño / Decisión de venta',
  administrador: 'Administrador operativo',
};

// Devuelve el usuario de la app. Dos casos sin acceso, con mensajes distintos:
// - `sinAcceso`: la cuenta existe pero no tiene perfil activo (hay que pedir acceso).
// - `errorPerfil`: no se pudo consultar el perfil (red o servidor); no es culpa de la cuenta.
async function resolverUsuario(authUser) {
  const base = { id: authUser.id, email: authUser.email };
  const { data, error } = await supabase.from('perfiles').select('nombre, rol, activo').eq('id', authUser.id).maybeSingle();
  if (error) {
    console.error('No se pudo cargar el perfil:', error);
    return { ...base, errorPerfil: mensajeError(error) };
  }
  if (!data || !data.activo) return { ...base, sinAcceso: true };
  return { ...base, nombre: data.nombre, rol: data.rol, rolLabel: ROL_LABEL[data.rol] };
}

export const tieneAcceso = (user) => Boolean(user && !user.sinAcceso && !user.errorPerfil);

// Spec 001 · R1–R3: sesión con Supabase Auth. `user` es null sin sesión; `cargando` es true
// mientras se restaura la sesión guardada, para no mandar al login a quien ya entró.
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function aplicarSesion(session) {
      const siguiente = session ? await resolverUsuario(session.user) : null;
      if (!activo) return;
      setUser(siguiente);
      setCargando(false);
    }

    // onAuthStateChange emite INITIAL_SESSION con la sesión guardada, y luego SIGNED_IN,
    // SIGNED_OUT y TOKEN_REFRESHED. El trabajo asíncrono va fuera del callback (setTimeout)
    // para no bloquear el cliente de auth.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear();
      // SIGNED_IN también llega cuando se entra desde otra pestaña; resolverlo dos veces tras
      // login() es inofensivo (el perfil es el mismo).
      if (event === 'TOKEN_REFRESHED') return;
      setTimeout(() => aplicarSesion(session), 0);
    });

    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  // Espera también el perfil antes de responder, para que la pantalla de login sepa si
  // puede navegar o debe explicar por qué no hay acceso (verificación 001, hallazgo Alto).
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: mensajeError(error) };
    const siguiente = await resolverUsuario(data.user);
    setUser(siguiente);
    setCargando(false);
    return { ok: tieneAcceso(siguiente), user: siguiente };
  }

  async function reintentarPerfil() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return setUser(null);
    setUser(await resolverUsuario(data.session.user));
  }

  async function logout() {
    queryClient.clear();
    setUser(null);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, cargando, login, logout, reintentarPerfil }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
