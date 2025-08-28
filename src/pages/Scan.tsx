import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { QrCode, Camera, Image as ImageIcon, RotateCcw, ArrowLeft } from "lucide-react";
import { BrowserMultiFormatReader, Result, NotFoundException } from "@zxing/library";
import { BrowserQRCodeReader } from "@zxing/browser";

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
      if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader();

      // Prefer back camera
      const devices = await readerRef.current.listVideoInputDevices();
      let deviceId: string | undefined;
      // Try to find a back-facing camera
      const back = devices.find(d => /back|rear|environment/i.test(d.label));
      deviceId = back?.deviceId || devices[0]?.deviceId;
      if (!deviceId) throw new Error("No camera found");

      await readerRef.current.decodeFromVideoDevice(deviceId, videoRef.current!, (result, err) => {
        if (result) {
          handleResult(result);
        } else if (err && !(err instanceof NotFoundException)) {
          console.warn(err);
        }
      });
      setActive(true);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to start camera");
      toast.error(e?.message || "Failed to start camera");
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    try {
      readerRef.current?.reset();
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
          <div className="relative aspect-video bg-black/80 rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-8 border-2 border-primary/60 rounded-lg" />
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