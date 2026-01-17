// src/components/LabelPreview.tsx
"use client";
import { useEffect, useRef } from "react";
import bwipjs from "bwip-js";

type Props = {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  location?: string;
  dataMatrixPayload?: string;
};

export default function LabelPreview({
  batchNumber,
  variety,
  family,
  quantity,
  size,
  location,
  dataMatrixPayload,
}: Props) {
  const dmRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!dmRef.current) return;
    try {
      bwipjs.toCanvas(dmRef.current, {
        bcid: "datamatrix",
        text: dataMatrixPayload ?? `ht:batch:${batchNumber}`,
        scale: 3,
        includetext: false,
      });
    } catch (e) {
      console.error("DataMatrix render failed:", e);
    }
  }, [batchNumber, dataMatrixPayload]);

  // Build compact info line (matches ZPL layout)
  const infoItems = [size, `Qty ${quantity}`];
  if (location) infoItems.push(location);
  const infoLine = infoItems.join("  /  ");

  return (
    <div
      style={{
        width: "70mm",
        height: "50mm",
        boxSizing: "border-box",
        padding: "2mm",
        background: "white",
        border: "1px solid rgba(0,0,0,.08)",
        borderRadius: 6,
        boxShadow: "0 6px 24px rgba(0,0,0,.10)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top section: DM + Variety/Family */}
      <div style={{ display: "flex", gap: "3mm" }}>
        {/* Left: DataMatrix */}
        <div style={{ flexShrink: 0 }}>
          <canvas ref={dmRef} style={{ width: "18mm", height: "18mm" }} />
        </div>

        {/* Right: Variety and Family */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden", paddingTop: "1mm" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "7mm",
              lineHeight: 1.1,
              letterSpacing: "-0.06mm",
              wordBreak: "break-word",
            }}
          >
            {variety}
          </div>
          <div
            style={{
              fontSize: "5mm",
              lineHeight: 1.2,
              opacity: 0.9,
              marginTop: '1mm',
            }}
          >
            {family}
          </div>
        </div>
      </div>

      {/* Middle section: Size | Qty | Location */}
      <div
        style={{
          fontSize: "5mm",
          lineHeight: 1.3,
          opacity: 0.8,
          marginTop: '2mm',
        }}
      >
        {infoLine}
      </div>

      {/* Bottom section: Batch Number - LARGE, right-aligned */}
      <div
        style={{
          fontWeight: 800,
          fontSize: "9mm",
          lineHeight: 1,
          letterSpacing: "-0.2mm",
          textAlign: "right",
          marginTop: "auto",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        #{String(batchNumber)}
      </div>
    </div>
  );
}
