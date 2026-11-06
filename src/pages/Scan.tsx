import { isDemoMode } from "@/lib/demo";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  QrCode, 
  Camera, 
  Image as ImageIcon, 
  RotateCcw, 
  ArrowLeft, 
  X, 
  Zap, 
  ZapOff, 
  Layers, 
  Copy, 
  Download, 
  Trash2, 
  ExternalLink, 
  CheckCircle2 
} from "lucide-react";
import { BrowserMultiFormatReader, BrowserQRCodeReader } from "@zxing/browser";
import type { Result } from "@zxing/library";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";

type BatchItem = {
  id: string;
  raw: string;
  timestamp: Date;
};

export default function Scan() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Batch scan mode state
  const [scanMode, setScanMode] = useState<"single" | "batch">("single");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const lastScannedRef = useRef<{ code: string; time: number } | null>(null);

  useEffect(() => {
    // Only cleanup on unmount - do NOT auto-start camera on mount to prevent desktop camera popups
    return () => stop();
  }, []);

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 clear chime
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

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
      try {
        const track = stream.getVideoTracks()[0];
        if (track.getCapabilities) {
          const capabilities = track.getCapabilities() as any;
          setHasTorch(!!capabilities.torch);
        } else {
          // Fallback: assume it might work if we can't check
          setHasTorch(true);
        }
      } catch (e) {
        console.warn("Torch capability check failed", e);
        setHasTorch(true); // Allow trying anyway
      }

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
      // Check if track is active
      if (track.readyState === 'ended') {
        toast.error("Camera stream ended");
        return;
      }

      // Try to apply the constraint
      await track.applyConstraints({
        advanced: [{ torch: !torch }] as any
      });
      setTorch(!torch);
    } catch (e: any) {
      console.error("Torch failed", e);
      if (e.name === 'OverconstrainedError') {
        toast.error("Flashlight not supported by this camera");
      } else if (e.name === 'NotAllowedError') {
        toast.error("Flashlight permission denied");
      } else {
        toast.error("Could not toggle flashlight");
      }
    }
  };

  const handleResult = (result: Result) => {
    const text = result.getText().trim();
    if (!text) return;

    // Debounce duplicate scans within 2 seconds
    const now = Date.now();
    if (lastScannedRef.current && lastScannedRef.current.code === text && now - lastScannedRef.current.time < 2000) {
      return;
    }
    lastScannedRef.current = { code: text, time: now };

    // Extract asset ID
    let assetId = text;
    const urlMatch = text.match(/\/assets\/([A-Za-z0-9_-]+)/i);
    if (urlMatch && urlMatch[1]) {
      assetId = urlMatch[1];
    } else if (/^AST-?[0-9]+/i.test(text)) {
      assetId = text;
    }

    if (scanMode === "batch") {
      playBeep();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(80); } catch {}
      }

      setBatchItems((prev) => {
        const alreadyExists = prev.some((item) => item.id === assetId);
        if (alreadyExists) {
          toast.info(`Already in batch: ${assetId}`, { duration: 1500 });
          return prev;
        }
        toast.success(`Scanned #${prev.length + 1}: ${assetId}`, { duration: 1500 });
        return [{ id: assetId, raw: text, timestamp: new Date() }, ...prev];
      });
      return;
    }

    // Single mode: Stop camera and navigate
    stop();
    try {
      if (urlMatch && urlMatch[1]) {
        toast.success(`Asset detected: ${urlMatch[1]}`);
        navigate(`/assets/${urlMatch[1]}`);
        return;
      }

      if (/^\//.test(text)) {
        navigate(text);
        return;
      }

      if (/^AST-?[0-9]+/i.test(text)) {
        toast.success(`Asset detected: ${text}`);
        navigate(`/assets/${text}`);
        return;
      }

      if (/^https?:\/\//i.test(text)) {
        try {
          const parsed = new URL(text);
          if (parsed.origin === window.location.origin) {
            navigate(parsed.pathname + parsed.search + parsed.hash);
            return;
          }
        } catch {}
        window.location.assign(text);
        return;
      }

      toast.success("Code Scanned");
      setTimeout(() => {
        if (confirm(`Scanned: ${text}\n\nCopy to clipboard?`)) {
          navigator.clipboard.writeText(text);
        }
        start();
      }, 100);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBack = () => {
    stop();
    navigate(-1);
  };

  const exportBatchCSV = () => {
    if (batchItems.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Asset ID,Scanned At,Raw Code"].concat(
          batchItems.map(item => `"${item.id}","${item.timestamp.toISOString()}","${item.raw.replace(/"/g, '""')}"`)
        ).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sams-batch-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${batchItems.length} items to CSV`);
  };

  const copyBatchIDs = async () => {
    if (batchItems.length === 0) return;
    const text = batchItems.map(i => i.id).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${batchItems.length} asset IDs to clipboard`);
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
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white select-none">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/85 via-black/50 to-transparent">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack}
          className="h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-md border border-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Mode Selector Pill */}
        <div className="flex items-center rounded-full bg-white/10 p-1 border border-white/15 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setScanMode("single")}
            className={cn(
              "rounded-full px-3.5 py-1 text-xs font-medium transition-all",
              scanMode === "single" 
                ? "bg-white text-black shadow-xs font-semibold" 
                : "text-white/70 hover:text-white"
            )}
          >
            Direct Look Up
          </button>
          <button
            type="button"
            onClick={() => setScanMode("batch")}
            className={cn(
              "rounded-full px-3.5 py-1 text-xs font-medium transition-all flex items-center gap-1.5",
              scanMode === "batch" 
                ? "bg-white text-black shadow-xs font-semibold" 
                : "text-white/70 hover:text-white"
            )}
          >
            <span>Batch Audit</span>
            {batchItems.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {batchItems.length}
              </span>
            )}
          </button>
        </div>

        <div className="w-10" /> {/* Spacer for balance */}
      </div>

      {/* Main Camera / Ready Viewport */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-zinc-950">
        {!active ? (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-sm mx-auto z-10 animate-in fade-in duration-300">
            <div className="relative">
              <div className="h-24 w-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-md">
                <QrCode className="h-12 w-12 text-primary" />
              </div>
              <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md">
                <Camera className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">QR Code Scanner</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {scanMode === "batch"
                  ? "Scan multiple equipment tags sequentially for physical audits and inventory reconciliation."
                  : "Scan any asset barcode or QR tag to instantly look up specifications and open records."}
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground max-w-xs">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 w-full pt-2">
              <Button 
                onClick={start} 
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg gap-2 text-sm"
              >
                <Camera className="h-4 w-4" />
                {loading ? "Initializing Camera..." : "Open Camera"}
              </Button>
              <Button 
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="w-full h-11 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur-md gap-2 text-xs font-medium"
              >
                <ImageIcon className="h-4 w-4" />
                Upload from Gallery / Files
              </Button>
            </div>
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
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/50">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] rounded-3xl border-2 border-white/20">
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -mt-1 -ml-1" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl -mt-1 -mr-1" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -mb-1 -ml-1" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl -mb-1 -mr-1" />
                  
                  {/* Scanning laser animation */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_15px_rgba(var(--primary),0.8)] animate-scan-down opacity-75" />
                </div>
              </div>
              
              <div className="absolute bottom-72 left-0 right-0 text-center">
                <p className="text-xs font-medium text-white/90 bg-black/60 backdrop-blur-md inline-block px-4 py-2 rounded-full border border-white/10 shadow-lg">
                  {scanMode === "batch" 
                    ? "Continuous scanning active • Tags will be logged" 
                    : "Align QR code within the frame to inspect"}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Batch Tray Trigger */}
      {batchItems.length > 0 && (
        <div className="absolute bottom-36 left-0 right-0 z-30 flex justify-center pointer-events-auto px-4">
          <Button
            onClick={() => setBatchDialogOpen(true)}
            className="rounded-full bg-white text-black hover:bg-white/95 shadow-2xl px-5 h-10 gap-2.5 border border-black/10 font-semibold text-xs"
          >
            <Layers className="h-4 w-4 text-primary" />
            <span>{batchItems.length} Scanned in Batch</span>
            <span className="text-[11px] text-zinc-500 font-normal border-l border-zinc-200 pl-2">Review & Export</span>
          </Button>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 via-black/70 to-transparent pb-16 pt-10 px-6">
        <div className="flex items-center justify-center gap-8 max-w-md mx-auto">
          {/* Gallery Button */}
          <div className="flex flex-col items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/40 backdrop-blur-md transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">File</span>
          </div>

          {/* Shutter / Stop / Start Button */}
          <div className="relative -mt-3">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <Button
              size="icon"
              className={cn(
                "h-16 w-16 rounded-full border-4 border-white/20 text-black hover:scale-105 transition-all shadow-2xl",
                active ? "bg-white text-black" : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              onClick={active ? stop : start}
              title={active ? "Stop Camera" : "Start Camera"}
            >
              {active ? (
                <div className="h-6 w-6 rounded-sm bg-black" />
              ) : (
                <Camera className="h-7 w-7" />
              )}
            </Button>
          </div>

          {/* Flashlight Button */}
          <div className="flex flex-col items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/40 backdrop-blur-md transition-all",
                torch && "bg-amber-500/20 border-amber-500/50 text-amber-400"
              )}
              onClick={toggleTorch}
              disabled={!active}
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

      {/* Batch Review Modal */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-border/60 bg-card text-card-foreground shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Layers className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">Batch Audit List</DialogTitle>
            </div>
            <DialogDescription>
              {batchItems.length} asset{batchItems.length === 1 ? '' : 's'} recorded during this continuous scan session.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 overflow-y-auto space-y-2 py-2 pr-1">
            {batchItems.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-semibold">
                    {batchItems.length - idx}
                  </span>
                  <span className="font-mono font-semibold text-foreground">{item.id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground mr-1">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setBatchDialogOpen(false);
                      stop();
                      navigate(`/assets/${item.id}`);
                    }}
                    title="View Asset"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => setBatchItems(prev => prev.filter((_, i) => i !== idx))}
                    title="Remove from Batch"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={copyBatchIDs}
              className="gap-1.5 rounded-lg text-xs font-medium"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy IDs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportBatchCSV}
              className="gap-1.5 rounded-lg text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Clear all scanned assets from batch?")) {
                  setBatchItems([]);
                  setBatchDialogOpen(false);
                }
              }}
              className="rounded-lg text-xs font-medium"
            >
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
