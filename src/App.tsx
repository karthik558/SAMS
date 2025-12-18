import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import Assets from "./pages/Assets";
import Properties from "./pages/Properties";
import QRCodes from "./pages/QRCodes";
import Approvals from "./pages/Approvals";
import Tickets from "./pages/Tickets";
import Reports from "./pages/Reports";
import Audit from "./pages/Audit";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import DemoLogin from "./pages/demo/DemoLogin";
import DemoAppRouter from "./pages/demo/DemoApp";
import AssetDetails from "./pages/AssetDetails";
import Scan from "./pages/Scan";
import Website from "./pages/Website";
import Newsletter from "./pages/Newsletter";
import Status from "./pages/Status";
import LicensePage from "./pages/License";
import Help from "./pages/Help";
// SingleDeviceGuard removed per user request
import { isDemoMode } from "@/lib/demo";
import RequireView from "@/components/session/RequireView";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { ThemeInitializer } from "@/components/common/ThemeInitializer";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  let authed = false;
  try {
    authed = isDemoMode()
      ? Boolean(sessionStorage.getItem("demo_current_user_id"))
      : Boolean(localStorage.getItem("current_user_id"));
  } catch {}
  
  if (!authed) {
    if (location.pathname === "/") {
      return <Navigate to="/site" replace />;
    }
    return <Navigate to={isDemoMode() ? "/demo/login" : "/login"} replace />;
  }
  return <>{children}</>;
}

function RoleGate({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  let role = "";
  try {
    const raw = localStorage.getItem("auth_user");
    role = raw ? (JSON.parse(raw).role || "") : "";
  } catch {}
  const r = (role || "").toLowerCase();
  if (!roles.map(s => s.toLowerCase()).includes(r)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function isAuthenticated() {
  try {
    return isDemoMode()
      ? Boolean(sessionStorage.getItem("demo_current_user_id"))
      : Boolean(localStorage.getItem("current_user_id"));
  } catch {
    return false;
  }
}

function AppShell() {
  return (
    <RequireAuth>
      <Layout>
        <Outlet />
      </Layout>
    </RequireAuth>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ConnectionStatus />
      <ThemeInitializer />
  {/* SingleDeviceGuard removed */}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public minimal marketing website */}
          <Route path="/site" element={<Website />} />
          {/* Demo isolated routes */}
          <Route path="/demo/login" element={<DemoLogin />} />
          <Route path="/demo/*" element={<DemoAppRouter />} />
          {/* Public QR scan view: render asset details without auth or layout */}
          <Route path="/assets/:id" element={<AssetDetails />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Index />} />
            <Route path="/assets" element={<RequireView page="assets"><Assets /></RequireView>} />
            <Route path="/properties" element={<RequireView page="properties"><Properties /></RequireView>} />
            <Route path="/qr-codes" element={<RequireView page="qrcodes"><QRCodes /></RequireView>} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/approvals" element={<RoleGate roles={["admin","manager"]}><Approvals /></RoleGate>} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/newsletter" element={<Newsletter />} />
            <Route path="/help" element={<Help />} />
            <Route path="/reports" element={<RequireView page="reports"><Reports /></RequireView>} />
            <Route path="/audit" element={<RoleGate roles={["manager","admin"]}><Audit /></RoleGate>} />
            <Route path="/users" element={<RequireView page="users"><Users /></RequireView>} />
            <Route path="/settings" element={<RequireView page="settings"><Settings /></RequireView>} />
            <Route path="/status" element={<RoleGate roles={['admin']}><Status /></RoleGate>} />
            <Route path="/license" element={<RoleGate roles={['admin']}><LicensePage /></RoleGate>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
