import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "./lib/supabase";

// Cada rota carrega o próprio bundle só quando é visitada — o Dashboard e o
// ClientDashboard (secções de administração pesadas) deixam de ir para o
// bundle inicial da SPA, que qualquer visitante do site público tinha de
// descarregar por inteiro antes de ver seja o que for.
const Login = lazy(() => import("./components/Login"));
const Home = lazy(() => import("./components/Home"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const ClientDashboard = lazy(() => import("./components/ClientDashboard"));
const GaleriaPage = lazy(() => import("./components/site/GaleriaPage"));
const GaleriaAlbumPage = lazy(() => import("./components/site/GaleriaAlbumPage"));
const VideosPage = lazy(() => import("./components/site/VideosPage"));
const ServicosPage = lazy(() => import("./components/site/ServicosPage"));
const ServicoDetailPage = lazy(() => import("./components/site/ServicoDetailPage"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#b12a84]/30 border-t-[#b12a84] rounded-full animate-spin" />
    </div>
  );
}


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
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
      </div>
    </Router>
  );
}
