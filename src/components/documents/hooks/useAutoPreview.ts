"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { DocumentComponent, DocumentType } from "@/lib/documents/types";
import { renderPreviewClient, getSampleDataForType } from "../utils/renderPreviewClient";

type AutoPreviewOptions = {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Whether auto-preview is enabled (default: true) */
  enabled?: boolean;
  /** Document type for sample data selection */
  documentType: DocumentType;
};

type AutoPreviewResult = {
  /** The rendered HTML preview */
  previewHtml: string;
  /** Whether the preview is currently loading/updating */
  isLoading: boolean;
  /** Any error that occurred during preview */
  error: string | null;
  /** Whether auto-preview is enabled */
  isEnabled: boolean;
  /** Toggle auto-preview on/off */
  setEnabled: (enabled: boolean) => void;
  /** Force refresh the preview immediately */
  refresh: () => void;
  /** Time of last successful preview update */
  lastUpdated: Date | null;
};

/**
 * Hook for managing automatic live preview of document templates.
 * Debounces updates to prevent excessive re-renders.
 *
 * Usage:
 * ```ts
 * const { previewHtml, isLoading, isEnabled, setEnabled } = useAutoPreview(layout, {
 *   documentType: 'invoice',
 *   debounceMs: 300,
 * });
 * ```
 */
export function useAutoPreview(
  layout: DocumentComponent[],
  options: AutoPreviewOptions
): AutoPreviewResult {
  const { debounceMs = 300, enabled: initialEnabled = true, documentType } = options;

  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Ref for debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Generate preview
  const generatePreview = useCallback(() => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get sample data for the document type
      const sampleData = getSampleDataForType(documentType);

      // Render preview client-side
      const html = renderPreviewClient(layout, sampleData, {
        title: `${documentType} Preview`,
        documentType,
      });

      if (isMountedRef.current) {
        setPreviewHtml(html);
        setLastUpdated(new Date());
        setIsLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to generate preview");
        setIsLoading(false);
      }
    }
  }, [layout, documentType]);

  // Debounced preview update
  useEffect(() => {
    if (!isEnabled) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set loading state immediately for feedback
    setIsLoading(true);

    // Debounce the actual preview generation
    debounceTimerRef.current = setTimeout(() => {
      generatePreview();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [layout, documentType, isEnabled, debounceMs, generatePreview]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Force refresh (bypasses debounce)
  const refresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    generatePreview();
  }, [generatePreview]);

  return {
    previewHtml,
    isLoading,
    error,
    isEnabled,
    setEnabled: setIsEnabled,
    refresh,
    lastUpdated,
  };
}
