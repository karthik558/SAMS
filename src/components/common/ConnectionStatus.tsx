import { useEffect, useState } from "react";
import { supabase, hasSupabaseEnv } from "@/lib/supabaseClient";
import { AlertCircle, CheckCircle2, RefreshCw, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ConnectionState = "checking" | "connected" | "disconnected" | "error";

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState>("checking");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [isRetrying, setIsRetrying] = useState(false);

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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-full px-4">
      <Alert variant={status === "error" ? "destructive" : "default"} className="border-2 shadow-lg">
        <div className="flex items-start gap-3">
          {status === "disconnected" && (
            <WifiOff className="h-5 w-5 mt-0.5 flex-shrink-0" />
          )}
          {status === "error" && (
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          )}
          
          <div className="flex-1 space-y-1">
            <AlertTitle className="font-semibold">
              {status === "disconnected" && "Connection Lost"}
              {status === "error" && "Configuration Error"}
            </AlertTitle>
            <AlertDescription className="text-sm">
              {status === "disconnected" && (
                <>
                  <p className="mb-2">{errorDetails}</p>
                  <p className="text-xs opacity-90">
                    <strong>Common causes:</strong>
                  </p>
                  <ul className="text-xs opacity-90 list-disc list-inside space-y-0.5 mb-3">
                    <li>Supabase project is paused (free tier inactivity)</li>
                    <li>Network/firewall restrictions</li>
                    <li>Invalid API credentials</li>
                  </ul>
                  <p className="text-xs opacity-90 mb-2">
                    <strong>To fix:</strong> Visit{" "}
                    <a
                      href="https://app.supabase.com/projects"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      Supabase Dashboard
                    </a>{" "}
                    and check if your project needs to be unpaused.
                  </p>
                  <p className="text-xs opacity-75">
                    Your data is cached locally and will sync when connection is restored.
                  </p>
                </>
              )}
              {status === "error" && (
                <p>{errorDetails}</p>
              )}
            </AlertDescription>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      </Alert>
    </div>
  );
}
