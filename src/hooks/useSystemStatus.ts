import { useQuery } from "@tanstack/react-query";
import { Database, Shield, Globe, type LucideIcon } from "lucide-react";
import { checkSystemHealth, summarizeHealth, type ServiceStatus } from "@/services/systemStatus";
export { statusLabels } from "@/services/systemStatus";
export type { ServiceStatus } from "@/services/systemStatus";

export interface ServiceHealth {
  id: string; name: string; status: ServiceStatus; latency: number | null;
  icon: LucideIcon; description: string; detail: string;
}
const definitions = [
  { id: "db", name: "Database access", icon: Database, description: "Authenticated application query" },
  { id: "auth", name: "Authentication", icon: Shield, description: "Server-verified current session" },
  { id: "hosting", name: "Application hosting", icon: Globe, description: "Uncached application request" },
] as const;
export function useSystemStatus() {
  // Sidebar and status page share one measured snapshot and one polling schedule.
  const query = useQuery({ queryKey: ["system-health"], queryFn: checkSystemHealth,
    staleTime: 30_000, refetchInterval: 60_000, retry: false });
  const services: ServiceHealth[] = definitions.map(service => {
    const result = query.data?.checks.find(check => check.id === service.id);
    return { ...service, status: result?.status ?? (query.isError ? "unknown" : "checking"),
      latency: result?.latency ?? null, detail: result?.detail ?? "Waiting for the first check" };
  });
  return { services, checking: query.isFetching, lastChecked: query.data ? new Date(query.data.checkedAt) : null,
    checkServices: () => { void query.refetch(); }, overallStatus: summarizeHealth(services) };
}
