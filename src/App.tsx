import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import Assets from "./pages/Assets";
import Properties from "./pages/Properties";
import QRCodes from "./pages/QRCodes";
import Approvals from "./pages/Approvals";
import Tickets from "./pages/Tickets";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import DemoLogin from "./pages/demo/DemoLogin";
import DemoAppRouter from "./pages/demo/DemoApp";
import AssetDetails from "./pages/AssetDetails";
import Scan from "./pages/Scan";
import { SingleDeviceGuard } from "@/components/session/SingleDeviceGuard";
import { isDemoMode } from "@/lib/demo";
import RequireView from "@/components/session/RequireView";

function RequireAuth({ children }: { children: React.ReactNode }) {
  let authed = false;
  try {
    authed = isDemoMode()
      ? Boolean(localStorage.getItem("demo_current_user_id"))
      : Boolean(localStorage.getItem("current_user_id"));
  } catch {}
  if (!authed) return <Navigate to={isDemoMode() ? "/demo/login" : "/login"} replace />;
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
  <SingleDeviceGuard />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Demo isolated routes */}
          <Route path="/demo/login" element={<DemoLogin />} />
          <Route path="/demo/*" element={<DemoAppRouter />} />
          {/* Public QR scan view: render asset details without auth or layout */}
          <Route path="/assets/:id" element={<AssetDetails />} />
          {/* Public in-app QR scanner */}
          <Route path="/scan" element={<Scan />} />
          <Route
            path="*"
            element={
              <RequireAuth>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/assets" element={<RequireView page="assets"><Assets /></RequireView>} />
                    <Route path="/properties" element={<RequireView page="properties"><Properties /></RequireView>} />
                    <Route path="/qr-codes" element={<RequireView page="qrcodes"><QRCodes /></RequireView>} />
                    <Route path="/approvals" element={<RoleGate roles={["admin","manager"]}><Approvals /></RoleGate>} />
                    <Route path="/tickets" element={<Tickets />} />
                    <Route path="/reports" element={<RequireView page="reports"><Reports /></RequireView>} />
                    <Route path="/users" element={<RequireView page="users"><Users /></RequireView>} />
                    <Route path="/settings" element={<RequireView page="settings"><Settings /></RequireView>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
