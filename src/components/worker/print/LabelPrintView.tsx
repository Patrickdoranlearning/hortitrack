"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

/**
 * Label size presets for common nursery label paper sizes
 */
export type LabelSize = "small" | "medium" | "large";

const LABEL_DIMENSIONS: Record<LabelSize, { width: string; height: string }> = {
  small: { width: "50mm", height: "30mm" },
  medium: { width: "70mm", height: "50mm" },
  large: { width: "100mm", height: "70mm" },
};

export interface BaseLabelData {
  qrValue: string;
}

export interface BatchLabelData extends BaseLabelData {
  type: "batch";
  batchNumber: string;
  varietyName: string;
  familyName?: string;
  sizeName?: string;
  plantedDate?: string;
  quantity?: number;
  locationName?: string;
}

export interface LocationLabelData extends BaseLabelData {
  type: "location";
  locationName: string;
  nurserySite?: string;
  locationType?: string;
  batchCount: number;
  totalQuantity: number;
  batches?: Array<{ varietyName: string; quantity: number }>;
}

export interface LotLabelData extends BaseLabelData {
  type: "lot";
  lotNumber: string;
  materialName: string;
  partNumber?: string;
  categoryName?: string;
  quantity: number;
  uom: string;
  unitType?: string;
  supplierName?: string;
  receivedDate?: string;
  expiryDate?: string;
  locationName?: string;
}

export type LabelData = BatchLabelData | LocationLabelData | LotLabelData;

interface LabelPrintViewProps {
  labels: LabelData[];
  size?: LabelSize;
  copies?: number;
  showPreview?: boolean;
}

/**
 * LabelPrintView - Renders labels for printing via browser print dialog
 *
 * Uses @media print CSS to show labels only when printing.
 * When showPreview is true, labels are visible on screen for preview.
 */
