import { useState, useRef } from "react";
import QRCode from "qrcode";
import { composeQrWithLabel, downloadDataUrl, printImagesAsLabels } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Download, Printer, Copy } from "lucide-react";
import { toast } from "sonner";

interface QRCodeGeneratorProps {
  assetId?: string;
  assetName?: string;
  propertyName?: string;
  onGenerated?: (qrCodeUrl: string) => void;
}

export function QRCodeGenerator({ 
  assetId = "ASSET-001", 
  assetName = "Sample Asset",
  propertyName = "Main Office",
  onGenerated 
}: QRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      // Build a direct link URL for the QR payload (so scanners open the page directly)
      const base = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || 'https://samsproject.in';
      const normalizedBase = (base || '').replace(/\/$/, '');
      const qrLink = `${normalizedBase}/assets/${assetId}`;

      const rawQrDataUrl = await QRCode.toDataURL(qrLink, {
        width: 512,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      });
      
      const composed = await composeQrWithLabel(rawQrDataUrl, {
        assetId,
        topText: '',
        hideBottomText: true
      });

      setQrCodeUrl(composed);
      onGenerated?.(composed);
      toast.success("QR code generated successfully!");
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    downloadDataUrl(qrCodeUrl, `qr-code-${assetId}.png`);
    toast.success("QR code downloaded!");
  };

  const printQRCode = async () => {
    if (!qrCodeUrl) return;
    try {
      await printImagesAsLabels([qrCodeUrl], { widthIn: 4, heightIn: 6 });
      toast.success("Sent to printer");
    } catch (e) {
      console.error(e);
      toast.error("Failed to print");
    }
  };

  const copyQRCode = async () => {
    if (!qrCodeUrl) return;

    try {
      // Convert data URL to blob
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      toast.success("QR code copied to clipboard!");
    } catch (error) {
      console.error("Error copying QR code:", error);
      toast.error("Failed to copy QR code");
    }
  };

  return (
    <Card className="overflow-hidden border-border/60 shadow-lg">
      <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <QrCode className="h-5 w-5 text-primary" />
          QR Code Generator
        </CardTitle>
        <CardDescription>
          Generate a unique QR code for this asset
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Asset Information */}
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset ID</Label>
              <p className="font-mono text-sm font-medium text-foreground">{assetId}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset Name</Label>
              <p className="text-sm font-medium text-foreground">{assetName}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property</Label>
              <p className="text-sm font-medium text-foreground">{propertyName}</p>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        {!qrCodeUrl && (
          <Button 
            onClick={generateQRCode} 
            disabled={isGenerating} 
            className="w-full h-12 text-base gap-2 shadow-md transition-all hover:shadow-lg"
          >
            <QrCode className="h-5 w-5" />
            {isGenerating ? "Generating..." : "Generate QR Code"}
          </Button>
        )}

        {/* QR Code Display */}
        {qrCodeUrl && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-border/50 bg-muted/10 p-8">
              <div className="relative rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <img 
                  src={qrCodeUrl} 
                  alt="Generated QR Code" 
                  className="h-48 w-48 object-contain"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-center w-full">
                <Button onClick={downloadQRCode} variant="outline" className="gap-2 min-w-[100px]">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button onClick={printQRCode} variant="outline" className="gap-2 min-w-[100px]">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button onClick={copyQRCode} variant="outline" className="gap-2 min-w-[100px]">
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button onClick={generateQRCode} variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
                  Regenerate
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}