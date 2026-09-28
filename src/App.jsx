import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Animals from './pages/Animals';
import AnimalDetail from './pages/AnimalDetail';
import Market from './pages/Market';
import SaleRecommendation from './pages/SaleRecommendation';
import Report from './pages/Report';
import { PesajeInicio, PesajeJornada } from './pages/Pesaje';
import { LotesLista, LoteDetalle } from './pages/Lotes';
import Fincas from './pages/Fincas';
import Costos from './pages/Costos';
import { AlPartirLista, ContratoDetalle } from './pages/AlPartir';
import { VentasLista, NuevaVenta, VentaDetalle } from './pages/Ventas';
import ImportarCenso from './pages/ImportarCenso';

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
        <Route index element={<Dashboard />} />
        <Route path="animales" element={<Animals />} />
        <Route path="animales/importar" element={<ImportarCenso />} />
        <Route path="animales/:id" element={<AnimalDetail />} />
        <Route path="pesaje" element={<PesajeInicio />} />
        <Route path="pesaje/:jornadaId" element={<PesajeJornada />} />
        <Route path="lotes" element={<LotesLista />} />
        <Route path="lotes/:loteId" element={<LoteDetalle />} />
        <Route path="fincas" element={<Fincas />} />
        <Route path="costos" element={<Costos />} />
        <Route path="ventas" element={<VentasLista />} />
        <Route path="ventas/nueva" element={<NuevaVenta />} />
        <Route path="ventas/:ventaId" element={<VentaDetalle />} />
        <Route path="al-partir" element={<AlPartirLista />} />
        <Route path="al-partir/:contratoId" element={<ContratoDetalle />} />
        <Route path="mercado" element={<Market />} />
        <Route path="recomendacion" element={<SaleRecommendation />} />
        <Route path="reporte" element={<Report />} />
      </Route>
    </Routes>
  );
}
