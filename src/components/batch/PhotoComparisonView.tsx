"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftRight, Layers, X } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

type GalleryImage = {
  id: string;
  url: string;
  badge?: string;
  caption?: string;
  uploadedAt?: string;
};

interface PhotoComparisonViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image1: GalleryImage | null;
  image2: GalleryImage | null;
}

export function PhotoComparisonView({
  open,
  onOpenChange,
  image1,
  image2,
}: PhotoComparisonViewProps) {
  const [compareMode, setCompareMode] = React.useState<"side-by-side" | "slider">("side-by-side");
  const [sliderPosition, setSliderPosition] = React.useState(50);

  // Calculate days between photos
  const daysBetween = React.useMemo(() => {
    if (!image1?.uploadedAt || !image2?.uploadedAt) return null;
    const date1 = parseISO(image1.uploadedAt);
    const date2 = parseISO(image2.uploadedAt);
    return Math.abs(differenceInDays(date1, date2));
  }, [image1?.uploadedAt, image2?.uploadedAt]);

  // Determine which image is earlier
  const [earlierImage, laterImage] = React.useMemo(() => {
    if (!image1 || !image2) return [image1, image2];
    if (!image1.uploadedAt || !image2.uploadedAt) return [image1, image2];

    const date1 = new Date(image1.uploadedAt).getTime();
    const date2 = new Date(image2.uploadedAt).getTime();

    return date1 <= date2 ? [image1, image2] : [image2, image1];
  }, [image1, image2]);

  if (!image1 || !image2) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Photo Comparison
          </DialogTitle>
          <DialogDescription>
            {daysBetween !== null && (
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{daysBetween} days apart</Badge>
                {earlierImage?.uploadedAt && laterImage?.uploadedAt && (
                  <span className="text-sm">
                    {format(parseISO(earlierImage.uploadedAt), "MMM d")} to{" "}
                    {format(parseISO(laterImage.uploadedAt), "MMM d, yyyy")}
                  </span>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={compareMode} onValueChange={(v) => setCompareMode(v as "side-by-side" | "slider")}>
          <TabsList className="grid grid-cols-2 w-fit mx-auto">
            <TabsTrigger value="side-by-side" className="flex items-center gap-1">
              <ArrowLeftRight className="h-4 w-4" />
              Side by Side
            </TabsTrigger>
            <TabsTrigger value="slider" className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              Slider Overlay
            </TabsTrigger>
          </TabsList>

          {/* Side-by-Side View */}
          <TabsContent value="side-by-side" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Earlier Photo */}
              <div className="space-y-2">
                <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={earlierImage?.url}
                    alt="Earlier photo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">
                    {earlierImage?.uploadedAt
                      ? format(parseISO(earlierImage.uploadedAt), "MMMM d, yyyy")
                      : "Photo 1"}
                  </p>
                  {earlierImage?.badge && (
                    <Badge variant="outline" className="mt-1">
                      {earlierImage.badge}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Later Photo */}
              <div className="space-y-2">
                <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={laterImage?.url}
                    alt="Later photo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">
                    {laterImage?.uploadedAt
                      ? format(parseISO(laterImage.uploadedAt), "MMMM d, yyyy")
                      : "Photo 2"}
                  </p>
                  {laterImage?.badge && (
                    <Badge variant="outline" className="mt-1">
                      {laterImage.badge}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Slider Overlay View */}
          <TabsContent value="slider" className="mt-4">
            <div className="space-y-4">
              <div className="relative aspect-video max-h-[60vh] mx-auto rounded-lg overflow-hidden border bg-muted">
                {/* Later (right) image - full width */}
                <img
                  src={laterImage?.url}
                  alt="Later photo"
                  className="absolute inset-0 w-full h-full object-contain"
                />

                {/* Earlier (left) image - clipped */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <img
                    src={earlierImage?.url}
                    alt="Earlier photo"
                    className="absolute top-0 left-0 h-full object-contain"
                    style={{ width: `${100 / (sliderPosition / 100)}%` }}
                  />
                </div>

                {/* Slider line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                  style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <ArrowLeftRight className="h-4 w-4 text-gray-600" />
                  </div>
                </div>

                {/* Date labels */}
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {earlierImage?.uploadedAt
                    ? format(parseISO(earlierImage.uploadedAt), "MMM d, yyyy")
                    : "Earlier"}
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {laterImage?.uploadedAt
                    ? format(parseISO(laterImage.uploadedAt), "MMM d, yyyy")
                    : "Later"}
                </div>
              </div>

              {/* Slider control */}
              <div className="flex items-center gap-4 px-4">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Earlier</span>
                <Slider
                  value={[sliderPosition]}
                  onValueChange={(v) => setSliderPosition(v[0])}
                  min={5}
                  max={95}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">Later</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Growth summary */}
        {daysBetween !== null && daysBetween > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="text-center">
                <span className="text-2xl font-bold text-primary">{daysBetween}</span>
                <p className="text-muted-foreground">days of growth</p>
              </div>
              {daysBetween >= 7 && (
                <div className="text-center">
                  <span className="text-2xl font-bold text-primary">
                    {Math.round(daysBetween / 7)}
                  </span>
                  <p className="text-muted-foreground">weeks</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PhotoComparisonView;
