import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { useSystemStatus, statusLabels } from "@/hooks/useSystemStatus";
import { cn } from "@/lib/utils";

export default function Status() {
  const { services, checking, checkServices, overallStatus, lastChecked } = useSystemStatus();
  const healthy = services.filter(service => service.status === "operational").length;
  const measured = services.flatMap(service => service.latency === null ? [] : [service.latency]);
  return (
    <div className="space-y-6 pb-10">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "System Status" }]} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold">System Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">Current requests from your session. Checks refresh every minute.</p></div>
        <div className="flex items-center gap-3"><Badge variant="outline" aria-live="polite">System {statusLabels[overallStatus]}</Badge>
          <Button variant="outline" onClick={checkServices} disabled={checking}><RefreshCw className={cn("mr-2 h-4 w-4", checking && "animate-spin")} />Refresh</Button></div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">Successful checks</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{healthy}/{services.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Slowest successful request</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{measured.length ? `${Math.max(...measured)} ms` : "Not measured"}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Last checked</CardTitle></CardHeader><CardContent>{lastChecked ? lastChecked.toLocaleTimeString() : "Waiting for first check"}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Service checks</CardTitle></CardHeader>
        <CardContent className="divide-y">{services.map(service => <div key={service.id} className="flex items-center justify-between gap-4 py-5">
          <div className="flex items-start gap-3"><service.icon className="mt-1 h-5 w-5 text-muted-foreground" /><div><h2 className="font-medium">{service.name}</h2><p className="text-sm text-muted-foreground">{service.description}</p><p className="mt-1 text-xs text-muted-foreground">{service.detail}</p></div></div>
          <div className="shrink-0 text-right"><div className={cn("flex items-center gap-2 text-sm", service.status === "degraded" ? "text-amber-600" : service.status === "operational" ? "text-emerald-600" : "text-muted-foreground")}>
            {service.status === "operational" ? <CheckCircle2 className="h-4 w-4" /> : service.status === "checking" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            {statusLabels[service.status]}</div><p className="mt-1 text-xs text-muted-foreground">{service.latency === null ? "—" : `${service.latency} ms`}</p></div>
        </div>)}</CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">This is a session connectivity check. Historical uptime, provider incidents, deployment health, and storage administration are not inferred from these requests.</p>
    </div>
  );
}