export function LabelPrintView({
  labels,
  size = "medium",
  copies = 1,
  showPreview = false,
}: LabelPrintViewProps) {
  const dimensions = LABEL_DIMENSIONS[size];

  // Generate array of labels with copies
  const allLabels = labels.flatMap((label) =>
    Array.from({ length: copies }, (_, i) => ({
      ...label,
      key: `${label.qrValue}-${i}`,
    }))
  );

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          @page {
            size: ${dimensions.width} ${dimensions.height};
            margin: 0;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-label {
            page-break-after: always;
            page-break-inside: avoid;
          }

          .print-label:last-child {
            page-break-after: auto;
          }
        }

        @media screen {
          .print-only {
            ${showPreview ? "" : "display: none !important;"}
          }
        }
      `}</style>

      {/* Labels container */}
      <div className={cn("print-only", showPreview && "space-y-4")}>
        {allLabels.map((label) => (
          <div
            key={label.key}
            className="print-label"
            style={{
              width: dimensions.width,
              height: dimensions.height,
              padding: "2mm",
              backgroundColor: "white",
              fontFamily: "system-ui, -apple-system, sans-serif",
              boxSizing: "border-box",
              ...(showPreview
                ? {
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    marginBottom: "16px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }
                : {}),
            }}
          >
            {label.type === "batch" && <BatchLabel data={label} size={size} />}
            {label.type === "location" && <LocationLabel data={label} size={size} />}
            {label.type === "lot" && <LotLabel data={label} size={size} />}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Batch Label Layout
 */
function BatchLabel({ data, size }: { data: BatchLabelData; size: LabelSize }) {
  const qrSize = size === "small" ? 40 : size === "medium" ? 60 : 80;
  const isCompact = size === "small";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: isCompact ? "1mm" : "2mm",
      }}
    >
      {/* Header with QR and main info */}
      <div style={{ display: "flex", gap: "3mm" }}>
        {/* QR Code */}
        <div style={{ flexShrink: 0 }}>
          <QRCodeSVG value={data.qrValue} size={qrSize} level="M" />
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              fontSize: isCompact ? "10px" : "14px",
              fontWeight: 700,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: isCompact ? "nowrap" : "normal",
            }}
          >
            {data.varietyName}
          </div>
          {data.familyName && !isCompact && (
            <div
              style={{
                fontSize: "10px",
                color: "#6b7280",
                marginTop: "1mm",
              }}
            >
              {data.familyName}
            </div>
          )}
          {data.sizeName && (
            <div
              style={{
                fontSize: isCompact ? "8px" : "10px",
                color: "#374151",
                marginTop: "1mm",
              }}
            >
              Size: {data.sizeName}
            </div>
          )}
        </div>
      </div>

      {/* Middle info */}
      {!isCompact && (
        <div
          style={{
            display: "flex",
            gap: "4mm",
            fontSize: "9px",
            color: "#374151",
          }}
        >
          {data.quantity !== undefined && <span>Qty: {data.quantity.toLocaleString()}</span>}
          {data.plantedDate && <span>Planted: {formatDate(data.plantedDate)}</span>}
          {data.locationName && <span>{data.locationName}</span>}
        </div>
      )}

      {/* Footer - Batch Number */}
      <div
        style={{
          marginTop: "auto",
          fontSize: isCompact ? "12px" : "18px",
          fontWeight: 700,
          textAlign: "right",
        }}
      >
        #{data.batchNumber}
      </div>
    </div>
  );
}

/**
 * Location Label Layout
 */
function LocationLabel({ data, size }: { data: LocationLabelData; size: LabelSize }) {
  const qrSize = size === "small" ? 50 : size === "medium" ? 70 : 90;
  const isCompact = size === "small";
  const maxBatches = isCompact ? 0 : size === "medium" ? 4 : 6;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: "2mm",
      }}
    >
      {/* Header with QR and location name */}
      <div style={{ display: "flex", gap: "3mm" }}>
        {/* QR Code */}
        <div style={{ flexShrink: 0 }}>
          <QRCodeSVG value={data.qrValue} size={qrSize} level="M" />
        </div>

        {/* Location info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: isCompact ? "12px" : "16px",
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {data.locationName}
          </div>
          <div
            style={{
              fontSize: isCompact ? "8px" : "10px",
              color: "#6b7280",
              marginTop: "1mm",
            }}
          >
            {[data.nurserySite, data.locationType].filter(Boolean).join(" - ") || "Nursery Location"}
          </div>
          <div
            style={{
              fontSize: isCompact ? "8px" : "10px",
              color: "#374151",
              marginTop: "2mm",
            }}
          >
            {data.batchCount} batches - {data.totalQuantity.toLocaleString()} plants
          </div>
        </div>
      </div>

      {/* Batch list (if space allows) */}
      {!isCompact && data.batches && data.batches.length > 0 && (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div
            style={{
              fontSize: "8px",
              fontWeight: 600,
              color: "#374151",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "2mm",
              marginBottom: "1mm",
            }}
          >
            CONTENTS
          </div>
          <div style={{ fontSize: "8px", color: "#4b5563" }}>
            {data.batches.slice(0, maxBatches).map((batch, i) => (
              <div key={i} style={{ marginBottom: "0.5mm" }}>
                {batch.varietyName} - {batch.quantity.toLocaleString()}
              </div>
            ))}
            {data.batches.length > maxBatches && (
              <div style={{ color: "#9ca3af" }}>
                +{data.batches.length - maxBatches} more...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: "1mm",
          fontSize: "7px",
          color: "#9ca3af",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Printed: {new Date().toLocaleDateString("en-IE")}</span>
        <span>Scan to view batches</span>
      </div>
    </div>
  );
}

/**
 * Material Lot Label Layout
 */
function LotLabel({ data, size }: { data: LotLabelData; size: LabelSize }) {
  const qrSize = size === "small" ? 40 : size === "medium" ? 60 : 80;
  const isCompact = size === "small";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: isCompact ? "1mm" : "2mm",
      }}
    >
      {/* Header with QR and material name */}
      <div style={{ display: "flex", gap: "3mm" }}>
        {/* QR Code */}
        <div style={{ flexShrink: 0 }}>
          <QRCodeSVG value={data.qrValue} size={qrSize} level="M" />
        </div>

        {/* Material info */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              fontSize: isCompact ? "10px" : "13px",
              fontWeight: 700,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.materialName}
          </div>
          <div
            style={{
              fontSize: isCompact ? "7px" : "9px",
              color: "#6b7280",
              marginTop: "1mm",
            }}
          >
            {[data.partNumber, data.categoryName].filter(Boolean).join(" | ")}
          </div>
        </div>
      </div>

      {/* Quantity and unit info */}
      <div
        style={{
          fontSize: isCompact ? "9px" : "11px",
          color: "#374151",
          fontWeight: 500,
        }}
      >
        {data.unitType && capitalize(data.unitType)} - {data.quantity} {data.uom}
      </div>

      {/* Additional info */}
      {!isCompact && (
        <div
          style={{
            fontSize: "8px",
            color: "#4b5563",
            display: "flex",
            flexWrap: "wrap",
            gap: "2mm",
          }}
        >
          {data.supplierName && <span>Supplier: {data.supplierName}</span>}
          {data.receivedDate && <span>Received: {formatDate(data.receivedDate)}</span>}
          {data.expiryDate && (
            <span style={{ color: "#dc2626" }}>Expires: {formatDate(data.expiryDate)}</span>
          )}
          {data.locationName && <span>Location: {data.locationName}</span>}
        </div>
      )}

      {/* Footer - Lot Number */}
      <div
        style={{
          marginTop: "auto",
          fontSize: isCompact ? "10px" : "14px",
          fontWeight: 700,
          textAlign: "right",
        }}
      >
        LOT: {data.lotNumber}
      </div>
    </div>
  );
}

// Helper functions
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
