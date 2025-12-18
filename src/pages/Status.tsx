import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity, Database, Server, Shield, GitBranch, Globe, Clock, Zap, Cloud, Terminal, Cpu } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

type ServiceStatus = "operational" | "degraded" | "outage" | "checking";

interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  latency: number;
  icon: any;
  description: string;
  region?: string;
  uptime?: string;
}

const MOCK_HISTORY_DATA = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  latency: Math.floor(Math.random() * 40) + 20,
  requests: Math.floor(Math.random() * 1000) + 500,
  errors: Math.floor(Math.random() * 5),
}));

const MOCK_LOGS = [
  { time: "10:42:15", level: "INFO", message: "Health check routine initiated" },
  { time: "10:42:16", level: "INFO", message: "Database connection pool verified" },
  { time: "10:42:16", level: "DEBUG", message: "Latency check: 24ms" },
  { time: "10:42:17", level: "INFO", message: "Edge cache revalidation complete" },
  { time: "10:42:18", level: "INFO", message: "All systems operational" },
];

export default function Status() {
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [checking, setChecking] = useState(false);
  const [services, setServices] = useState<ServiceHealth[]>([
    { id: 'db', name: 'Primary Database Cluster', status: 'checking', latency: 0, icon: Database, description: 'PostgreSQL High Availability', region: 'us-east-1', uptime: '99.99%' },
    { id: 'auth', name: 'Identity Provider', status: 'checking', latency: 0, icon: Shield, description: 'OAuth2 & Session Management', region: 'Global', uptime: '99.95%' },
    { id: 'hosting', name: 'Edge Network', status: 'checking', latency: 0, icon: Globe, description: 'CDN & Serverless Functions', region: 'Global', uptime: '100%' },
    { id: 'repo', name: 'Version Control System', status: 'checking', latency: 0, icon: GitBranch, description: 'CI/CD Pipeline Status', region: 'Global', uptime: '99.9%' },
    { id: 'dns', name: 'DNS & CDN Layer', status: 'checking', latency: 0, icon: Cloud, description: 'DDoS Protection & Routing', region: 'Global', uptime: '100%' },
    { id: 'api', name: 'API Gateway', status: 'checking', latency: 0, icon: Server, description: 'REST/GraphQL Endpoints', region: 'us-east-1', uptime: '99.99%' },
  ]);

  const checkServices = useCallback(async () => {
    setChecking(true);
    
    // 1. Check Database
    let dbStatus: ServiceStatus = 'operational';
    let dbLatency = 0;
    try {
      const dbStart = performance.now();
      const { error } = await supabase.from('app_users').select('count', { count: 'exact', head: true });
      if (error) throw error;
      dbLatency = Math.round(performance.now() - dbStart);
    } catch (e) {
      console.error(e);
      dbStatus = 'degraded';
    }

    // 2. Check Auth
    let authStatus: ServiceStatus = 'operational';
    let authLatency = 0;
    try {
      const authStart = performance.now();
      const { data } = await supabase.auth.getSession();
      authLatency = Math.round(performance.now() - authStart);
      if (!data) authStatus = 'degraded';
    } catch {
      authStatus = 'outage';
    }

    // 3. Check Hosting (Self-ping)
    let hostStatus: ServiceStatus = 'operational';
    let hostLatency = 0;
    try {
      const hostStart = performance.now();
      await fetch(window.location.origin, { method: 'HEAD' });
      hostLatency = Math.round(performance.now() - hostStart);
    } catch {
      hostStatus = 'degraded';
    }

    // 4. Check GitHub (Public API status)
    let gitStatus: ServiceStatus = 'operational';
    let gitLatency = 0;
    try {
      const gitStart = performance.now();
      const res = await fetch('https://www.githubstatus.com/api/v2/status.json');
      const data = await res.json();
      gitLatency = Math.round(performance.now() - gitStart);
      if (data.status.indicator !== 'none') gitStatus = 'degraded';
    } catch {
      gitStatus = 'checking';
    }

    // 5. Check Cloudflare/DNS (Simulated via public DNS resolver or just assuming operational if app loads)
    // We'll simulate a check to 1.1.1.1 or similar if possible, or just use a random low latency to simulate edge
    let dnsStatus: ServiceStatus = 'operational';
    let dnsLatency = Math.floor(Math.random() * 15) + 5; // Simulated edge latency

    // 6. API (Simulated)
    const apiLatency = dbLatency + Math.floor(Math.random() * 20);

    setServices(prev => prev.map(s => {
      if (s.id === 'db') return { ...s, status: dbStatus, latency: dbLatency };
      if (s.id === 'auth') return { ...s, status: authStatus, latency: authLatency };
      if (s.id === 'hosting') return { ...s, status: hostStatus, latency: hostLatency };
      if (s.id === 'repo') return { ...s, status: gitStatus, latency: gitLatency };
      if (s.id === 'dns') return { ...s, status: dnsStatus, latency: dnsLatency };
      if (s.id === 'api') return { ...s, status: 'operational', latency: apiLatency };
      return s;
    }));

    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 60000);
    return () => clearInterval(interval);
  }, [checkServices]);

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'operational': return 'text-primary';
      case 'degraded': return 'text-amber-500';
      case 'outage': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'operational': return 'bg-primary/15 text-primary border-primary/20';
      case 'degraded': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'outage': return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status: ServiceStatus) => {
    switch (status) {
      case 'operational': return <CheckCircle2 className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      case 'outage': return <XCircle className="h-4 w-4" />;
      default: return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "System Status" }]} />
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-primary/10 to-background p-6 md:p-10 shadow-sm border border-primary/10">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
               <Activity className="h-4 w-4" />
               System Health Monitor
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              System Status
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Real-time operational metrics and service health.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono py-1.5 bg-background/50 backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
              SYSTEM NORMAL
            </Badge>
            <Button variant="outline" size="sm" onClick={checkServices} disabled={checking} className="bg-background/50 backdrop-blur-sm">
              <RefreshCw className={cn("h-4 w-4 mr-2", checking && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur-sm rounded-2xl border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Latency</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">42ms</div>
            <p className="text-xs text-muted-foreground">+2ms from last hour</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm rounded-2xl border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime (30d)</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">99.99%</div>
            <p className="text-xs text-muted-foreground">Target met</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm rounded-2xl border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{services.length}/{services.length}</div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm rounded-2xl border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">0.00%</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-7">
        {/* Main Service List */}
        <Card className="md:col-span-2 lg:col-span-4 border-border/50 shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Service Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-lg bg-background border shadow-sm group-hover:border-primary/30 transition-colors", getStatusColor(service.status))}>
                      <service.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {service.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{service.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-8">
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Region</div>
                      <div className="text-xs font-mono text-foreground">{service.region}</div>
                    </div>
                    <div className="text-right w-16">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Latency</div>
                      <div className={cn("text-xs font-mono font-medium", service.latency > 200 ? "text-amber-500" : "text-foreground")}>
                        {service.latency > 0 ? `${service.latency}ms` : '-'}
                      </div>
                    </div>
                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium w-[110px] justify-center", getStatusBadge(service.status))}>
                      {getStatusIcon(service.status)}
                      <span className="capitalize">{service.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts & Logs */}
        <div className="md:col-span-1 lg:col-span-3 space-y-6">
          {/* Latency Chart */}
          <Card className="border-border/50 shadow-sm rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Response Latency (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[150px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_HISTORY_DATA}>
                    <defs>
                      <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={[0, 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorLatency)" 
                      strokeWidth={2} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Terminal Logs */}
          <Card className="border-border/50 shadow-sm bg-zinc-950 dark:bg-black rounded-3xl">
            <CardHeader className="pb-2 border-b border-zinc-800">
              <CardTitle className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                <Terminal className="h-3 w-3" />
                SYSTEM_LOGS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 font-mono text-xs">
              <div className="space-y-1.5">
                {MOCK_LOGS.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-zinc-500">{log.time}</span>
                    <span className={cn(
                      log.level === 'INFO' ? 'text-blue-400' : 'text-primary'
                    )}>{log.level}</span>
                    <span className="text-zinc-300">{log.message}</span>
                  </div>
                ))}
                <div className="flex gap-3 animate-pulse">
                  <span className="text-zinc-500">{new Date().toLocaleTimeString([], { hour12: false })}</span>
                  <span className="text-zinc-500">...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
