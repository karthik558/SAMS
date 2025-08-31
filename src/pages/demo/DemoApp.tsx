import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Index from "@/pages/Index";
import Assets from "@/pages/Assets";
import Properties from "@/pages/Properties";
import QRCodes from "@/pages/QRCodes";
import Approvals from "@/pages/Approvals";
import Tickets from "@/pages/Tickets";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import { demoAuthKeys } from "@/lib/demo";

function DemoRequireAuth({ children }: { children: React.ReactNode }) {
  let authed = false;
  try { authed = Boolean(sessionStorage.getItem(demoAuthKeys().current)); } catch {}
  if (!authed) return <Navigate to="/demo/login" replace />;
  return <>{children}</>;
}

export default function DemoAppRouter() {
  return (
    <DemoRequireAuth>
      <Layout>
        <Routes>
          <Route index element={<Index />} />
          <Route path="assets" element={<Assets />} />
          <Route path="properties" element={<Properties />} />
          <Route path="qr-codes" element={<QRCodes />} />
          <Route path="reports" element={<Reports />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </DemoRequireAuth>
  );
}
