import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Home from "./components/Home";
import Dashboard from "./components/Dashboard";
import ClientDashboard from "./components/ClientDashboard";
import GaleriaPage from "./components/site/GaleriaPage";
import GaleriaAlbumPage from "./components/site/GaleriaAlbumPage";
import VideosPage from "./components/site/VideosPage";
import ServicosPage from "./components/site/ServicosPage";
import ServicoDetailPage from "./components/site/ServicoDetailPage";
import ScrollToTop from "./components/ScrollToTop";
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";


export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check for local login (corporate accounts managed in the admin panel)
    const localUserJson = localStorage.getItem("provisual_local_admin");
    if (localUserJson) {
      try {
        const localUser = JSON.parse(localUserJson);
        setUser(localUser);
        setUserRole(localUser.role || "cliente");
        setLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem("provisual_local_admin");
      }
    }

    // 2. Otherwise listen to Firebase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      setUserRole(currentUser ? "admin" : null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      setUserRole(currentUser ? "admin" : null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#b12a84]/30 border-t-[#b12a84] rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = userRole === "admin";

  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to={isAdmin ? "/dashboard" : "/arquivo"} replace /> : <Login />}
          />
          <Route
            path="/dashboard/*"
            element={
              user
                ? isAdmin
                  ? <Dashboard />
                  : <Navigate to="/arquivo" replace />
                : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/arquivo/*"
            element={
              user
                ? isAdmin
                  ? <Navigate to="/dashboard" replace />
                  : <ClientDashboard />
                : <Navigate to="/login" replace />
            }
          />
          <Route path="/" element={<Home />} />
          <Route path="/galeria" element={<GaleriaPage />} />
          <Route path="/galeria/:slug" element={<GaleriaAlbumPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/servicos" element={<ServicosPage />} />
          <Route path="/servicos/:slug" element={<ServicoDetailPage />} />
          <Route path="/cliente/*" element={<Navigate to="/arquivo" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
