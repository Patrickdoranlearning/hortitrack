
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
        text: dataMatrixPayload ?? `BATCH:${batchNumber}`,
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
        padding: "3mm",
        background: "white",
        border: "1px solid rgba(0,0,0,.08)",
        borderRadius: 6,
        boxShadow: "0 6px 24px rgba(0,0,0,.10)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "2mm",
          height: "100%",
          alignItems: "center",
        }}
      >
        {/* Data Matrix */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <canvas ref={dmRef} style={{ width: "22mm", height: "22mm" }} />
        </div>

        {/* Text stack */}
        <div style={{ display: "grid", gap: "1.2mm" }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: "9mm",
              lineHeight: 1,
              letterSpacing: "-0.2mm",
            }}
          >
            #{String(batchNumber)}
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "6mm",
              lineHeight: 1.06,
              letterSpacing: "-0.06mm",
              wordBreak: "break-word",
            }}
          >
            {variety}
          </div>
          <div style={{ fontSize: "4.2mm", lineHeight: 1.1, opacity: 0.95 }}>
            Family: <span style={{ fontWeight: 600 }}>{family}</span>
          </div>
          <div style={{ fontSize: "4.2mm", lineHeight: 1.1 }}>
            Qty: <span style={{ fontWeight: 700 }}>{quantity}</span>&nbsp;&nbsp;Size:{" "}
            <span style={{ fontWeight: 700 }}>{size}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
