"use client";

import { useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useCanvasDrag } from "./hooks/useCanvasDrag";
import type {
  DocumentComponent,
  DocumentLayout,
  DocumentZone,
  Position,
  ZoneConfig,
} from "@/lib/documents/types";

// Scale: pixels per mm for canvas display
const SCALE = 2.5;

// A4 page size in mm
const A4 = { width: 210, height: 297 };

// Default zones configuration
const DEFAULT_ZONES: ZoneConfig[] = [
  { zone: "header", height: 35, layoutMode: "absolute" },
  { zone: "body", height: 227, layoutMode: "flow" },
  { zone: "footer", height: 20, layoutMode: "absolute" },
];

// Default margins in mm
const DEFAULT_MARGINS = { top: 15, right: 15, bottom: 15, left: 15 };

type Props = {
  layout: DocumentLayout | DocumentComponent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: Position) => void;
  onDrop?: (type: string, position: Position) => void;
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
};

function getDefaultPosition(
  component: DocumentComponent,
  index: number,
  zones: ZoneConfig[],
  margins: { top: number; left: number }
): Position {
  if (component.style?.position) {
    return component.style.position;
  }

  const zone = component.zone || "body";
  const headerHeight = zones.find((z) => z.zone === "header")?.height ?? 35;

  let baseY = margins.top;
  if (zone === "body") {
    baseY = headerHeight + 5;
  } else if (zone === "footer") {
    const footerZone = zones.find((z) => z.zone === "footer");
    baseY = A4.height - (footerZone?.height ?? 20) - margins.top + 5;
  }

  const yOffset = index * 15;

  return {
    x: margins.left,
    y: baseY + yOffset,
    width: A4.width - margins.left - margins.left,
    height: component.type === "table" ? 40 : 12,
  };
}

