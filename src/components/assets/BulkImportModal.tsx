import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileSpreadsheet, Download, Upload, Building2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { downloadAssetTemplate, importAssetsFromFile } from "@/services/bulkImport";
import { listAssets } from "@/services/assets";
import { hasSupabaseEnv } from "@/lib/supabaseClient";

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  propertyCount?: number;
}

export function BulkImportModal({ open, onOpenChange, onSuccess, propertyCount = 0 }: BulkImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [lastImportSummary, setLastImportSummary] = useState<string>("");
  const [isDragActive, setIsDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const progressResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (progressResetRef.current != null) {
        window.clearTimeout(progressResetRef.current);
      }
    };
  }, []);

  const handleImportFile = async (file: File) => {
    if (!file) return;
    if (progressResetRef.current != null) {
      window.clearTimeout(progressResetRef.current);
      progressResetRef.current = null;
    }
    setImportErrors([]);
    setLastImportSummary("");
    setImportProgress(15);
    setImporting(true);
    try {
      const res = await importAssetsFromFile(file);
      setImportProgress(70);
      const summary = `Inserted: ${res.inserted}, Skipped: ${res.skipped}${res.errors.length ? `, Errors: ${res.errors.length}` : ''}`;
      setLastImportSummary(summary);
      setImportErrors(res.errors ?? []);
      if (res.errors.length) {
        toast.info(`Imported ${res.inserted} asset${res.inserted === 1 ? '' : 's'}. ${res.errors.length} row${res.errors.length === 1 ? '' : 's'} need review.`);
      } else {
        toast.success(`Imported ${res.inserted} asset${res.inserted === 1 ? '' : 's'}`);
      }
      
      if (onSuccess) {
        onSuccess();
      }

      setImportProgress(90);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error(message);
      setImportErrors([]);
      setLastImportSummary("");
    } finally {
      setImportProgress(100);
      if (progressResetRef.current != null) {
        window.clearTimeout(progressResetRef.current);
      }
      progressResetRef.current = window.setTimeout(() => {
        setImportProgress(0);
        progressResetRef.current = null;
      }, 600);
      setImporting(false);
      setIsDragActive(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const copyErrorsToClipboard = async () => {
    if (!importErrors.length) return;
    const payload = importErrors.map((err) => `Row ${err.row}: ${err.message}`).join('\n');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = payload;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Error details copied to clipboard');
    } catch {
      toast.error('Unable to copy error details');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (importing) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isDragActive) setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (importing) return;
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleImportFile(file);
    }
  };

  const handleDropZoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (importing) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileRef.current?.click();
    }
  };

  const propertyLabel = propertyCount === 1 ? 'property' : 'properties';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden border-0 bg-background p-0 shadow-2xl md:rounded-2xl">
        <div className="relative flex flex-col">
          {/* Header Section with Gradient */}
          <div className="relative overflow-hidden bg-muted/30 px-6 pb-6 pt-8 text-center border-b border-border/50">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight">Bulk Import Assets</DialogTitle>
                <DialogDescription className="mx-auto max-w-xs text-muted-foreground">
                  Upload your asset inventory in bulk using our standardized Excel template.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 px-6 py-6">
            {/* Step 1: Template */}
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Need the template?</p>
                    <p className="text-xs text-muted-foreground">Start with a fresh Excel file</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadAssetTemplate()}
                  className="h-9 gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </div>

            {/* Step 2: Upload Dropzone */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Upload File</label>
                <span className="text-xs text-muted-foreground">.xlsx or .xls up to 10MB</span>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!importing) fileRef.current?.click();
                }}
                onKeyDown={handleDropZoneKeyDown}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  importing
                    ? "cursor-not-allowed border-muted bg-muted/30 opacity-70"
                    : isDragActive
                      ? "border-primary bg-primary/5 scale-[0.99]"
                      : "border-border/60 bg-muted/10 hover:border-primary/50 hover:bg-muted/20 cursor-pointer"
                )}
              >
                <div className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full shadow-sm transition-transform duration-200 group-hover:scale-110",
                  isDragActive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground ring-1 ring-border"
                )}>
                  <Upload className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {isDragActive ? "Drop file to upload" : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Excel files only
                  </p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file || importing) return;
                  void handleImportFile(file);
                }}
              />
            </div>

            {/* Info / Status */}
            {(importing || importProgress > 0) ? (
               /* Progress UI */
               <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                     <span className="font-medium text-foreground">{importing ? "Processing..." : "Completed"}</span>
                     <span className="text-muted-foreground">{Math.min(importProgress, 100)}%</span>
                  </div>
                  <Progress value={Math.min(importProgress, 100)} className="h-2 w-full bg-muted" />
               </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                 <Building2 className="h-4 w-4 text-muted-foreground" />
                 <div className="flex-1 text-xs text-muted-foreground">
                    Importing to <span className="font-medium text-foreground">{propertyCount.toLocaleString()} {propertyLabel}</span>
                 </div>
              </div>
            )}

            {/* Errors */}
            {importErrors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                 <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">Import Errors:</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void copyErrorsToClipboard()}
                      className="h-6 gap-1 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                 </div>
                 <ul className="list-inside list-disc space-y-1">
                    {importErrors.map((err, i) => (
                      <li key={i}>Row {err.row}: {err.message}</li>
                    ))}
                 </ul>
              </div>
            )}

            {lastImportSummary && (
              <div className="rounded-lg border border-emerald-400/40 bg-emerald-100/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
                Last import: {lastImportSummary}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
