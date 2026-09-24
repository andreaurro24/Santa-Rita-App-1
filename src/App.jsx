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
        <Route path="animales/:id" element={<AnimalDetail />} />
        <Route path="mercado" element={<Market />} />
        <Route path="recomendacion" element={<SaleRecommendation />} />
        <Route path="reporte" element={<Report />} />
      </Route>
    </Routes>
  );
}
