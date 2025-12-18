import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database, Shield, Globe, GitBranch, Cloud, Server } from "lucide-react";

export type ServiceStatus = "operational" | "degraded" | "outage" | "checking";

export interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  latency: number;
  icon: any;
  description: string;
  region?: string;
  uptime?: string;
}

export function useSystemStatus() {
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

    // 5. Check Cloudflare/DNS (Simulated)
    let dnsStatus: ServiceStatus = 'operational';
    let dnsLatency = Math.floor(Math.random() * 15) + 5;

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

  const overallStatus = services.every(s => s.status === 'operational') 
    ? 'operational' 
    : services.some(s => s.status === 'outage') 
      ? 'outage' 
      : 'degraded';

  return {
    services,
    checking,
    lastChecked,
    checkServices,
    overallStatus
  };
}
