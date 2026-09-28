import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Cargando } from './components/EstadoCarga';
import Login from './pages/Login';

// Spec 012 · R3: cada pantalla se descarga cuando se abre (el paquete inicial era de 940 kB).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Animals = lazy(() => import('./pages/Animals'));
const AnimalDetail = lazy(() => import('./pages/AnimalDetail'));
const ImportarCenso = lazy(() => import('./pages/ImportarCenso'));
const Market = lazy(() => import('./pages/Market'));
const SaleRecommendation = lazy(() => import('./pages/SaleRecommendation'));
const Report = lazy(() => import('./pages/Report'));
const Fincas = lazy(() => import('./pages/Fincas'));
const Costos = lazy(() => import('./pages/Costos'));
const Indicadores = lazy(() => import('./pages/Indicadores'));
const PesajeInicio = lazy(() => import('./pages/Pesaje').then((m) => ({ default: m.PesajeInicio })));
const PesajeJornada = lazy(() => import('./pages/Pesaje').then((m) => ({ default: m.PesajeJornada })));
const LotesLista = lazy(() => import('./pages/Lotes').then((m) => ({ default: m.LotesLista })));
const LoteDetalle = lazy(() => import('./pages/Lotes').then((m) => ({ default: m.LoteDetalle })));
const AlPartirLista = lazy(() => import('./pages/AlPartir').then((m) => ({ default: m.AlPartirLista })));
const ContratoDetalle = lazy(() => import('./pages/AlPartir').then((m) => ({ default: m.ContratoDetalle })));
const VentasLista = lazy(() => import('./pages/Ventas').then((m) => ({ default: m.VentasLista })));
const NuevaVenta = lazy(() => import('./pages/Ventas').then((m) => ({ default: m.NuevaVenta })));
const VentaDetalle = lazy(() => import('./pages/Ventas').then((m) => ({ default: m.VentaDetalle })));

const conCarga = (Pagina) => (
  <Suspense fallback={<Cargando texto="Abriendo…" />}>
    <Pagina />
  </Suspense>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={conCarga(Dashboard)} />
        <Route path="animales" element={conCarga(Animals)} />
        <Route path="animales/importar" element={conCarga(ImportarCenso)} />
        <Route path="animales/:id" element={conCarga(AnimalDetail)} />
        <Route path="pesaje" element={conCarga(PesajeInicio)} />
        <Route path="pesaje/:jornadaId" element={conCarga(PesajeJornada)} />
        <Route path="lotes" element={conCarga(LotesLista)} />
        <Route path="lotes/:loteId" element={conCarga(LoteDetalle)} />
        <Route path="fincas" element={conCarga(Fincas)} />
        <Route path="costos" element={conCarga(Costos)} />
        <Route path="ventas" element={conCarga(VentasLista)} />
        <Route path="ventas/nueva" element={conCarga(NuevaVenta)} />
        <Route path="ventas/:ventaId" element={conCarga(VentaDetalle)} />
        <Route path="al-partir" element={conCarga(AlPartirLista)} />
        <Route path="al-partir/:contratoId" element={conCarga(ContratoDetalle)} />
        <Route path="mercado" element={conCarga(Market)} />
        <Route path="recomendacion" element={conCarga(SaleRecommendation)} />
        <Route path="reporte" element={conCarga(Report)} />
        <Route path="indicadores" element={conCarga(Indicadores)} />
      </Route>
    </Routes>
  );
}
