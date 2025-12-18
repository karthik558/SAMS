import { isDemoMode } from "@/lib/demo";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode, Camera, Image as ImageIcon, RotateCcw, ArrowLeft } from "lucide-react";
import { BrowserMultiFormatReader, BrowserQRCodeReader } from "@zxing/browser";
import type { Result } from "@zxing/library";

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => stop();
  }, []);

  const start = async () => {
    setError("");
    setLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not available in this browser");
      }

      // Some browsers require HTTPS for camera access
      const isSecure = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
      if (!isSecure) {
        toast.info("Camera requires HTTPS. Open this site over https:// or localhost.");
      }

      if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader();

      // Decode using facingMode to prefer back camera; lets the browser pick the best device
      await readerRef.current.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current!,
        (result, err) => {
        if (result) {
          handleResult(result);
        } else if (err) {
          // NotFoundException just means no code in frame yet; ignore
          // console.warn(err);
        }
        }
      );
      setActive(true);
    } catch (e: any) {
      console.error(e);
      const msg = e?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow access in your browser settings.'
        : (e?.name === 'NotFoundError' ? 'No camera found on this device.' : (e?.message || 'Failed to start camera'));
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    try {
  try { (readerRef.current as any)?.reset?.(); } catch {}
    } catch {}
    // stop any active stream
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setActive(false);
  };

  const handleResult = (result: Result) => {
    const text = result.getText();
    if (!text) return;
    // Stop camera before navigating
    stop();
    try {
      // If it looks like a URL, go there; otherwise try to parse QR JSON or asset id
      if (/^https?:\/\//i.test(text)) {
        window.location.assign(text);
      } else if (/^\//.test(text)) {
        window.location.assign(text);
      } else {
        // Try to handle asset id fallback
        const idMatch = text.match(/[A-Z]{2,}[A-Z0-9\-]*\d{3,}$/);
        if (idMatch) {
          window.location.assign(`/assets/${idMatch[0]}`);
        } else {
          toast.info(`Scanned: ${text}`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBack = () => {
    try {
      if (window.history.length > 1) {
        window.history.back();
      } else {
  // fallback: go to login if not authed, else home (demo-aware)
  const demo = isDemoMode();
  const authed = demo ? Boolean(sessionStorage.getItem('demo_current_user_id')) : Boolean(localStorage.getItem('current_user_id'));
  window.location.assign(authed ? (demo ? '/demo' : '/') : (demo ? '/demo/login' : '/login'));
      }
    } catch {
      window.location.assign('/');
    }
  };

  const onPickImage = async (file?: File) => {
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      try {
        const reader = new BrowserQRCodeReader();
        const res = await reader.decodeFromImageUrl(url);
        handleResult(res);
      } catch (e: any) {
        toast.error(e?.message || "No QR found in image");
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to read image");
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Scan QR</CardTitle>
                <CardDescription>Use your camera or a photo to scan and open links or assets.</CardDescription>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              {active ? (
                <Badge variant="outline" className="badge-pill-success">Camera active</Badge>
              ) : (
                <Badge variant="outline" className="badge-pill-muted">Idle</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="gap-2 shrink-0" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="flex gap-2">
              {!active ? (
                <Button onClick={start} className="gap-2 shrink-0" disabled={loading}>
                  <Camera className="h-4 w-4" />
                  <span className="hidden sm:inline">{loading ? 'Starting…' : 'Start Camera'}</span>
                  <span className="sm:hidden">{loading ? '...' : 'Camera'}</span>
                </Button>
              ) : (
                <Button variant="outline" onClick={stop} className="gap-2 shrink-0"><RotateCcw className="h-4 w-4" /> Stop</Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { onPickImage(e.target.files?.[0] || undefined); if (e.target) (e.target as HTMLInputElement).value = ""; }}
              />
              <Button type="button" variant="outline" className="gap-2 shrink-0" onClick={() => fileRef.current?.click()}>
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Scan from Photo</span>
                <span className="sm:hidden">Photo</span>
              </Button>
            </div>
          </div>

          <div className="relative aspect-[3/4] md:aspect-video rounded-2xl border border-primary/20 bg-gradient-to-b from-black/60 to-black/85 overflow-hidden">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            {/* Overlay: framing corners */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-4">
                <div className="absolute left-0 top-0 h-10 w-10 border-l-2 border-t-2 border-primary/70 rounded-tl-md" />
                <div className="absolute right-0 top-0 h-10 w-10 border-r-2 border-t-2 border-primary/70 rounded-tr-md" />
                <div className="absolute left-0 bottom-0 h-10 w-10 border-l-2 border-b-2 border-primary/70 rounded-bl-md" />
                <div className="absolute right-0 bottom-0 h-10 w-10 border-r-2 border-b-2 border-primary/70 rounded-br-md" />
              </div>
              {/* Subtle center guide */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-md border border-primary/30" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Tip: On mobile, allow camera access and ensure good lighting. The back camera is preferred. You can also scan from a screenshot or photo.</p>
        </CardContent>
      </Card>
    </div>
  );
}