// Render a component visually (WYSIWYG style)
function VisualComponent({
  component,
  isSelected,
  zoom,
  onMouseDown,
  onClick,
}: {
  component: DocumentComponent;
  isSelected: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const baseStyles: React.CSSProperties = {
    fontSize: `${(component.style?.fontSize ?? 12) * zoom}px`,
    fontWeight: component.style?.bold ? 700 : 400,
    fontStyle: component.style?.italic ? "italic" : "normal",
    color: component.style?.color ?? "#0f172a",
    textAlign: component.style?.align ?? "left",
    fontFamily: "Inter, ui-sans-serif, -apple-system, sans-serif",
  };

  const renderContent = () => {
    switch (component.type) {
      case "heading": {
        const fontSize = component.style?.fontSize ?? (component.level === 1 ? 24 : component.level === 3 ? 16 : 20);
        return (
          <div
            style={{
              ...baseStyles,
              fontSize: `${fontSize * zoom}px`,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {component.text || "Heading"}
          </div>
        );
      }

      case "text":
        return (
          <div style={{ ...baseStyles, lineHeight: 1.5 }}>
            {component.text || "Text content"}
          </div>
        );

      case "list": {
        const items = component.items ?? [];
        return (
          <div style={baseStyles}>
            {items.length === 0 ? (
              <div className="text-muted-foreground italic">Empty list</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: `${16 * zoom}px`, listStyleType: "disc" }}>
                {items.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: `${4 * zoom}px` }}>
                    <span className="font-medium">{item.label || "Label"}</span>
                    {item.binding && (
                      <span className="text-muted-foreground ml-1">
                        : {`{{${item.binding}}}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }

      case "table": {
        const cols = component.columns ?? [];
        return (
          <div style={{ ...baseStyles, width: "100%" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: `${11 * zoom}px`,
              }}
            >
              {component.showHeader !== false && (
                <thead>
                  <tr>
                    {cols.map((col) => (
                      <th
                        key={col.key}
                        style={{
                          textAlign: col.align ?? "left",
                          padding: `${4 * zoom}px ${8 * zoom}px`,
                          borderBottom: "2px solid #e2e8f0",
                          fontSize: `${10 * zoom}px`,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "#64748b",
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {/* Sample rows for preview */}
                {[1, 2, 3].map((row) => (
                  <tr key={row}>
                    {cols.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          textAlign: col.align ?? "left",
                          padding: `${6 * zoom}px ${8 * zoom}px`,
                          borderBottom: "1px solid #f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {col.binding ? `{{${col.binding}}}` : `Row ${row}`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              style={{
                fontSize: `${9 * zoom}px`,
                color: "#94a3b8",
                marginTop: `${4 * zoom}px`,
              }}
            >
              Data from: {component.rowsBinding || "lines"}
            </div>
          </div>
        );
      }

      case "divider":
        return (
          <hr
            style={{
              border: "none",
              borderTop: "1px solid #e2e8f0",
              margin: `${8 * zoom}px 0`,
              width: "100%",
            }}
          />
        );

      case "spacer":
        return (
          <div
            style={{
              height: `${(component.size ?? 12) * zoom}px`,
              background: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(148, 163, 184, 0.1) 5px, rgba(148, 163, 184, 0.1) 10px)",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: `${9 * zoom}px`, color: "#94a3b8" }}>
              {component.size ?? 12}px spacer
            </span>
          </div>
        );

      case "box": {
        const children = component.children ?? [];
        return (
          <div
            style={{
              border: `${1 * zoom}px solid ${component.style?.border?.color ?? "#e2e8f0"}`,
              borderRadius: `${8 * zoom}px`,
              padding: `${12 * zoom}px`,
              background: component.style?.background ?? "white",
            }}
          >
            {children.length === 0 ? (
              <div
                style={{
                  fontSize: `${11 * zoom}px`,
                  color: "#94a3b8",
                  fontStyle: "italic",
                }}
              >
                Empty box - add content
              </div>
            ) : (
              children.map((child, idx) => (
                <div key={child.id || idx} style={{ marginBottom: idx < children.length - 1 ? `${8 * zoom}px` : 0 }}>
                  <VisualComponent
                    component={child}
                    isSelected={false}
                    zoom={zoom}
                    onMouseDown={() => {}}
                    onClick={() => {}}
                  />
                </div>
              ))
            )}
          </div>
        );
      }

      case "chips": {
        const items = component.items ?? [];
        return (
          <div style={{ ...baseStyles, display: "flex", flexWrap: "wrap", gap: `${6 * zoom}px` }}>
            {items.length === 0 ? (
              <span className="text-muted-foreground italic">No chips</span>
            ) : (
              items.map((chip, idx) => (
                <span
                  key={idx}
                  style={{
                    display: "inline-block",
                    padding: `${4 * zoom}px ${10 * zoom}px`,
                    borderRadius: `${12 * zoom}px`,
                    background: chip.color ?? "#e2e8f0",
                    fontSize: `${11 * zoom}px`,
                  }}
                >
                  {chip.label}
                </span>
              ))
            )}
          </div>
        );
      }

      case "image":
        return (
          <div
            style={{
              width: component.width ? `${component.width * zoom}px` : "100%",
              height: component.height ? `${component.height * zoom}px` : `${60 * zoom}px`,
              background: "#f1f5f9",
              borderRadius: `${8 * zoom}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: `${11 * zoom}px`,
            }}
          >
            {component.url ? (
              <img
                src={component.url}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : (
              "Image placeholder"
            )}
          </div>
        );

      default:
        return (
          <div style={baseStyles}>
            {component.text || `${component.type} component`}
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        "cursor-move transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        background: "white",
        borderRadius: isSelected ? "4px" : undefined,
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {renderContent()}
    </div>
  );
}

export function DocumentCanvas({
  layout,
  selectedId,
  onSelect,
  onMove,
  onDrop,
  zoom,
  showGrid,
  snapToGrid,
  gridSize,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragOverZone, setDragOverZone] = useState<DocumentZone | null>(null);

  // Normalize layout
  const isNewFormat = !Array.isArray(layout) && "pageSize" in layout;
  const pageSize = isNewFormat ? layout.pageSize : A4;
  const margins = isNewFormat ? layout.margins : DEFAULT_MARGINS;
  const zones = isNewFormat ? layout.zones : DEFAULT_ZONES;
  const components = isNewFormat ? layout.components : layout;

  const { startDrag, handleMouseMove, endDrag, isDragging } = useCanvasDrag({
    canvasRef,
    scale: SCALE * zoom,
    gridSize,
    snapToGrid,
    pageWidth: pageSize.width,
    pageHeight: pageSize.height,
    onMove,
  });

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("canvas-zone")) {
        onSelect(null);
      }
    },
    [onSelect]
  );

  // Handle drag over for dropping new components
  const handleDragOver = useCallback((e: React.DragEvent, zone: DocumentZone) => {
    e.preventDefault();
    setDragOverZone(zone);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverZone(null);
  }, []);

  const handleDropOnZone = useCallback(
    (e: React.DragEvent, zone: DocumentZone) => {
      e.preventDefault();
      setDragOverZone(null);

      const componentType = e.dataTransfer.getData("componentType");
      if (!componentType || !onDrop) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / (SCALE * zoom);
      const y = (e.clientY - rect.top) / (SCALE * zoom);

      // Snap to grid if enabled
      const snappedX = snapToGrid ? Math.round(x / gridSize) * gridSize : x;
      const snappedY = snapToGrid ? Math.round(y / gridSize) * gridSize : y;

      onDrop(componentType, { x: snappedX, y: snappedY, width: pageSize.width - margins.left * 2 });
    },
    [onDrop, zoom, snapToGrid, gridSize, pageSize.width, margins.left]
  );

  // Calculate zone boundaries
  const headerZone = zones.find((z) => z.zone === "header");
  const footerZone = zones.find((z) => z.zone === "footer");
  const headerHeight = headerZone?.height ?? 35;
  const footerHeight = footerZone?.height ?? 20;
  const bodyTop = headerHeight;
  const bodyHeight = pageSize.height - headerHeight - footerHeight;

  // Group components by zone for rendering
  const headerComponents = components.filter((c) => c.zone === "header");
  const bodyComponents = components.filter((c) => c.zone === "body" || !c.zone);
  const footerComponents = components.filter((c) => c.zone === "footer");

  const renderZoneComponents = (zoneComponents: DocumentComponent[], zoneType: DocumentZone) => {
    return zoneComponents.map((component, index) => {
      const pos = getDefaultPosition(component, index, zones, margins);
      const isSelected = selectedId === component.id;

      return (
        <div
          key={component.id}
          className="absolute"
          style={{
            left: `${pos.x * SCALE * zoom}px`,
            top: `${pos.y * SCALE * zoom}px`,
            width: pos.width ? `${pos.width * SCALE * zoom}px` : "auto",
            minHeight: `${(pos.height ?? 12) * SCALE * zoom}px`,
          }}
        >
          <VisualComponent
            component={component}
            isSelected={isSelected}
            zoom={zoom}
            onMouseDown={(e) => startDrag(e, component.id, pos)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(component.id);
            }}
          />
        </div>
      );
    });
  };

  return (
    <div className="h-full overflow-auto bg-muted/30 p-6 flex items-start justify-center">
      <div
        ref={canvasRef}
        className={cn(
          "bg-white shadow-2xl relative",
          isDragging && "cursor-grabbing"
        )}
        style={{
          width: `${pageSize.width * SCALE * zoom}px`,
          height: `${pageSize.height * SCALE * zoom}px`,
          minWidth: `${pageSize.width * SCALE * zoom}px`,
          minHeight: `${pageSize.height * SCALE * zoom}px`,
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClick={handleCanvasClick}
      >
        {/* Grid overlay */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
              `,
              backgroundSize: `${gridSize * SCALE * zoom}px ${gridSize * SCALE * zoom}px`,
            }}
          />
        )}

        {/* Header Zone */}
        <div
          className={cn(
            "canvas-zone absolute left-0 right-0 transition-colors",
            dragOverZone === "header" && "bg-blue-50"
          )}
          style={{
            top: 0,
            height: `${headerHeight * SCALE * zoom}px`,
            borderBottom: "1px dashed #cbd5e1",
          }}
          onDragOver={(e) => handleDragOver(e, "header")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDropOnZone(e, "header")}
        >
          <div
            className="absolute top-1 left-2 text-[10px] font-medium uppercase tracking-wider text-blue-400"
            style={{ fontSize: `${10 * zoom}px` }}
          >
            Header
          </div>
          {renderZoneComponents(headerComponents, "header")}
        </div>

        {/* Body Zone */}
        <div
          className={cn(
            "canvas-zone absolute left-0 right-0 transition-colors",
            dragOverZone === "body" && "bg-green-50"
          )}
          style={{
            top: `${bodyTop * SCALE * zoom}px`,
            height: `${bodyHeight * SCALE * zoom}px`,
          }}
          onDragOver={(e) => handleDragOver(e, "body")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDropOnZone(e, "body")}
        >
          <div
            className="absolute top-1 left-2 text-[10px] font-medium uppercase tracking-wider text-green-400"
            style={{ fontSize: `${10 * zoom}px` }}
          >
            Body
          </div>
          {renderZoneComponents(bodyComponents, "body")}
        </div>

        {/* Footer Zone */}
        <div
          className={cn(
            "canvas-zone absolute left-0 right-0 transition-colors",
            dragOverZone === "footer" && "bg-orange-50"
          )}
          style={{
            bottom: 0,
            height: `${footerHeight * SCALE * zoom}px`,
            borderTop: "1px dashed #cbd5e1",
          }}
          onDragOver={(e) => handleDragOver(e, "footer")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDropOnZone(e, "footer")}
        >
          <div
            className="absolute top-1 left-2 text-[10px] font-medium uppercase tracking-wider text-orange-400"
            style={{ fontSize: `${10 * zoom}px` }}
          >
            Footer
          </div>
          {renderZoneComponents(footerComponents, "footer")}
        </div>

        {/* Empty state */}
        {components.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground">
              <p className="text-sm font-medium">Drag components here</p>
              <p className="text-xs mt-1">or click a component in the library to add it</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { SCALE, A4, DEFAULT_ZONES, DEFAULT_MARGINS };
