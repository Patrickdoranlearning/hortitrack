import { useState, useCallback, RefObject } from "react";
import type { Position } from "@/lib/documents/types";

type UseCanvasDragOptions = {
  canvasRef: RefObject<HTMLDivElement>;
  scale: number;
  gridSize: number;
  snapToGrid: boolean;
  pageWidth: number;  // mm
  pageHeight: number; // mm
  onMove: (id: string, position: Position) => void;
};

export function useCanvasDrag(opts: UseCanvasDragOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const startDrag = useCallback(
    (e: React.MouseEvent, elementId: string, currentPos: Position) => {
      if (!opts.canvasRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = opts.canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / opts.scale;
      const mouseY = (e.clientY - rect.top) / opts.scale;

      setDraggingId(elementId);
      setDragOffset({
        x: mouseX - currentPos.x,
        y: mouseY - currentPos.y,
      });
    },
    [opts.canvasRef, opts.scale]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId || !opts.canvasRef.current) return;

      const rect = opts.canvasRef.current.getBoundingClientRect();
      let newX = (e.clientX - rect.left) / opts.scale - dragOffset.x;
      let newY = (e.clientY - rect.top) / opts.scale - dragOffset.y;

      // Snap to grid
      if (opts.snapToGrid && opts.gridSize > 0) {
        newX = Math.round(newX / opts.gridSize) * opts.gridSize;
        newY = Math.round(newY / opts.gridSize) * opts.gridSize;
      }

      // Clamp to page bounds (allow some margin for element width)
      newX = Math.max(0, Math.min(newX, opts.pageWidth - 10));
      newY = Math.max(0, Math.min(newY, opts.pageHeight - 5));

      opts.onMove(draggingId, { x: newX, y: newY });
    },
    [draggingId, dragOffset, opts]
  );

  const endDrag = useCallback(() => {
    setDraggingId(null);
  }, []);

  return {
    startDrag,
    handleMouseMove,
    endDrag,
    isDragging: !!draggingId,
    draggingId,
  };
}
