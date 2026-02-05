"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, FileText, StickyNote, Scale, Hash } from "lucide-react";
import type { FormFooterState } from "../utils/layoutTransform";

type FormEditorFooterProps = {
  state: FormFooterState;
  onChange: (state: FormFooterState) => void;
};

export function FormEditorFooter({ state, onChange }: FormEditorFooterProps) {
  const update = <K extends keyof FormFooterState>(
    key: K,
    value: FormFooterState[K]
  ) => {
    onChange({ ...state, [key]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Footer Section
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs">
                  The footer appears at the bottom of every page. Add notes, terms,
                  or page numbers.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote className="h-3 w-3 text-muted-foreground" />
              <Label className="text-sm">Notes</Label>
            </div>
            <Switch
              checked={state.showNotes}
              onCheckedChange={(checked) => update("showNotes", checked)}
            />
          </div>
          {state.showNotes && (
            <div className="space-y-2 pl-5">
              <Input
                value={state.notesBinding}
                onChange={(e) => update("notesBinding", e.target.value)}
                placeholder="Data field (e.g., notes)"
                className="h-7 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Or enter static text below:
              </p>
              <Textarea
                value={state.notesText}
                onChange={(e) => update("notesText", e.target.value)}
                placeholder="Static notes text (optional)"
                rows={2}
                className="text-xs"
              />
            </div>
          )}
        </div>

        {/* Terms & Conditions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-3 w-3 text-muted-foreground" />
              <Label className="text-sm">Terms & Conditions</Label>
            </div>
            <Switch
              checked={state.showTerms}
              onCheckedChange={(checked) => update("showTerms", checked)}
            />
          </div>
          {state.showTerms && (
            <div className="pl-5">
              <Textarea
                value={state.termsText}
                onChange={(e) => update("termsText", e.target.value)}
                placeholder="Payment terms, return policy, etc."
                rows={3}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                This text appears in small print at the bottom
              </p>
            </div>
          )}
        </div>

        {/* Page Numbers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <Label className="text-sm">Page Numbers</Label>
            </div>
            <Switch
              checked={state.showPageNumber}
              onCheckedChange={(checked) => update("showPageNumber", checked)}
            />
          </div>
          {state.showPageNumber && (
            <div className="pl-5">
              <Input
                value={state.pageNumberFormat}
                onChange={(e) => update("pageNumberFormat", e.target.value)}
                placeholder="Page {{page}} of {{pages}}"
                className="h-7 text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use {"{{page}}"} for current page, {"{{pages}}"} for total
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
