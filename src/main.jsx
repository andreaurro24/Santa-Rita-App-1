import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { configFaltante } from './lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    // Sin reintentos automáticos: ante un fallo de red el usuario ve el error en segundos y
    // decide con el botón Reintentar, en vez de esperar un spinner largo (R7).
    queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false },
  },
});

function ConfigFaltante() {
  return (
    <div role="alert" style={{ maxWidth: 520, margin: '96px auto', padding: 24, fontFamily: 'system-ui', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Falta configurar la conexión con la base de datos</h1>
      <p>
        Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>: en local copia{' '}
        <code>.env.example</code> a <code>.env.local</code>; en Vercel, en Settings → Environment Variables, y vuelve a desplegar.
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  configFaltante ? (
    <ConfigFaltante />
  ) : (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>
  ),
);
