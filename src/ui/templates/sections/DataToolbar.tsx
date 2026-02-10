'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileDown, Plus, Upload } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

type DataToolbarProps = {
  className?: string;
  onDownloadTemplate?: () => Promise<void> | void;
  onDownloadData?: () => Promise<void> | void;
  onUploadCsv?: (file: File) => Promise<void> | void;
  onAddRow?: () => void;
  uploadAccept?: string;
  filters?: React.ReactNode;
  extraActions?: React.ReactNode;
};

export function DataToolbar({
  className,
  onDownloadTemplate,
  onDownloadData,
  onUploadCsv,
  onAddRow,
  uploadAccept = '.csv,text/csv',
  filters,
  extraActions,
}: DataToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState({
    template: false,
    download: false,
    upload: false,
  });

  async function handleTemplateClick() {
    if (!onDownloadTemplate) return;
    setBusy((prev) => ({ ...prev, template: true }));
    try {
      await onDownloadTemplate();
    } catch (error: any) {
      toast.error(error?.message || 'Could not prepare the template.');
    } finally {
      setBusy((prev) => ({ ...prev, template: false }));
    }
  }

  async function handleDownloadData() {
    if (!onDownloadData) return;
    setBusy((prev) => ({ ...prev, download: true }));
    try {
      await onDownloadData();
    } catch (error: any) {
      toast.error(error?.message || 'Could not export the filtered rows.');
    } finally {
      setBusy((prev) => ({ ...prev, download: false }));
    }
  }

  const handleUploadButton = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!onUploadCsv) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy((prev) => ({ ...prev, upload: true }));
    try {
      await onUploadCsv(file);
    } catch (error: any) {
      toast.error(error?.message || 'Could not import that CSV file.');
    } finally {
      setBusy((prev) => ({ ...prev, upload: false }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className={cn('rounded-lg border bg-card/80 p-3 shadow-sm', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {onDownloadTemplate && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleTemplateClick}
            disabled={busy.template}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {busy.template ? 'Preparing…' : 'Download template'}
          </Button>
        )}

        {onDownloadData && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadData}
            disabled={busy.download}
          >
            <Download className="mr-2 h-4 w-4" />
            {busy.download ? 'Exporting…' : 'Download data'}
          </Button>
        )}

        {onUploadCsv && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={uploadAccept}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadButton}
              disabled={busy.upload}
            >
              <Upload className="mr-2 h-4 w-4" />
              {busy.upload ? 'Uploading…' : 'Upload CSV'}
            </Button>
          </>
        )}

        {onAddRow && (
          <Button size="sm" onClick={onAddRow}>
            <Plus className="mr-2 h-4 w-4" />
            New row
          </Button>
        )}

        {extraActions}
      </div>

      {filters ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">{filters}</div>
      ) : null}
    </div>
  );
}

