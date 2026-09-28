import { createClient } from '@supabase/supabase-js';

// Spec 001 · R1/R11: el cliente solo conoce la URL y la llave PÚBLICA, desde variables de
// entorno. La seguridad de los datos la hacen las políticas RLS de la base de datos.
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Si faltan, main.jsx muestra una pantalla que explica cómo configurarlas (no una página en blanco).
export const configFaltante = !url || !publishableKey;

export const supabase = configFaltante ? null : createClient(url, publishableKey);
