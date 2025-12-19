import { isDemoMode } from "@/lib/demo";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { QrCode, Camera, Image as ImageIcon, RotateCcw, ArrowLeft, X, Zap, ZapOff } from "lucide-react";
import { BrowserMultiFormatReader, BrowserQRCodeReader } from "@zxing/browser";
import type { Result } from "@zxing/library";
import { cn } from "@/lib/utils";

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Auto-start on mount for better UX
    start();
    return () => stop();
  }, []);

  const start = async () => {
    setError("");
    setLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not available");
      }

      const isSecure = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
      if (!isSecure) {
        toast.info("Camera requires HTTPS");
      }

      if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: 'environment' } } 
      });
      
      streamRef.current = stream;
      
      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      setHasTorch(!!capabilities.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve(true);
          }
        });
        
        readerRef.current.decodeFromStream(
          stream,
          videoRef.current,
          (result, err) => {
            if (result) handleResult(result);
          }
        );
      }
      
      setActive(true);
    } catch (e: any) {
      console.error(e);
      const msg = e?.name === 'NotAllowedError'
        ? 'Camera permission denied'
        : (e?.name === 'NotFoundError' ? 'No camera found' : 'Failed to start camera');
      setError(msg);
      // toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const stop = () => {
    try {
      // Stop scanning
      // readerRef.current?.reset(); // This sometimes causes issues with zxing/browser, better to just stop tracks
    } catch {}
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
    setTorch(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torch }] as any
      });
      setTorch(!torch);
    } catch (e) {
      console.error("Torch failed", e);
      toast.error("Flashlight not available");
    }
  };

  const handleResult = (result: Result) => {
    const text = result.getText();
    if (!text) return;
    
    // Play a beep sound if possible (optional)
    
    stop();
    try {
      if (/^https?:\/\//i.test(text)) {
        window.location.assign(text);
      } else if (/^\//.test(text)) {
        window.location.assign(text);
      } else {
        const idMatch = text.match(/[A-Z]{2,}[A-Z0-9\-]*\d{3,}$/);
        if (idMatch) {
          window.location.assign(`/assets/${idMatch[0]}`);
        } else {
          toast.success("Code Scanned");
          // Show result dialog or toast with action
          setTimeout(() => {
             if (confirm(`Scanned: ${text}\n\nCopy to clipboard?`)) {
               navigator.clipboard.writeText(text);
             }
             // Restart scanning if they didn't navigate
             start();
          }, 100);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBack = () => {
    stop();
    if (window.history.length > 1) {
      window.history.back();
    } else {
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
        toast.error("No QR code found in image");
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      toast.error("Failed to read image");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack}
          className="h-10 w-10 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md border border-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold tracking-wide uppercase text-white/90">Scan QR Code</h1>
        </div>
        <div className="w-10" /> {/* Spacer for balance */}
      </div>

      {/* Main Camera Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-zinc-900">
        {!active && !loading && error ? (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-xs mx-auto">
            <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
              <Camera className="h-8 w-8 text-zinc-500" />
            </div>
            <h3 className="text-lg font-medium text-white">Camera Access Required</h3>
            <p className="text-sm text-zinc-400">{error}</p>
            <Button onClick={start} className="mt-4 rounded-full px-8">
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                active ? "opacity-100" : "opacity-0"
              )}
              playsInline 
              muted 
              autoPlay
            />
            
            {/* Scanning Overlay */}
            {active && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Darkened background with cutout */}
                <div className="absolute inset-0 bg-black/50">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] rounded-3xl border-2 border-white/20">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -mt-1 -ml-1" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl -mt-1 -mr-1" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -mb-1 -ml-1" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl -mb-1 -mr-1" />
                    
                    {/* Scanning laser animation */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_15px_rgba(var(--primary),0.8)] animate-scan-down opacity-60" />
                  </div>
                </div>
                
                <div className="absolute bottom-80 left-0 right-0 text-center">
                  <p className="text-sm font-medium text-white/80 bg-black/40 backdrop-blur-sm inline-block px-4 py-2 rounded-full">
                    Align QR code within the frame
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-40 pt-12 px-6">
        <div className="flex items-center justify-center gap-8 max-w-md mx-auto">
          {/* Gallery Button */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/40 backdrop-blur-md transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Gallery</span>
          </div>

          {/* Shutter/Action Button (Visual only or Restart) */}
          <div className="relative -mt-4">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <Button
              size="icon"
              className={cn(
                "h-20 w-20 rounded-full border-4 border-white/10 bg-white text-black hover:bg-white/90 hover:scale-105 transition-all shadow-2xl",
                active ? "bg-white" : "bg-zinc-200"
              )}
              onClick={active ? stop : start}
            >
              {active ? (
                <div className="h-8 w-8 rounded-sm bg-black" />
              ) : (
                <Camera className="h-8 w-8 text-black" />
              )}
            </Button>
          </div>

          {/* Flashlight Button */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/40 backdrop-blur-md transition-all",
                torch && "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
              )}
              onClick={toggleTorch}
              disabled={!active || !hasTorch}
            >
              {torch ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </Button>
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Flash</span>
          </div>
        </div>
        
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { onPickImage(e.target.files?.[0] || undefined); if (e.target) (e.target as HTMLInputElement).value = ""; }}
        />
      </div>
    </div>
  );
}
