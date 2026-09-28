import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';

// Spec 001 · R1/R11: el cliente solo conoce la URL y la llave PÚBLICA, desde variables de
// entorno. La seguridad de los datos la hacen las políticas RLS de la base de datos.
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Si faltan, main.jsx muestra una pantalla que explica cómo configurarlas (no una página en blanco).
export const configFaltante = !url || !publishableKey;

// Spec 012 · R3: la app solo usa sesión (auth) y consultas (from/rpc). `createClient` de
// supabase-js trae además almacenamiento, tiempo real y funciones (~70 kB que nadie usa), así
// que se arma el mismo cliente con sus dos piezas. Misma llave de sesión en localStorage
// (`sb-<ref>-auth-token`) y mismas cabeceras que supabase-js 2.117.
function crearCliente(supabaseUrl, key) {
  const base = new URL(supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`);
  const auth = new AuthClient({
    url: new URL('auth/v1', base).href,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    storageKey: `sb-${base.hostname.split('.')[0]}-auth-token`,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  });
  // Cada consulta va con el token de la sesión vigente (o la llave pública si no hay sesión).
  const fetchConSesion = async (input, init) => {
    const { data } = await auth.getSession();
    const headers = new Headers(init?.headers);
    if (!headers.has('apikey')) headers.set('apikey', key);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${data.session?.access_token ?? key}`);
    return fetch(input, { ...init, headers });
  };
  const rest = new PostgrestClient(new URL('rest/v1', base).href, { schema: 'public', fetch: fetchConSesion });
  return {
    auth,
    from: (tabla) => rest.from(tabla),
    rpc: (fn, args, opciones) => rest.rpc(fn, args, opciones),
  };
}

export const supabase = configFaltante ? null : crearCliente(url, publishableKey);
