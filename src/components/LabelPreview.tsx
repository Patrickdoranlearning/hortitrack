
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
  dataMatrixPayload?: string;
};

export default function LabelPreview({
  batchNumber,
  variety,
  family,
  quantity,
  size,
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

  return (
    <div
      style={{
        width: "70mm",
        height: "50mm",
        boxSizing: "border-box",
        padding: "3mm", // 3mm border
        background: "white",
        border: "1px solid rgba(0,0,0,.08)",
        borderRadius: 6,
        boxShadow: "0 6px 24px rgba(0,0,0,.10)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      }}
    >
      {/* Two columns: fixed left (DM + details), flexible right (headline) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "26mm 1fr", // 24mm DM + ~2mm breathing, but DM is explicitly 24mm
          columnGap: "2mm",
          height: "100%",
        }}
      >
        {/* LEFT COLUMN */}
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", rowGap: "1.5mm" }}>
          {/* DM top-left */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <canvas ref={dmRef} style={{ width: "24mm", height: "24mm" }} />
          </div>

          {/* Details below DM */}
          <div
            style={{
              display: "grid",
              gap: "1mm",
              alignContent: "start",
              fontSize: "3.6mm",
              lineHeight: 1.15,
            }}
          >
            <div>
              <span style={{ opacity: 0.8 }}>Family:</span>{" "}
              <strong>{family}</strong>
            </div>
            <div>
              <span style={{ opacity: 0.8 }}>Size:</span>{" "}
              <strong>{size}</strong>
            </div>
            <div>
              <span style={{ opacity: 0.8 }}>Qty:</span>{" "}
              <strong>{quantity}</strong>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (headline stack) */}
        <div
          style={{
            display: "grid",
            gap: "2mm",
            alignContent: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "9mm",
              lineHeight: 1,
              letterSpacing: "-0.2mm",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            #{String(batchNumber)}
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "6mm",
              lineHeight: 1.05,
              letterSpacing: "-0.06mm",
              wordBreak: "break-word",
            }}
          >
            {variety}
          </div>
        </div>
      </div>
    </div>
  );
}
