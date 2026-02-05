"use client";

import { useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { DocumentComponent, DocumentType } from "@/lib/documents/types";
import { FormEditorHeader } from "./components/FormEditorHeader";
import { FormEditorContent } from "./components/FormEditorContent";
import { FormEditorFooter } from "./components/FormEditorFooter";
import {
  FormState,
  FormHeaderState,
  FormContentState,
  FormFooterState,
  layoutToFormState,
  mergeFormStateIntoLayout,
} from "./utils/layoutTransform";

type FormEditorProps = {
  layout: DocumentComponent[];
  documentType: DocumentType;
  onLayoutChange: (layout: DocumentComponent[]) => void;
};

/**
 * FormEditor - Simplified form-based document template editor
 *
 * This provides a non-technical interface for editing document templates
 * through form controls instead of the visual canvas. Changes made here
 * are converted to the underlying DocumentComponent[] layout.
 */
export function FormEditor({ layout, documentType, onLayoutChange }: FormEditorProps) {
  // Convert layout to form state
  const formState = useMemo(() => layoutToFormState(layout, documentType), [layout, documentType]);

  // Update handlers for each section
  const handleHeaderChange = useCallback(
    (header: FormHeaderState) => {
      const newFormState: FormState = { ...formState, header };
      const newLayout = mergeFormStateIntoLayout(newFormState, layout, documentType);
      onLayoutChange(newLayout);
    },
    [formState, layout, documentType, onLayoutChange]
  );

  const handleContentChange = useCallback(
    (content: FormContentState) => {
      const newFormState: FormState = { ...formState, content };
      const newLayout = mergeFormStateIntoLayout(newFormState, layout, documentType);
      onLayoutChange(newLayout);
    },
    [formState, layout, documentType, onLayoutChange]
  );

  const handleFooterChange = useCallback(
    (footer: FormFooterState) => {
      const newFormState: FormState = { ...formState, footer };
      const newLayout = mergeFormStateIntoLayout(newFormState, layout, documentType);
      onLayoutChange(newLayout);
    },
    [formState, layout, documentType, onLayoutChange]
  );

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Info banner */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Simple Editor</strong> - Configure your document using these
              forms. For advanced positioning, switch to Visual mode. Changes are
              automatically synced between modes.
            </AlertDescription>
          </Alert>

          {/* Header Section */}
          <FormEditorHeader state={formState.header} onChange={handleHeaderChange} />

          {/* Content Sections */}
          <FormEditorContent
            state={formState.content}
            documentType={documentType}
            onChange={handleContentChange}
          />

          {/* Footer Section */}
          <FormEditorFooter state={formState.footer} onChange={handleFooterChange} />
        </div>
      </ScrollArea>
    </div>
  );
}
