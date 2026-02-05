"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, FileText, Type, Minus } from "lucide-react";
import type { FormHeaderState } from "../utils/layoutTransform";

type FormEditorHeaderProps = {
  state: FormHeaderState;
  onChange: (state: FormHeaderState) => void;
};

export function FormEditorHeader({ state, onChange }: FormEditorHeaderProps) {
  const update = <K extends keyof FormHeaderState>(
    key: K,
    value: FormHeaderState[K]
  ) => {
    onChange({ ...state, [key]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Header Section
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs">
                  The header appears at the top of every page. Use data field syntax
                  like {"{{title}}"} to insert dynamic values.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo toggle - future feature placeholder */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="showLogo" className="text-sm">
              Show Logo
            </Label>
            <span className="text-[10px] text-muted-foreground">(coming soon)</span>
          </div>
          <Switch
            id="showLogo"
            checked={state.showLogo}
            onCheckedChange={(checked) => update("showLogo", checked)}
            disabled
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Type className="h-3 w-3 text-muted-foreground" />
            <Label htmlFor="title" className="text-sm">
              Document Title
            </Label>
          </div>
          <Input
            id="title"
            value={state.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g., Invoice or {{title}}"
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Use {"{{title}}"} to pull from document data, or type static text
          </p>
        </div>

        {/* Subtitle */}
        <div className="space-y-2">
          <Label htmlFor="subtitle" className="text-sm">
            Subtitle
          </Label>
          <Input
            id="subtitle"
            value={state.subtitle}
            onChange={(e) => update("subtitle", e.target.value)}
            placeholder="e.g., {{subtitle}} or your tagline"
            className="h-8 text-sm"
          />
        </div>

        {/* Divider toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Minus className="h-3 w-3 text-muted-foreground" />
            <Label htmlFor="showDivider" className="text-sm">
              Show Divider Line
            </Label>
          </div>
          <Switch
            id="showDivider"
            checked={state.showDivider}
            onCheckedChange={(checked) => update("showDivider", checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
