import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

export type ServiceStatus = "operational" | "degraded" | "outage" | "checking" | "unknown";
export type HealthCheck = { id: "db" | "auth" | "hosting"; status: ServiceStatus; latency: number | null; detail: string };
export const statusLabels: Record<ServiceStatus, string> = {
  operational: "Normal", degraded: "Degraded", outage: "Outage", checking: "Checking", unknown: "Unavailable",
};
export function summarizeHealth(checks: Pick<HealthCheck, "status">[]): ServiceStatus {
  if (!checks.length) return "unknown";
  for (const status of ["outage", "degraded", "checking", "unknown"] as ServiceStatus[]) {
    if (checks.some(check => check.status === status)) return status;
  }
  return "operational";
}
async function probe(id: HealthCheck["id"], run: () => PromiseLike<void>): Promise<HealthCheck> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([run(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Health check timed out")), 10_000);
    })]);
    return { id, status: "operational", latency: Math.round(performance.now() - start), detail: "Last request succeeded" };
  } catch (error) {
    const e = error as { status?: number; code?: string };
    const needsSession = e?.status === 401 || e?.status === 403 || ["42501", "PGRST301", "PGRST302"].includes(e?.code);
    return { id, status: needsSession ? "unknown" : "degraded", latency: null,
      detail: needsSession ? "This session cannot verify the service" : "The request failed or timed out; retry to check your connection" };
  } finally { clearTimeout(timer!); }
}
export async function checkSystemHealth() {
  const unavailable = (id: "db" | "auth"): HealthCheck => ({ id, status: "unknown", latency: null, detail: "Supabase is not configured" });
  const checks = await Promise.all([
    hasSupabaseEnv ? probe("db", async () => {
      // Ordinary users can select their own ID; no bucket administration or count column required.
      const { error } = await supabase.from("app_users").select("id", { head: true }).limit(1).abortSignal(AbortSignal.timeout(10_000));
      if (error) throw error;
    }) : Promise.resolve(unavailable("db")),
    hasSupabaseEnv ? probe("auth", async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) throw { status: 401 };
    }) : Promise.resolve(unavailable("auth")),
    probe("hosting", async () => {
      const response = await fetch("/favicon.png", { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("Application request failed");
    }),
  ]);
  return { checks, checkedAt: Date.now() };
}
