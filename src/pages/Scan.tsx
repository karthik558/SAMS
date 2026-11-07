import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { toast } from "sonner";
import { 
  QrCode, 
  Camera, 
  Image as ImageIcon, 
  Zap, 
  ZapOff, 
  Layers, 
  Copy, 
  Download, 
  Trash2, 
  ExternalLink,
  Square,
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
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Scan QR" }]} />
      <div className="page-intro">
        <h1 className="heading-xl text-foreground">Scan QR</h1>
        <p className="mt-2 text-muted-foreground">Scan an asset tag or upload a photo of the code.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-1 border-b border-border/60 bg-muted/30 px-6 py-5">
            <CardTitle className="text-lg font-semibold">Scan mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            <Button
              variant={scanMode === "single" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setScanMode("single")}
            >
              Direct lookup
            </Button>
            <Button
              variant={scanMode === "batch" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setScanMode("batch")}
            >
              Batch audit
              {batchItems.length > 0 ? (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary-foreground/15 px-1.5 text-[11px]">
                  {batchItems.length}
                </span>
              ) : null}
            </Button>

            {scanMode === "batch" && batchItems.length > 0 ? (
              <div className="space-y-2 border-t border-border/70 pt-3">
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {batchItems.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{item.id}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="View asset"
                          onClick={() => {
                            stop();
                            navigate(`/assets/${item.id}`);
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Remove"
                          onClick={() => setBatchItems((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={copyBatchIDs}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy IDs
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportBatchCSV}>
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBatchDialogOpen(true)}>
                    Review
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-zinc-950 sm:min-h-[480px]">
            <video
              ref={videoRef}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                active ? "opacity-100" : "opacity-0"
              )}
              playsInline
              muted
              autoPlay
            />

            {!active ? (
              <div className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-primary">
                  <QrCode className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium text-white">Camera is off</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Open the camera when you are ready, or upload an image of the code.
                </p>
                {error ? (
                  <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-xs text-white">
                    {error}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/25 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] sm:h-72 sm:w-72">
                  <div className="absolute -left-px -top-px h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-primary" />
                  <div className="absolute -right-px -top-px h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-primary" />
                  <div className="absolute -bottom-px -left-px h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-primary" />
                  <div className="absolute -bottom-px -right-px h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-primary" />
                  <div className="absolute inset-x-3 top-0 h-0.5 animate-scan-down bg-primary" />
                </div>
                <p className="absolute inset-x-0 bottom-4 text-center">
                  <span className="inline-block rounded-lg border border-white/15 bg-black/55 px-3 py-1.5 text-xs text-white">
                    {scanMode === "batch"
                      ? "Keep scanning. Each new tag is added to the batch."
                      : "Place the code inside the frame."}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 p-4">
            <Button onClick={active ? stop : start} disabled={loading}>
              {active ? <Square className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {loading ? "Starting camera…" : active ? "Stop camera" : "Open camera"}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="h-4 w-4" />
              Upload image
            </Button>
            <Button
              variant={torch ? "secondary" : "outline"}
              onClick={toggleTorch}
              disabled={!active || !hasTorch}
            >
              {torch ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
              {torch ? "Flash on" : "Flash"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { onPickImage(e.target.files?.[0] || undefined); if (e.target) (e.target as HTMLInputElement).value = ""; }}
            />
          </div>
        </Card>
      </div>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-lg">
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
