"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, X, Expand, Grid, LayoutList } from "lucide-react";
import { format, parseISO, startOfWeek, differenceInDays } from "date-fns";

type GalleryImage = {
  id: string;
  attachmentId?: string;
  url: string;
  badge?: string;
  caption?: string;
  isHero: boolean;
  entityType: "batch" | "variety" | "product";
  uploadedAt?: string;
};

interface GrowthTimelineViewProps {
  images: GalleryImage[];
  onCompare?: (image1: GalleryImage, image2: GalleryImage) => void;
}

interface WeekGroup {
  weekStart: Date;
  label: string;
  images: GalleryImage[];
}

export function GrowthTimelineView({ images, onCompare }: GrowthTimelineViewProps) {
  const [selectedImage, setSelectedImage] = React.useState<GalleryImage | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  const [viewMode, setViewMode] = React.useState<"timeline" | "grid">("timeline");
  const [compareMode, setCompareMode] = React.useState(false);
  const [compareSelection, setCompareSelection] = React.useState<GalleryImage[]>([]);

  // Sort images by date (oldest first for timeline)
  const sortedImages = React.useMemo(() => {
    return [...images]
      .filter((img) => img.entityType === "batch") // Only batch photos in timeline
      .sort((a, b) => {
        const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return dateA - dateB;
      });
  }, [images]);

  // Group images by week
  const weekGroups = React.useMemo((): WeekGroup[] => {
    const groups: Map<string, WeekGroup> = new Map();

    sortedImages.forEach((img) => {
      if (!img.uploadedAt) return;

      const date = parseISO(img.uploadedAt);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
      const key = weekStart.toISOString();

      if (!groups.has(key)) {
        groups.set(key, {
          weekStart,
          label: format(weekStart, "MMM d, yyyy"),
          images: [],
        });
      }

      groups.get(key)!.images.push(img);
    });

    return Array.from(groups.values()).sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );
  }, [sortedImages]);

  // Calculate growth stats
  const growthStats = React.useMemo(() => {
    if (sortedImages.length < 2) return null;

    const firstUploadedAt = sortedImages[0].uploadedAt;
    const lastUploadedAt = sortedImages[sortedImages.length - 1].uploadedAt;

    const firstDate = firstUploadedAt ? parseISO(firstUploadedAt) : null;
    const lastDate = lastUploadedAt ? parseISO(lastUploadedAt) : null;

    if (!firstDate || !lastDate) return null;

    return {
      totalPhotos: sortedImages.length,
      totalDays: differenceInDays(lastDate, firstDate),
      totalWeeks: weekGroups.length,
      firstDate: format(firstDate, "MMM d, yyyy"),
      lastDate: format(lastDate, "MMM d, yyyy"),
    };
  }, [sortedImages, weekGroups]);

  const handleImageClick = (img: GalleryImage) => {
    if (compareMode) {
      if (compareSelection.some((s) => s.id === img.id)) {
        setCompareSelection(compareSelection.filter((s) => s.id !== img.id));
      } else if (compareSelection.length < 2) {
        const newSelection = [...compareSelection, img];
        setCompareSelection(newSelection);
        if (newSelection.length === 2 && onCompare) {
          onCompare(newSelection[0], newSelection[1]);
          setCompareMode(false);
          setCompareSelection([]);
        }
      }
    } else {
      const index = sortedImages.findIndex((i) => i.id === img.id);
      setSelectedIndex(index >= 0 ? index : 0);
      setSelectedImage(img);
    }
  };

  const handlePrev = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
      setSelectedImage(sortedImages[selectedIndex - 1]);
    }
  };

  const handleNext = () => {
    if (selectedIndex < sortedImages.length - 1) {
      setSelectedIndex(selectedIndex + 1);
      setSelectedImage(sortedImages[selectedIndex + 1]);
    }
  };

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (!selectedImage) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setSelectedImage(null);
    },
    [selectedImage, selectedIndex, sortedImages]
  );

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (sortedImages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No growth photos yet</p>
        <p className="text-sm mt-1">Take photos to track plant development over time</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {growthStats && (
            <span>
              {growthStats.totalPhotos} photos over {growthStats.totalDays} days
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCompare && (
            <Button
              variant={compareMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setCompareMode(!compareMode);
                setCompareSelection([]);
              }}
            >
              {compareMode ? `Select 2 (${compareSelection.length}/2)` : "Compare"}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode(viewMode === "timeline" ? "grid" : "timeline")}
          >
            {viewMode === "timeline" ? (
              <Grid className="h-4 w-4" />
            ) : (
              <LayoutList className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {compareMode && (
        <div className="p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
          Click two photos to compare them side-by-side
        </div>
      )}

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <div className="space-y-6">
          {weekGroups.map((group) => (
            <div key={group.weekStart.toISOString()} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Week of {group.label}
                <Badge variant="secondary" className="ml-auto">
                  {group.images.length} photo{group.images.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {group.images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleImageClick(img)}
                    className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      compareMode && compareSelection.some((s) => s.id === img.id)
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-transparent hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.caption || "Growth photo"}
                      className="h-24 w-24 object-cover"
                    />
                    {img.isHero && (
                      <div className="absolute top-1 left-1">
                        <Badge variant="default" className="text-[10px] px-1 py-0">
                          Hero
                        </Badge>
                      </div>
                    )}
                    {img.uploadedAt && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 text-center">
                        {format(parseISO(img.uploadedAt), "MMM d")}
                      </div>
                    )}
                    {compareMode && compareSelection.some((s) => s.id === img.id) && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                          {compareSelection.findIndex((s) => s.id === img.id) + 1}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-4 gap-2">
          {sortedImages.map((img) => (
            <button
              key={img.id}
              onClick={() => handleImageClick(img)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                compareMode && compareSelection.some((s) => s.id === img.id)
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-transparent hover:border-primary/50"
              }`}
            >
              <img
                src={img.url}
                alt={img.caption || "Growth photo"}
                className="h-full w-full object-cover"
              />
              {img.isHero && (
                <div className="absolute top-1 left-1">
                  <Badge variant="default" className="text-[10px] px-1 py-0">
                    Hero
                  </Badge>
                </div>
              )}
              {img.uploadedAt && (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 text-center">
                  {format(parseISO(img.uploadedAt), "MMM d")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filmstrip at bottom */}
      {sortedImages.length > 1 && (
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">Growth Timeline</p>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {sortedImages.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => handleImageClick(img)}
                className={`relative flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                  selectedImage?.id === img.id
                    ? "border-primary"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img
                  src={img.url}
                  alt=""
                  className="h-12 w-12 object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full-size Image Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>
                {selectedImage?.uploadedAt
                  ? format(parseISO(selectedImage.uploadedAt), "MMMM d, yyyy")
                  : "Photo"}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {selectedIndex + 1} of {sortedImages.length}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            {selectedImage && (
              <img
                src={selectedImage.url}
                alt={selectedImage.caption || "Growth photo"}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
            )}

            {/* Navigation buttons */}
            {selectedIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                onClick={handlePrev}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
            {selectedIndex < sortedImages.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                onClick={handleNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>

          {/* Photo info */}
          {selectedImage && (
            <div className="p-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                {selectedImage.badge && (
                  <Badge variant="secondary">{selectedImage.badge}</Badge>
                )}
                {selectedImage.isHero && <Badge variant="default">Hero</Badge>}
              </div>
              {selectedImage.caption && (
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedImage.caption}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GrowthTimelineView;
