import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      console.error("404:", location.pathname);
    } catch {}
  }, [location.pathname]);

  return (
    <div className="flex items-center justify-center py-10 md:py-16">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">404</CardTitle>
          <CardDescription className="text-sm">Page not found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            The page you’re looking for doesn’t exist or may have been moved.
          </p>
          <Separator className="my-4" />
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go back
            </Button>
            <Button onClick={() => navigate(isDemoMode() ? "/demo" : "/")} className="gap-2">
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
