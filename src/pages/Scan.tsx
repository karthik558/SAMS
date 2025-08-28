import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        // fallback: go to login if not authed, else home
        const authed = Boolean(localStorage.getItem('current_user_id'));
        window.location.assign(authed ? '/' : '/login');
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
    <div className="p-4 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> QR Scanner</CardTitle>
          <CardDescription>Use your device camera to scan a code and open the link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Top bar with Back */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
          </div>
          <div className="relative aspect-square md:aspect-video bg-black/80 rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[70%] aspect-square border-2 border-primary/60 rounded-lg" />
            </div>
          </div>
          <div className="flex gap-2">
            {!active ? (
              <Button onClick={start} className="gap-2"><Camera className="h-4 w-4" /> Start Camera</Button>
            ) : (
              <Button variant="outline" onClick={stop} className="gap-2"><RotateCcw className="h-4 w-4" /> Stop</Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPickImage(e.target.files?.[0] || undefined); if (e.target) (e.target as HTMLInputElement).value = ""; }} />
            <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="h-4 w-4" /> Scan from Photo
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Tip: On mobile, allow camera access and ensure good lighting. The back camera is preferred. Use your browser back to exit.</p>
        </CardContent>
      </Card>
    </div>
  );
}