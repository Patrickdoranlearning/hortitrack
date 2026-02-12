'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, FileSpreadsheet, Loader2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { MatchedExtraction } from '@/lib/ai/match-extraction';

type OrderUploadZoneProps = {
  onExtractionComplete: (result: MatchedExtraction, format: 'pdf' | 'csv') => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

export function OrderUploadZone({ onExtractionComplete, onError, disabled }: OrderUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setFileName(file.name);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/ai/parse-order', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          const msg = result.error?.message ?? 'Failed to parse order file';
          onError(msg);
          return;
        }

        onExtractionComplete(result.data as MatchedExtraction, result.format);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        onError(msg);
      } finally {
        setUploading(false);
      }
    },
    [onExtractionComplete, onError]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled || uploading) return;
      const file = acceptedFiles[0];
      if (file) {
        handleUpload(file);
      }
    },
    [disabled, uploading, handleUpload]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: disabled || uploading,
  });

  // Show rejection message
  const rejectionMessage =
    fileRejections.length > 0
      ? fileRejections[0].errors.map((e) => e.message).join(', ')
      : null;

  if (uploading) {
    return (
      <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div className="text-sm">
            <p className="font-medium text-primary">Extracting order data...</p>
            <p className="text-muted-foreground">{fileName}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-xs">/</span>
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div className="text-sm">
            {isDragActive ? (
              <p className="font-medium text-primary">Drop file here</p>
            ) : (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Upload order confirmation</span>
                {' '}(PDF or CSV) to auto-fill
              </p>
            )}
          </div>
          <Upload className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {rejectionMessage && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{rejectionMessage}</span>
        </div>
      )}
    </div>
  );
}
