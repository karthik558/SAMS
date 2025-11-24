import { useEffect, useState } from "react";
import { supabase, hasSupabaseEnv } from "@/lib/supabaseClient";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ConnectionState = "checking" | "connected" | "disconnected" | "error";

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState>("checking");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [open, setOpen] = useState(false);

  const checkConnection = async () => {
    if (!hasSupabaseEnv) {
      setStatus("error");
      setErrorDetails("Supabase environment variables not configured");
      return;
    }

    try {
      setStatus("checking");
      // Simple health check - try to query a small table or use a lightweight RPC
      const { error } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .limit(1);

      if (error) {
        // Check if it's a CORS/network error
        if (error.message.includes("Failed to fetch") || 
            error.message.includes("NetworkError") ||
            error.message.includes("CORS")) {
          setStatus("disconnected");
          setErrorDetails("Cannot connect to Supabase. Your project may be paused or have network restrictions.");
        } else {
          setStatus("error");
          setErrorDetails(error.message);
        }
      } else {
        setStatus("connected");
        setErrorDetails("");
      }
    } catch (err: any) {
      setStatus("disconnected");
      setErrorDetails(err?.message || "Unknown connection error");
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkConnection();
    setTimeout(() => setIsRetrying(false), 1000);
  };

  useEffect(() => {
    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Don't show anything if connected
  if (status === "connected" || status === "checking") {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="destructive" 
            size="sm" 
            className={cn(
              "h-10 rounded-full px-4 shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
              "hover:scale-105 active:scale-95 font-medium gap-2"
            )}
          >
            {status === "disconnected" ? <WifiOff className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="hidden sm:inline">Connection Lost</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-80 p-0 overflow-hidden rounded-2xl border-border/60 shadow-xl bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <div className="p-4 bg-destructive/10 border-b border-destructive/20">
            <div className="flex items-center gap-3 text-destructive">
              <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                {status === "disconnected" ? <WifiOff className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              </div>
              <div>
                <h4 className="font-semibold text-sm">Connection Issue</h4>
                <p className="text-xs opacity-90">
                  {status === "disconnected" ? "Network unreachable" : "Configuration error"}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">{errorDetails}</p>
              
              {status === "disconnected" && (
                <div className="text-xs space-y-2 bg-muted/50 p-3 rounded-lg border border-border/50">
                  <p className="font-medium text-foreground">Possible causes:</p>
                  <ul className="list-disc list-inside space-y-1 opacity-80">
                    <li>Supabase project paused (inactivity)</li>
                    <li>Internet connection lost</li>
                    <li>Firewall blocking access</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button 
                size="sm" 
                className="w-full gap-2" 
                onClick={handleRetry} 
                disabled={isRetrying}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} />
                {isRetrying ? "Retrying..." : "Retry Connection"}
              </Button>
            </div>
            
            {status === "disconnected" && (
               <div className="text-[10px] text-center text-muted-foreground pt-1">
                 If this persists, check <a href="https://status.supabase.com/" target="_blank" rel="noreferrer" className="underline hover:text-primary">Supabase Status</a>
               </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
