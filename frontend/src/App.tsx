/* CivicPulse AI — Main Application Entry & Routing */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { getPublicConfig } from './services/api';
import { initFirebase } from './services/firebase';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import CursorParticleEffect from './components/CursorParticleEffect';

// Pages
import Landing from './pages/Landing';
import ExploreIssues from './pages/ExploreIssues';
import ReportIssue from './pages/ReportIssue';
import ReportDetail from './pages/ReportDetail';
import MapView from './pages/MapView';
import MyReports from './pages/MyReports';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';

function App() {
  useEffect(() => {
    // Dynamically initialize Firebase from backend public configuration
    getPublicConfig()
      .then((cfg) => {
        if (cfg.firebase_configured && cfg.firebase_api_key) {
          initFirebase(cfg);
        }
      })
      .catch((err) => {
        // Backend not reachable or offline in dev
        console.warn('Backend public config could not be fetched:', err.message);
      });
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-white text-black selection:bg-black selection:text-white relative">
          <CursorParticleEffect />
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/explore" element={<ExploreIssues />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/report" element={<ReportIssue />} />
              <Route path="/report/:id" element={<ReportDetail />} />
              <Route path="/my-reports" element={<MyReports />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
          <PwaInstallPrompt />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
