import { useState, useRef } from "react";
import QRCode from "qrcode";
import { composeQrWithLabel } from "@/lib/qr";
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
  const [customText, setCustomText] = useState(`${assetName} - ${propertyName}`);
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
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      const composed = await composeQrWithLabel(rawQrDataUrl, {
        assetId,
        topText: customText || 'Scan to view asset',
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
    
    const link = document.createElement('a');
    link.download = `qr-code-${assetId}.png`;
    link.href = qrCodeUrl;
    link.click();
    toast.success("QR code downloaded!");
  };

  const printQRCode = () => {
    if (!qrCodeUrl) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print QR Code - ${assetName}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px;
                margin: 0;
              }
              .qr-container {
                max-width: 400px;
                margin: 0 auto;
                border: 2px solid #000;
                padding: 20px;
                border-radius: 8px;
              }
              h2 { margin-top: 0; }
              .qr-code { margin: 20px 0; }
              .details { 
                font-size: 14px; 
                margin-top: 10px;
                text-align: left;
              }
              @media print {
                body { margin: 0; padding: 10px; }
                .qr-container { border: 1px solid #000; }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <h2>Asset QR Code</h2>
                <div class="qr-code">
                  <img src="${qrCodeUrl}" alt="QR Code" style="max-width: 100%;" />
                </div>
              <div class="details">
                <strong>Asset:</strong> ${assetName}<br/>
                <strong>Property:</strong> ${propertyName}<br/>
                <strong>Asset ID:</strong> ${assetId}<br/>
                <strong>Generated:</strong> ${new Date().toLocaleDateString()}
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR Code Generator
        </CardTitle>
        <CardDescription>
          Generate printable QR codes for asset identification and tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Text Input */}
        <div className="space-y-2">
          <Label htmlFor="customText">Display Text</Label>
          <Input
            id="customText"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Text to display with QR code"
          />
        </div>

        {/* Asset Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <Label className="text-sm font-medium">Asset ID</Label>
            <p className="text-sm text-muted-foreground">{assetId}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Asset Name</Label>
            <p className="text-sm text-muted-foreground">{assetName}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Property</Label>
            <p className="text-sm text-muted-foreground">{propertyName}</p>
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={generateQRCode} 
          disabled={isGenerating} 
          className="w-full gap-2"
        >
          <QrCode className="h-4 w-4" />
          {isGenerating ? "Generating..." : "Generate QR Code"}
        </Button>

        {/* QR Code Display */}
        {qrCodeUrl && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="border-2 border-border rounded-lg p-4 bg-background">
                <img 
                  src={qrCodeUrl} 
                  alt="Generated QR Code" 
                  className="max-w-full h-auto"
                />
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {customText}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              <Button onClick={downloadQRCode} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button onClick={printQRCode} variant="outline" size="sm" className="gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={copyQRCode} variant="outline" size="sm" className="gap-2">
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}