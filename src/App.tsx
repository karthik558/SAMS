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
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import AssetDetails from "./pages/AssetDetails";

function RequireAuth({ children }: { children: React.ReactNode }) {
  let authed = false;
  try {
    authed = Boolean(localStorage.getItem("current_user_id"));
  } catch {}
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public QR scan view: render asset details without auth or layout */}
          <Route path="/assets/:id" element={<AssetDetails />} />
          <Route
            path="*"
            element={
              <RequireAuth>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/assets" element={<Assets />} />
                    <Route path="/properties" element={<Properties />} />
                    <Route path="/qr-codes" element={<QRCodes />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/settings" element={<Settings />} />
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
